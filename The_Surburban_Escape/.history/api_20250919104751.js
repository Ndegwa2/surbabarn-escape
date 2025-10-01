const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const JWT_SECRET = 'your_jwt_secret_key_change_in_production'; // kumbuka to change this in production

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const dbPath = path.join(__dirname, 'hotel.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite connection failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite');
  initializeDatabase().then(() => {
    console.log('Database initialized successfully');
    app.listen(port, () => {
      console.log(`🚀 Server listening on http://localhost:${port}`);
    });
  }).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
});

// Promisified db operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// JWT middleware to verify token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).send('Access token required');
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send('Invalid token');
    }
    req.user = user;
    next();
  });
}

// Admin middleware
function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Admin access required');
  }
  next();
}

// Initialize database tables
async function initializeDatabase() {
  // Create guests table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      idNumber TEXT,
      room TEXT,
      status TEXT DEFAULT 'Checked In'
    )
  `);

  // Create rooms table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_rate REAL NOT NULL,
      status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance'))
    )
  `);

  // Add housekeeping_state column if it doesn't exist
  try {
    await run("ALTER TABLE rooms ADD COLUMN housekeeping_state TEXT DEFAULT 'clean' CHECK (housekeeping_state IN ('dirty', 'clean', 'maintenance'))");
    console.log('✅ Added housekeeping_state column to rooms if needed');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding housekeeping_state column:', err);
    }
  }

  // Set housekeeping_state to 'clean' for existing rooms
  await run("UPDATE rooms SET housekeeping_state = 'clean' WHERE housekeeping_state IS NULL OR housekeeping_state = ''");

  // Create conferences table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS conferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 50,
      equipment TEXT NOT NULL DEFAULT '["projector", "microphone", "speaker"]',
      hourly_rate REAL NOT NULL DEFAULT 50.0,
      daily_rate REAL NOT NULL DEFAULT 300.0,
      status TEXT DEFAULT 'available' CHECK (status IN ('available', 'maintenance'))
    )
  `);

  // Create bookings table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      check_in_date DATE NOT NULL,
      check_out_date DATE NOT NULL,
      status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'checked_in', 'checked_out', 'cancelled', 'no_show')),
      total_price REAL,
      FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms (id)
    )
  `);

  // Create accessories table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      total_stock INTEGER NOT NULL DEFAULT 0,
      available_stock INTEGER NOT NULL DEFAULT 0,
      price_per_unit REAL DEFAULT 0.0
    )
  `);

  // Create conference_bookings table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS conference_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'active', 'completed', 'cancelled')),
      deposit REAL DEFAULT 0.0,
      attendees INTEGER DEFAULT 1,
      total_price REAL,
      FOREIGN KEY (facility_id) REFERENCES conferences (id) ON DELETE CASCADE
    )
  `);

  // Create accessory_allocations table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS accessory_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accessory_id INTEGER NOT NULL,
      booking_id INTEGER,
      conference_booking_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1,
      allocation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      return_date DATETIME,
      status TEXT DEFAULT 'allocated' CHECK (status IN ('allocated', 'returned', 'lost', 'damaged')),
      FOREIGN KEY (accessory_id) REFERENCES accessories (id) ON DELETE CASCADE,
      FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
      FOREIGN KEY (conference_booking_id) REFERENCES conference_bookings (id) ON DELETE CASCADE
    )
  `);

  // Inventory tables
  await run(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'consumables' CHECK (category IN ('consumables', 'fixed_assets')),
      total_stock INTEGER NOT NULL DEFAULT 0,
      current_stock INTEGER NOT NULL DEFAULT 0,
      min_level INTEGER NOT NULL DEFAULT 0,
      reorder_threshold INTEGER NOT NULL DEFAULT 10,
      unit TEXT NOT NULL DEFAULT 'unit',
      price_per_unit REAL DEFAULT 0.0,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust')),
      quantity INTEGER NOT NULL,
      reason TEXT,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_role TEXT DEFAULT 'staff',
      FOREIGN KEY (item_id) REFERENCES inventory_items (id) ON DELETE CASCADE
    )
  `);

  // Create office_usage table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS office_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_type TEXT NOT NULL CHECK (user_type IN ('staff','admin','guest')),
      start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      purpose TEXT
    )
  `);

  // Add quantity column if it doesn't exist (for existing DB)
  try {
    await run("ALTER TABLE accessory_allocations ADD COLUMN quantity INTEGER DEFAULT 1");
    console.log('✅ Added quantity column to accessory_allocations if needed');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding quantity column:', err);
    }
  }

  // Add price_per_unit to accessories if it doesn't exist
  try {
    await run("ALTER TABLE accessories ADD COLUMN price_per_unit REAL DEFAULT 0.0");
    console.log('✅ Added price_per_unit column to accessories if needed');
  } catch (err) {
    if (!err.message.includes('duplicate column name')) {
      console.error('Error adding price_per_unit column:', err);
    }
  }

  // Add conference booking columns if they don't exist (for existing DB)
  const confColumns = ['facility_id INTEGER', 'start_time TIME', 'end_time TIME', 'deposit REAL DEFAULT 0.0', 'attendees INTEGER DEFAULT 1'];
  for (const col of confColumns) {
    try {
      await run(`ALTER TABLE conference_bookings ADD COLUMN ${col}`);
      console.log(`✅ Added column ${col.split(' ')[0]} to conference_bookings if needed`);
    } catch (err) {
      if (!err.message.includes('duplicate column name')) {
        console.error(`Error adding column ${col}:`, err);
      }
    }
  }

  // Create activity_logs table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_role TEXT DEFAULT 'staff',
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      description TEXT
    )
  `);

  // Create users table if not exists
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'staff'))
    )
  `);

  // Seed initial users if table empty
  const userRow = await get("SELECT COUNT(*) as count FROM users");
  if (userRow && userRow.count === 0) {
    const saltRounds = 10;
    const adminHash = await new Promise((resolve, reject) => {
      bcrypt.hash('admin', saltRounds, (err, hash) => {
        if (err) reject(err);
        else resolve(hash);
      });
    });
    await run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', adminHash, 'admin']);
    const staffHash = await new Promise((resolve, reject) => {
      bcrypt.hash('staff', saltRounds, (err, hash) => {
        if (err) reject(err);
        else resolve(hash);
      });
    });
    await run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['staff', staffHash, 'staff']);
    console.log('✅ Seeded initial users');
  }

  // Seed initial rooms data from data.json if rooms table is empty
  const roomRow = await get("SELECT COUNT(*) as count FROM rooms");
  if (roomRow && roomRow.count === 0) {
    try {
      const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
      const bedrooms = data.bedrooms;
      for (const [key, room] of Object.entries(bedrooms)) {
        const baseRate = key.startsWith('ensuite') ? 100.00 : 80.00; // Sample rates
        await run(
          "INSERT INTO rooms (name, type, base_rate, status) VALUES (?, ?, ?, ?)",
          [room.name, room.type, baseRate, room.status]
        );
      }
      console.log('✅ Seeded initial rooms data');
    } catch (err) {
      console.error('Error seeding rooms:', err);
    }
  }

  // Seed initial conference data from data.json if conferences table is empty
  const confRow = await get("SELECT COUNT(*) as count FROM conferences");
  if (confRow && confRow.count === 0) {
    try {
      const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
      const confFacility = data.conferencing_facility;
      if (confFacility) {
        await run(
          "INSERT INTO conferences (name, capacity, equipment, hourly_rate, daily_rate, status) VALUES (?, ?, ?, ?, ?, ?)",
          [confFacility.name, 50, '["projector", "microphone", "speaker", "whiteboard"]', 50.00, 300.00, confFacility.status]
        );
        console.log('✅ Seeded initial conference facility data');
      }
    } catch (err) {
      console.error('Error seeding conferences:', err);
    }

  // Seed initial inventory items data if table is empty
  const invRow = await get("SELECT COUNT(*) as count FROM inventory_items");
  if (invRow && invRow.count === 0) {
    try {
      const sampleItems = [
        {
          name: 'Towels',
          description: 'Bath towels for guests',
          category: 'consumables',
          total_stock: 200,
          current_stock: 180,
          min_level: 20,
          reorder_threshold: 50,
          unit: 'piece',
          price_per_unit: 5.00,
          status: 'active'
        },
        {
          name: 'Toilet Paper',
          description: 'Rolls of toilet paper',
          category: 'consumables',
          total_stock: 500,
          current_stock: 450,
          min_level: 50,
          reorder_threshold: 100,
          unit: 'roll',
          price_per_unit: 0.50,
          status: 'active'
        },
        {
          name: 'Soap Bars',
          description: 'Guest soap bars',
          category: 'consumables',
          total_stock: 300,
          current_stock: 250,
          min_level: 30,
          reorder_threshold: 75,
          unit: 'bar',
          price_per_unit: 1.00,
          status: 'active'
        },
        {
          name: 'Bed Linens',
          description: 'Sheets and pillowcases',
          category: 'consumables',
          total_stock: 150,
          current_stock: 120,
          min_level: 15,
          reorder_threshold: 40,
          unit: 'set',
          price_per_unit: 15.00,
          status: 'active'
        },
        {
          name: 'Chairs',
          description: 'Dining and lounge chairs',
          category: 'fixed_assets',
          total_stock: 50,
          current_stock: 48,
          min_level: 5,
          reorder_threshold: 10,
          unit: 'unit',
          price_per_unit: 100.00,
          status: 'active'
        },
        {
          name: 'Tables',
          description: 'Conference and room tables',
          category: 'fixed_assets',
          total_stock: 20,
          current_stock: 18,
          min_level: 2,
          reorder_threshold: 5,
          unit: 'unit',
          price_per_unit: 200.00,
          status: 'active'
        }
      ];

      for (const item of sampleItems) {
        await run(
          `INSERT INTO inventory_items (name, description, category, total_stock, current_stock, min_level, reorder_threshold, unit, price_per_unit, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.name, item.description, item.category, item.total_stock, item.current_stock,
            item.min_level, item.reorder_threshold, item.unit, item.price_per_unit, item.status
          ]
        );
      }
      console.log('✅ Seeded initial inventory items data');
    } catch (err) {
      console.error('Error seeding inventory items:', err);
    }
  }
}

// Seed initial accessories data if table is empty
const accRow = await get("SELECT COUNT(*) as count FROM accessories");
if (accRow && accRow.count === 0) {
  try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    const accessoriesData = data.accessories;
    if (accessoriesData) {
      const sampleAccessories = [
        {
          name: 'Baby Cot',
          description: 'Crib for infants',
          total_stock: accessoriesData.baby_cots || 2,
          available_stock: accessoriesData.baby_cots || 2,
          price_per_unit: 10.00
        },
        {
          name: 'High Chair',
          description: 'Chair for toddlers',
          total_stock: accessoriesData.high_chairs || 1,
          available_stock: accessoriesData.high_chairs || 1,
          price_per_unit: 5.00
        }
      ];

      for (const acc of sampleAccessories) {
        await run(
          "INSERT INTO accessories (name, description, total_stock, available_stock, price_per_unit) VALUES (?, ?, ?, ?, ?)",
          [acc.name, acc.description, acc.total_stock, acc.available_stock, acc.price_per_unit]
        );
      }
      console.log('✅ Seeded initial accessories data');
    }
  } catch (err) {
    console.error('Error seeding accessories:', err);
  }
}
}


// Helper to log activity
function logActivity(action, entityType, entityId, description = '', userRole = 'staff') {
  db.run(
    "INSERT INTO activity_logs (action, entity_type, entity_id, description, user_role) VALUES (?, ?, ?, ?, ?)",
    [action, entityType, entityId, description, userRole]
  );
}

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT id, username, password_hash, role FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    bcrypt.compare(password, user.password_hash, (err, match) => {
      if (err || !match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, role: user.role });
    });
  });
});

// Protected routes use authenticateToken

// Check-in route: Create guest and booking (protected)
app.post('/checkin', authenticateToken, (req, res) => {
  const { name, phone, email, idNumber, roomName, checkInDate, checkOutDate } = req.body;
  
  db.run("INSERT INTO guests (name, phone, email, idNumber, room, status) VALUES (?, ?, ?, ?, ?, ?)", 
    [name, phone, email, idNumber, roomName, 'Checked In'], function(err) {
      if (err) {
        console.error('❌ Error inserting guest:', err);
        return res.status(500).send('Error inserting guest');
      }
      const guestId = this.lastID;

      // Find room ID by name
      db.get("SELECT id FROM rooms WHERE name = ?", [roomName], (err, room) => {
        if (err || !room) {
          return res.status(500).send('Room not found');
        }
        const roomId = room.id;

        // Calculate nights and total price
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = (checkOut - checkIn) / (1000 * 60 * 60 * 24);
        db.get("SELECT base_rate FROM rooms WHERE id = ?", [roomId], (err, r) => {
          if (err || !r) return res.status(500).send('Error calculating price');
          const totalPrice = r.base_rate * nights;

          // Update room status to occupied
          db.run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [roomId]);

          // Create booking
          db.run(
            "INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, status, total_price) VALUES (?, ?, ?, ?, ?, ?)",
            [guestId, roomId, checkInDate, checkOutDate, 'checked_in', totalPrice], function(err) {
              if (err) {
                console.error('❌ Error creating booking:', err);
                return res.status(500).send('Error creating booking');
              }
              logActivity('checkin', 'guest', guestId, `Checked in to room ${roomName}`, req.user.role);
              logActivity('checkin', 'booking', this.lastID, '', req.user.role);
              console.log('✅ Guest checked in:', name);
              res.status(200).send('Guest checked in successfully');
            }
          );
        });
      });
    }
  );
});

// Checkout route: Update booking status, room status (protected)
app.post('/checkout/:id', authenticateToken, (req, res) => {
  const guestId = req.params.id;
  db.get("SELECT b.id as booking_id, b.room_id, b.status FROM bookings b JOIN guests g ON b.guest_id = g.id WHERE g.id = ? AND b.status = 'checked_in'", [guestId], (err, booking) => {
    if (err || !booking) {
      return res.status(500).send('Booking not found or not checked in');
    }
    db.run("UPDATE bookings SET status = 'checked_out' WHERE id = ?", [booking.booking_id]);
    db.run("UPDATE rooms SET status = 'available' WHERE id = ?", [booking.room_id]);
    db.run("UPDATE guests SET status = 'Checked Out' WHERE id = ?", [guestId]);
    logActivity('checkout', 'booking', booking.booking_id, 'Checked out', req.user.role);
    console.log('✅ Guest checked out. ID:', guestId);
    res.status(200).send('Guest checked out successfully');
  });
});

// Get all guests with booking info (protected)
app.get('/guests', authenticateToken, (req, res) => {
  db.all(`
    SELECT g.id, g.name, g.phone, g.email, g.idNumber, g.room, g.status,
           b.check_in_date, b.check_out_date, b.status as booking_status
    FROM guests g LEFT JOIN bookings b ON g.id = b.guest_id AND b.status != 'cancelled'
    ORDER BY g.id DESC
  `, (err, results) => {
    if (err) {
      console.error('❌ Error fetching guests:', err);
      return res.status(500).send('Error fetching guests');
    }
    res.status(200).json(results);
  });
});

// CRUD for rooms (protected, admin for write/delete)
app.get('/rooms', authenticateToken, (req, res) => {
  db.all("SELECT * FROM rooms", (err, results) => {
    if (err) return res.status(500).send('Error fetching rooms');
    res.json(results);
  });
});

app.post('/rooms', authenticateToken, isAdmin, (req, res) => {
  const { name, type, base_rate, status } = req.body;
  db.run("INSERT INTO rooms (name, type, base_rate, status) VALUES (?, ?, ?, ?)", 
    [name, type, base_rate, status], function(err) {
      if (err) return res.status(500).send('Error creating room');
      logActivity('create', 'room', this.lastID, '', req.user.role);
      res.json({ id: this.lastID });
    }
  );
});

app.put('/rooms/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, type, base_rate, status, housekeeping_state } = req.body;
  const id = req.params.id;
  db.run("UPDATE rooms SET name = ?, type = ?, base_rate = ?, status = ?, housekeeping_state = ? WHERE id = ?",
    [name, type, base_rate, status, housekeeping_state, id], function(err) {
      if (err) return res.status(500).send('Error updating room');
      if (this.changes === 0) return res.status(404).send('Room not found');
      logActivity('update', 'room', id, `Housekeeping: ${housekeeping_state || 'unchanged'}`, req.user.role);
      res.json({ updated: true });
    }
  );
});

// Quick action to update housekeeping state
app.post('/rooms/:id/housekeeping', authenticateToken, (req, res) => {
  const { housekeeping_state } = req.body;
  const id = req.params.id;
  if (!['dirty', 'clean', 'maintenance'].includes(housekeeping_state)) {
    return res.status(400).send('Invalid housekeeping state');
  }
  db.run("UPDATE rooms SET housekeeping_state = ? WHERE id = ?", [housekeeping_state, id], function(err) {
    if (err) return res.status(500).send('Error updating housekeeping state');
    if (this.changes === 0) return res.status(404).send('Room not found');
    logActivity('update', 'room', id, `Housekeeping to ${housekeeping_state}`, req.user.role);
    res.json({ updated: true });
  });
});

app.delete('/rooms/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM rooms WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting room');
    if (this.changes === 0) return res.status(404).send('Room not found');
    logActivity('delete', 'room', id, '', req.user.role);
    res.json({ deleted: true });
  });
});

// CRUD for conferences (protected, admin for write/delete)
app.get('/conferences', authenticateToken, (req, res) => {
  db.all("SELECT * FROM conferences ORDER BY name", (err, results) => {
    if (err) return res.status(500).send('Error fetching conferences');
    res.json(results);
  });
});

app.post('/conferences', authenticateToken, isAdmin, (req, res) => {
  const { name, capacity, equipment, hourly_rate, daily_rate, status } = req.body;
  const equipJson = JSON.stringify(equipment || ["projector", "microphone", "speaker"]);
  db.run("INSERT INTO conferences (name, capacity, equipment, hourly_rate, daily_rate, status) VALUES (?, ?, ?, ?, ?, ?)",
    [name, capacity || 50, equipJson, hourly_rate || 50.0, daily_rate || 300.0, status || 'available'], function(err) {
      if (err) return res.status(500).send('Error creating conference facility');
      logActivity('create', 'conference', this.lastID, '', req.user.role);
      res.json({ id: this.lastID });
    }
  );
});

app.put('/conferences/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, capacity, equipment, hourly_rate, daily_rate, status } = req.body;
  const id = req.params.id;
  const equipJson = JSON.stringify(equipment || ["projector", "microphone", "speaker"]);
  db.run("UPDATE conferences SET name = ?, capacity = ?, equipment = ?, hourly_rate = ?, daily_rate = ?, status = ? WHERE id = ?",
    [name, capacity, equipJson, hourly_rate, daily_rate, status, id], function(err) {
      if (err) return res.status(500).send('Error updating conference facility');
      if (this.changes === 0) return res.status(404).send('Conference facility not found');
      logActivity('update', 'conference', id, '', req.user.role);
      res.json({ updated: true });
    }
  );
});

app.delete('/conferences/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM conferences WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting conference facility');
    if (this.changes === 0) return res.status(404).send('Conference facility not found');
    logActivity('delete', 'conference', id, '', req.user.role);
    res.json({ deleted: true });
  });
});

// CRUD for bookings (protected, admin for write/delete)
app.get('/bookings', authenticateToken, (req, res) => {
  db.all(`
    SELECT b.*, g.name as guest_name, r.name as room_name, r.base_rate
    FROM bookings b
    JOIN guests g ON b.guest_id = g.id
    JOIN rooms r ON b.room_id = r.id
    ORDER BY b.check_in_date DESC
  `, (err, results) => {
    if (err) return res.status(500).send('Error fetching bookings');
    res.json(results);
  });
});

app.post('/bookings', authenticateToken, isAdmin, (req, res) => {
  const { guest_id, room_id, check_in_date, check_out_date, status } = req.body;
  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);
  const nights = (checkOut - checkIn) / (1000 * 60 * 60 * 24);
  db.get("SELECT base_rate FROM rooms WHERE id = ?", [room_id], (err, room) => {
    if (err || !room) return res.status(500).send('Room not found');
    const total_price = room.base_rate * nights;
    db.run(
      "INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, status, total_price) VALUES (?, ?, ?, ?, ?, ?)",
      [guest_id, room_id, check_in_date, check_out_date, status || 'reserved', total_price], function(err) {
        if (err) return res.status(500).send('Error creating booking');
        if (status === 'reserved') {
          db.run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [room_id]);
        }
        logActivity('create', 'booking', this.lastID, '', req.user.role);
        res.json({ id: this.lastID });
      }
    );
  });
});

app.put('/bookings/:id', authenticateToken, (req, res) => {
  const { status, check_out_date } = req.body;
  const id = req.params.id;
  if (status === 'checked_out' && check_out_date) {
    db.run("UPDATE bookings SET status = ?, check_out_date = ? WHERE id = ?", [status, check_out_date, id], function(err) {
      if (err) return res.status(500).send('Error updating booking');
      if (this.changes === 0) return res.status(404).send('Booking not found');
      db.run("UPDATE rooms SET status = 'available' WHERE id IN (SELECT room_id FROM bookings WHERE id = ?)", [id]);
      logActivity('update', 'booking', id, `Status to ${status}`, req.user.role);
      res.json({ updated: true });
    });
  } else {
    db.run("UPDATE bookings SET status = ? WHERE id = ?", [status, id], function(err) {
      if (err) return res.status(500).send('Error updating booking');
      if (this.changes === 0) return res.status(404).send('Booking not found');
      logActivity('update', 'booking', id, `Status to ${status}`, req.user.role);
      res.json({ updated: true });
    });
  }
});

app.delete('/bookings/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM bookings WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting booking');
    if (this.changes === 0) return res.status(404).send('Booking not found');
    db.run("UPDATE rooms SET status = 'available' WHERE id IN (SELECT room_id FROM bookings WHERE id = ?)", [id]);
    logActivity('delete', 'booking', id, 'Cancelled', req.user.role);
    res.json({ deleted: true });
  });
});

// CRUD for conference_bookings (protected, admin for write/delete)
app.get('/conference-bookings', authenticateToken, (req, res) => {
  db.all(`
    SELECT cb.*, c.name as facility_name, c.capacity, c.equipment, c.hourly_rate, c.daily_rate
    FROM conference_bookings cb
    JOIN conferences c ON cb.facility_id = c.id
    ORDER BY cb.date DESC, cb.start_time
  `, (err, results) => {
    if (err) return res.status(500).send('Error fetching conference bookings');
    results.forEach(r => { if (r.equipment) r.equipment = JSON.parse(r.equipment); });
    res.json(results);
  });
});

app.post('/conference-bookings', authenticateToken, isAdmin, (req, res) => {
  const { facility_id, name, date, start_time, end_time, deposit = 0.0, attendees = 1, status } = req.body;
  
  if (!facility_id || !name || !date || !start_time || !end_time) {
    return res.status(400).send('facility_id, name, date, start_time, end_time required');
  }
  
  // Validate times
  const start = new Date(`1970-01-01T${start_time}:00`);
  const end = new Date(`1970-01-01T${end_time}:00`);
  if (start >= end) {
    return res.status(400).send('start_time must be before end_time');
  }
  
  // Check for clashes
  db.get(`
    SELECT id FROM conference_bookings
    WHERE facility_id = ? AND date = ? AND status != 'cancelled'
    AND start_time < ? AND end_time > ?
  `, [facility_id, date, end_time, start_time], (err, clash) => {
    if (err) return res.status(500).send('Error checking clashes');
    if (clash) {
      return res.status(409).send('Time slot clashes with existing booking');
    }
    
    // Get facility rates
    db.get("SELECT hourly_rate, daily_rate FROM conferences WHERE id = ?", [facility_id], (err, facility) => {
      if (err || !facility) return res.status(404).send('Facility not found');
      
      const durationHours = (end - start) / (1000 * 60 * 60);
      let total_price;
      if (durationHours >= 8) {
        total_price = facility.daily_rate;
      } else {
        total_price = facility.hourly_rate * durationHours;
      }
      
      db.run(
        "INSERT INTO conference_bookings (facility_id, name, date, start_time, end_time, status, deposit, attendees, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [facility_id, name, date, start_time, end_time, status || 'reserved', parseFloat(deposit), parseInt(attendees), total_price], function(err) {
          if (err) return res.status(500).send('Error creating conference booking');
          logActivity('create', 'conference_booking', this.lastID, `Booked ${name} for ${durationHours.toFixed(1)}h`, req.user.role);
          res.json({ id: this.lastID, total_price });
        }
      );
    });
  });
});

app.put('/conference-bookings/:id', authenticateToken, (req, res) => {
  const { status, deposit } = req.body;
  const id = req.params.id;
  let query = "UPDATE conference_bookings SET ";
  let params = [];
  if (status) {
    query += "status = ?, ";
    params.push(status);
  }
  if (deposit !== undefined) {
    query += "deposit = ?, ";
    params.push(parseFloat(deposit));
  }
  query = query.slice(0, -2) + " WHERE id = ?";
  params.push(id);
  
  db.run(query, params, function(err) {
    if (err) return res.status(500).send('Error updating conference booking');
    if (this.changes === 0) return res.status(404).send('Conference booking not found');
    const desc = status ? `Status to ${status}` : (deposit !== undefined ? `Deposit to ${deposit}` : 'Updated');
    logActivity('update', 'conference_booking', id, desc, req.user.role);
    res.json({ updated: true });
  });
});

app.delete('/conference-bookings/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM conference_bookings WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting conference booking');
    if (this.changes === 0) return res.status(404).send('Conference booking not found');
    logActivity('delete', 'conference_booking', id, '', req.user.role);
    res.json({ deleted: true });
  });
});

// CRUD for accessories (protected, admin for write/delete)
app.get('/accessories', authenticateToken, (req, res) => {
  db.all("SELECT * FROM accessories ORDER BY name", (err, results) => {
    if (err) return res.status(500).send('Error fetching accessories');
    res.json(results);
  });
});

app.post('/accessories', authenticateToken, isAdmin, (req, res) => {
  const { name, description, total_stock, available_stock } = req.body;
  let adjusted_available = available_stock;
  if (available_stock > total_stock) {
    adjusted_available = total_stock;
  }
  db.run("INSERT INTO accessories (name, description, total_stock, available_stock) VALUES (?, ?, ?, ?)",
    [name, description || '', total_stock, adjusted_available], function(err) {
      if (err) return res.status(500).send('Error creating accessory');
      logActivity('create', 'accessory', this.lastID, `Created ${name}`, req.user.role);
      res.json({ id: this.lastID });
    }
  );
});

app.put('/accessories/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, description, total_stock, available_stock } = req.body;
  const id = req.params.id;
  let adjusted_available = available_stock;
  if (available_stock > total_stock) {
    adjusted_available = total_stock;
  }
  db.run("UPDATE accessories SET name = ?, description = ?, total_stock = ?, available_stock = ? WHERE id = ?",
    [name, description || '', total_stock, adjusted_available, id], function(err) {
      if (err) return res.status(500).send('Error updating accessory');
      if (this.changes === 0) return res.status(404).send('Accessory not found');
      logActivity('update', 'accessory', id, `Updated ${name}`, req.user.role);
      res.json({ updated: true });
    }
  );
});

app.delete('/accessories/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM accessories WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting accessory');
    if (this.changes === 0) return res.status(404).send('Accessory not found');
    logActivity('delete', 'accessory', id, '', req.user.role);
    res.json({ deleted: true });
  });
});

// CRUD for inventory items (protected, admin for write/delete)
app.get('/inventory-items', authenticateToken, (req, res) => {
  db.all("SELECT * FROM inventory_items ORDER BY name", (err, results) => {
    if (err) return res.status(500).send('Error fetching inventory items');
    res.json(results);
  });
});

app.post('/inventory-items', authenticateToken, isAdmin, (req, res) => {
  const { name, description, category, total_stock, current_stock, min_level, reorder_threshold, unit, price_per_unit, status } = req.body;
  if (current_stock > total_stock) {
    return res.status(400).send('Current stock cannot exceed total stock');
  }
  db.run("INSERT INTO inventory_items (name, description, category, total_stock, current_stock, min_level, reorder_threshold, unit, price_per_unit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [name, description || '', category || 'consumables', total_stock || 0, current_stock || 0, min_level || 0, reorder_threshold || 10, unit || 'unit', price_per_unit || 0.0, status || 'active'], function(err) {
      if (err) return res.status(500).send('Error creating inventory item');
      logActivity('create', 'inventory_item', this.lastID, `Created ${name}`, req.user.role);
      res.json({ id: this.lastID });
    }
  );
});

app.put('/inventory-items/:id', authenticateToken, isAdmin, (req, res) => {
  const { name, description, category, total_stock, current_stock, min_level, reorder_threshold, unit, price_per_unit, status } = req.body;
  const id = req.params.id;
  if (current_stock > total_stock) {
    return res.status(400).send('Current stock cannot exceed total stock');
  }
  db.run("UPDATE inventory_items SET name = ?, description = ?, category = ?, total_stock = ?, current_stock = ?, min_level = ?, reorder_threshold = ?, unit = ?, price_per_unit = ?, status = ? WHERE id = ?",
    [name, description || '', category || 'consumables', total_stock || 0, current_stock || 0, min_level || 0, reorder_threshold || 10, unit || 'unit', price_per_unit || 0.0, status || 'active', id], function(err) {
      if (err) return res.status(500).send('Error updating inventory item');
      if (this.changes === 0) return res.status(404).send('Inventory item not found');
      logActivity('update', 'inventory_item', id, `Updated ${name}`, req.user.role);
      res.json({ updated: true });
    }
  );
});

app.delete('/inventory-items/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM inventory_items WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting inventory item');
    if (this.changes === 0) return res.status(404).send('Inventory item not found');
    logActivity('delete', 'inventory_item', id, '', req.user.role);
    res.json({ deleted: true });
  });
});

// Stock transactions (protected, admin for create)
app.get('/stock-transactions', authenticateToken, (req, res) => {
  const itemId = req.query.item_id;
  let sql = "SELECT st.*, i.name as item_name FROM stock_transactions st JOIN inventory_items i ON st.item_id = i.id";
  let params = [];
  if (itemId) {
    sql += " WHERE st.item_id = ?";
    params.push(itemId);
  }
  sql += " ORDER BY st.transaction_date DESC";
  db.all(sql, params, (err, results) => {
    if (err) return res.status(500).send('Error fetching stock transactions');
    res.json(results);
  });
});

app.post('/stock-transactions', authenticateToken, isAdmin, (req, res) => {
  const { item_id, type, quantity, reason } = req.body;
  if (!item_id || !type || quantity === undefined) {
    return res.status(400).send('item_id, type, and quantity required');
  }
  // Get current stock
  db.get("SELECT current_stock FROM inventory_items WHERE id = ?", [item_id], (err, item) => {
    if (err || !item) {
      return res.status(404).send('Inventory item not found');
    }
    let newStock = item.current_stock;
    let delta = 0;
    if (type === 'in') {
      delta = Math.abs(quantity);
      newStock += delta;
    } else if (type === 'out') {
      delta = -Math.abs(quantity);
      if (newStock + delta < 0) {
        return res.status(400).send('Cannot reduce stock below 0');
      }
      newStock += delta;
    } else if (type === 'adjust') {
      delta = quantity; // signed
      if (newStock + delta < 0) {
        return res.status(400).send('Adjusted stock cannot be below 0');
      }
      newStock += delta;
    }
    // Insert transaction
    db.run("INSERT INTO stock_transactions (item_id, type, quantity, reason) VALUES (?, ?, ?, ?)",
      [item_id, type, quantity, reason || ''], function(err) {
        if (err) return res.status(500).send('Error creating stock transaction');
        const transId = this.lastID;
        // Update stock
        db.run("UPDATE inventory_items SET current_stock = ? WHERE id = ?", [newStock, item_id], (err) => {
          if (err) return res.status(500).send('Error updating stock');
        });
        logActivity('stock_transaction', 'stock_transaction', transId, `${type} ${Math.abs(quantity)} of item ${item_id}, reason: ${reason || 'N/A'}`, req.user.role);
        res.json({ id: transId, new_stock: newStock });
      }
    );
  });
});

// Low stock alerts (protected)
app.get('/inventory/alerts', authenticateToken, (req, res) => {
  db.all(`
    SELECT * FROM inventory_items
    WHERE current_stock <= min_level AND status = 'active'
    ORDER BY current_stock ASC
  `, (err, results) => {
    if (err) return res.status(500).send('Error fetching alerts');
    res.json(results);
  });
});

// Allocate accessory to booking or conference (protected)

// Allocate accessory to booking or conference (protected)
app.post('/accessories/allocate', authenticateToken, (req, res) => {
  const { accessory_id, quantity = 1, booking_id, conference_booking_id } = req.body;

  if (quantity < 1) {
    return res.status(400).send('Quantity must be at least 1');
  }

  // Validate exactly one booking type
  const hasBooking = booking_id !== undefined;
  const hasConfBooking = conference_booking_id !== undefined;
  if ((hasBooking && hasConfBooking) || (!hasBooking && !hasConfBooking)) {
    return res.status(400).send('Exactly one of booking_id or conference_booking_id must be provided');
  }

  // Check booking/conference exists and is active
  const entityType = hasBooking ? 'booking' : 'conference_booking';
  const entityId = hasBooking ? booking_id : conference_booking_id;
  const statusCheck = hasBooking ? "status = 'checked_in'" : "status = 'active'";
  const table = hasBooking ? 'bookings' : 'conference_bookings';
  db.get(`SELECT id FROM ${table} WHERE id = ? AND ${statusCheck}`, [entityId], (err, entity) => {
    if (err || !entity) {
      return res.status(404).send(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found or not active`);
    }

    // Check accessory and stock
    db.get("SELECT name, available_stock FROM accessories WHERE id = ?", [accessory_id], (err, accessory) => {
      if (err || !accessory) {
        return res.status(404).send('Accessory not found');
      }
      if (accessory.available_stock < quantity) {
        return res.status(400).send(`Insufficient stock. Available: ${accessory.available_stock}, Requested: ${quantity}`);
      }

      const entityField = hasBooking ? 'booking_id' : 'conference_booking_id';

      // Insert allocation
      db.run(
        `INSERT INTO accessory_allocations (accessory_id, ${entityField}, quantity, status) VALUES (?, ?, ?, ?)`,
        [accessory_id, entityId, quantity, 'allocated'],
        function(err) {
          if (err) return res.status(500).send('Error creating allocation');
          const allocationId = this.lastID;

          // Update stock
          db.run("UPDATE accessories SET available_stock = available_stock - ? WHERE id = ?", [quantity, accessory_id], (err) => {
            if (err) return res.status(500).send('Error updating stock');
          });

          // Log
          const description = `Allocated ${quantity} ${accessory.name} to ${entityType} ${entityId}`;
          logActivity('allocate', 'accessory_allocation', allocationId, description, req.user.role);

          res.json({ id: allocationId, message: 'Accessory allocated successfully' });
        }
      );
    });
  });
});

// Return accessory (protected)
app.post('/accessories/return', authenticateToken, (req, res) => {
  const { allocation_id } = req.body;

  if (!allocation_id) {
    return res.status(400).send('allocation_id is required');
  }

  // Get allocation details, check status 'allocated'
  db.get(`
    SELECT aa.id, aa.accessory_id, aa.quantity, a.name
    FROM accessory_allocations aa
    JOIN accessories a ON aa.accessory_id = a.id
    WHERE aa.id = ? AND aa.status = 'allocated'
  `, [allocation_id], (err, allocation) => {
    if (err || !allocation) {
      return res.status(404).send('Allocated accessory not found');
    }

    // Update allocation to returned
    db.run(
      "UPDATE accessory_allocations SET status = 'returned', return_date = CURRENT_TIMESTAMP WHERE id = ?",
      [allocation_id],
      function(err) {
        if (err) return res.status(500).send('Error updating allocation');
        if (this.changes === 0) return res.status(404).send('Allocation not found');

        // Restore available stock
        db.run(
          "UPDATE accessories SET available_stock = available_stock + ? WHERE id = ?",
          [allocation.quantity, allocation.accessory_id],
          (err) => {
            if (err) return res.status(500).send('Error updating stock');
          }
        );

        // Log activity
        const description = `Returned ${allocation.quantity} ${allocation.name}`;
        logActivity('return', 'accessory_allocation', allocation_id, description, req.user.role);

        res.json({ message: 'Accessory returned successfully' });
      }
    );
  });
});

// Mark accessory as lost (protected)
app.post('/accessories/lost', authenticateToken, (req, res) => {
  const { allocation_id } = req.body;

  if (!allocation_id) {
    return res.status(400).send('allocation_id is required');
  }

  // Get allocation details, check status 'allocated'
  db.get(`
    SELECT aa.id, aa.accessory_id, aa.quantity, a.name, a.total_stock
    FROM accessory_allocations aa
    JOIN accessories a ON aa.accessory_id = a.id
    WHERE aa.id = ? AND aa.status = 'allocated'
  `, [allocation_id], (err, allocation) => {
    if (err || !allocation) {
      return res.status(404).send('Allocated accessory not found');
    }

    // Update allocation to lost
    db.run(
      "UPDATE accessory_allocations SET status = 'lost' WHERE id = ?",
      [allocation_id],
      function(err) {
        if (err) return res.status(500).send('Error updating allocation');
        if (this.changes === 0) return res.status(404).send('Allocation not found');

        // Reduce total stock (lost items are removed from inventory)
        db.run(
          "UPDATE accessories SET total_stock = total_stock - ? WHERE id = ?",
          [allocation.quantity, allocation.accessory_id],
          (err) => {
            if (err) return res.status(500).send('Error updating stock');
          }
        );

        // Log activity
        const description = `Marked ${allocation.quantity} ${allocation.name} as lost`;
        logActivity('lost', 'accessory_allocation', allocation_id, description, req.user.role);

        res.json({ message: 'Accessory marked as lost' });
      }
    );
  });
});

// Mark accessory as damaged (protected)
app.post('/accessories/damaged', authenticateToken, (req, res) => {
  const { allocation_id } = req.body;

  if (!allocation_id) {
    return res.status(400).send('allocation_id is required');
  }

  // Get allocation details, check status 'allocated'
  db.get(`
    SELECT aa.id, aa.accessory_id, aa.quantity, a.name, a.total_stock
    FROM accessory_allocations aa
    JOIN accessories a ON aa.accessory_id = a.id
    WHERE aa.id = ? AND aa.status = 'allocated'
  `, [allocation_id], (err, allocation) => {
    if (err || !allocation) {
      return res.status(404).send('Allocated accessory not found');
    }

    // Update allocation to damaged
    db.run(
      "UPDATE accessory_allocations SET status = 'damaged' WHERE id = ?",
      [allocation_id],
      function(err) {
        if (err) return res.status(500).send('Error updating allocation');
        if (this.changes === 0) return res.status(404).send('Allocation not found');

        // Reduce total stock (damaged items are removed from inventory)
        db.run(
          "UPDATE accessories SET total_stock = total_stock - ? WHERE id = ?",
          [allocation.quantity, allocation.accessory_id],
          (err) => {
            if (err) return res.status(500).send('Error updating stock');
          }
        );

        // Log activity
        const description = `Marked ${allocation.quantity} ${allocation.name} as damaged`;
        logActivity('damaged', 'accessory_allocation', allocation_id, description, req.user.role);

        res.json({ message: 'Accessory marked as damaged' });
      }
    );
  });
});

// Get accessory allocations with joined data (protected)
app.get('/accessory-allocations', authenticateToken, (req, res) => {
  db.all(`
    SELECT aa.*,
           a.name as accessory_name, a.description,
           COALESCE(b.id, c.id) as entity_id,
           COALESCE(g.name, c.name) as entity_name,
           COALESCE(b.check_in_date, c.date) as entity_date,
           b.room_id, r.name as room_name,
           g.phone as guest_phone,
           CASE
             WHEN b.id IS NOT NULL THEN 'booking'
             WHEN c.id IS NOT NULL THEN 'conference_booking'
           END as entity_type
    FROM accessory_allocations aa
    JOIN accessories a ON aa.accessory_id = a.id
    LEFT JOIN bookings b ON aa.booking_id = b.id
    LEFT JOIN conference_bookings c ON aa.conference_booking_id = c.id
    LEFT JOIN guests g ON b.guest_id = g.id
    LEFT JOIN rooms r ON b.room_id = r.id
    ORDER BY aa.allocation_date DESC
  `, (err, results) => {
    if (err) return res.status(500).send('Error fetching accessory allocations');
    res.json(results);
  });
});

// CRUD for office usage (protected)
app.get('/office-usage', authenticateToken, (req, res) => {
  db.all("SELECT ou.*, u.username FROM office_usage ou LEFT JOIN users u ON (ou.user_type IN ('staff', 'admin') AND ou.user_id = u.id) LEFT JOIN guests g ON (ou.user_type = 'guest' AND ou.user_id = g.id) ORDER BY ou.start_time DESC", (err, results) => {
    if (err) return res.status(500).send('Error fetching office usage');
    res.json(results);
  });
});

app.post('/office-usage', authenticateToken, (req, res) => {
  const { user_id, user_type, start_time, end_time, purpose } = req.body;
  if (!user_id || !user_type || !['staff','admin','guest'].includes(user_type)) {
    return res.status(400).send('Invalid user_id or user_type');
  }
  db.run("INSERT INTO office_usage (user_id, user_type, start_time, end_time, purpose) VALUES (?, ?, ?, ?, ?)",
    [user_id, user_type, start_time || new Date().toISOString(), end_time, purpose || ''], function(err) {
      if (err) return res.status(500).send('Error creating office usage');
      logActivity('create', 'office_usage', this.lastID, `Usage by ${user_type} ${user_id}: ${purpose}`, req.user.role);
      res.json({ id: this.lastID });
    });
});

app.put('/office-usage/:id', authenticateToken, (req, res) => {
  const { end_time, purpose } = req.body;
  const id = req.params.id;
  let query = "UPDATE office_usage SET ";
  let params = [];
  if (end_time !== undefined) {
    query += "end_time = ?, ";
    params.push(end_time);
  }
  if (purpose !== undefined) {
    query += "purpose = ?, ";
    params.push(purpose);
  }
  if (params.length === 0) return res.status(400).send('No fields to update');
  query = query.slice(0, -2) + " WHERE id = ?";
  params.push(id);
  db.run(query, params, function(err) {
    if (err) return res.status(500).send('Error updating office usage');
    if (this.changes === 0) return res.status(404).send('Office usage not found');
    logActivity('update', 'office_usage', id, '', req.user.role);
    res.json({ updated: true });
  });
});

app.delete('/office-usage/:id', authenticateToken, isAdmin, (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM office_usage WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting office usage');
    if (this.changes === 0) return res.status(404).send('Office usage not found');
    logActivity('delete', 'office_usage', id, '', req.user.role);
    res.json({ deleted: true });
  });
});

// Get activity logs (protected)
app.get('/logs', authenticateToken, (req, res) => {
  db.all("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 50", (err, results) => {
    if (err) return res.status(500).send('Error fetching logs');
    res.json(results);
  });
});

// Serve frontend
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});


// Close db on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error(err.message);
    console.log('✅ SQLite connection closed');
    process.exit(0);
  });
});

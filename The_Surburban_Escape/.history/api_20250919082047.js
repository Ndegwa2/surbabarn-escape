const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

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
  initializeDatabase();
});

// Initialize database tables
function initializeDatabase() {
  // Create guests table if not exists
  db.run(`
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
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      base_rate REAL NOT NULL,
      status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance'))
    )
  `);

  // Create bookings table if not exists
  db.run(`
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

  // Create activity_logs table if not exists
  db.run(`
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

  // Seed initial rooms data from data.json if rooms table is empty
  db.get("SELECT COUNT(*) as count FROM rooms", (err, row) => {
    if (row && row.count === 0) {
      const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
      const bedrooms = data.bedrooms;
      for (const [key, room] of Object.entries(bedrooms)) {
        const baseRate = key.startsWith('ensuite') ? 100.00 : 80.00; // Sample rates
        db.run(
          "INSERT INTO rooms (name, type, base_rate, status) VALUES (?, ?, ?, ?)",
          [room.name, room.type, baseRate, room.status]
        );
      }
      console.log('✅ Seeded initial rooms data');
    }
  });
}

// Helper to log activity
function logActivity(action, entityType, entityId, description = '') {
  db.run(
    "INSERT INTO activity_logs (action, entity_type, entity_id, description) VALUES (?, ?, ?, ?)",
    [action, entityType, entityId, description]
  );
}

// Check-in route: Create guest and booking
app.post('/checkin', (req, res) => {
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
              logActivity('checkin', 'guest', guestId, `Checked in to room ${roomName}`);
              logActivity('checkin', 'booking', this.lastID);
              console.log('✅ Guest checked in:', name);
              res.status(200).send('Guest checked in successfully');
            }
          );
        });
      });
    }
  );
});

// Checkout route: Update booking status, room status
app.post('/checkout/:id', (req, res) => {
  const guestId = req.params.id;
  db.get("SELECT b.id as booking_id, b.room_id, b.status FROM bookings b JOIN guests g ON b.guest_id = g.id WHERE g.id = ? AND b.status = 'checked_in'", [guestId], (err, booking) => {
    if (err || !booking) {
      return res.status(500).send('Booking not found or not checked in');
    }
    db.run("UPDATE bookings SET status = 'checked_out' WHERE id = ?", [booking.booking_id]);
    db.run("UPDATE rooms SET status = 'available' WHERE id = ?", [booking.room_id]);
    db.run("UPDATE guests SET status = 'Checked Out' WHERE id = ?", [guestId]);
    logActivity('checkout', 'booking', booking.booking_id, 'Checked out');
    console.log('✅ Guest checked out. ID:', guestId);
    res.status(200).send('Guest checked out successfully');
  });
});

// Get all guests with booking info
app.get('/guests', (req, res) => {
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

// CRUD for rooms
app.get('/rooms', (req, res) => {
  db.all("SELECT * FROM rooms", (err, results) => {
    if (err) return res.status(500).send('Error fetching rooms');
    res.json(results);
  });
});

app.post('/rooms', (req, res) => {
  const { name, type, base_rate, status } = req.body;
  db.run("INSERT INTO rooms (name, type, base_rate, status) VALUES (?, ?, ?, ?)", 
    [name, type, base_rate, status], function(err) {
      if (err) return res.status(500).send('Error creating room');
      logActivity('create', 'room', this.lastID);
      res.json({ id: this.lastID });
    }
  );
});

app.put('/rooms/:id', (req, res) => {
  const { name, type, base_rate, status } = req.body;
  const id = req.params.id;
  db.run("UPDATE rooms SET name = ?, type = ?, base_rate = ?, status = ? WHERE id = ?", 
    [name, type, base_rate, status, id], function(err) {
      if (err) return res.status(500).send('Error updating room');
      if (this.changes === 0) return res.status(404).send('Room not found');
      logActivity('update', 'room', id);
      res.json({ updated: true });
    }
  );
});

app.delete('/rooms/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM rooms WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting room');
    if (this.changes === 0) return res.status(404).send('Room not found');
    logActivity('delete', 'room', id);
    res.json({ deleted: true });
  });
});

// CRUD for bookings
app.get('/bookings', (req, res) => {
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

app.post('/bookings', (req, res) => {
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
        logActivity('create', 'booking', this.lastID);
        res.json({ id: this.lastID });
      }
    );
  });
});

app.put('/bookings/:id', (req, res) => {
  const { status, check_out_date } = req.body;
  const id = req.params.id;
  if (status === 'checked_out' && check_out_date) {
    // Update total price if needed, but assume fixed
    db.run("UPDATE bookings SET status = ?, check_out_date = ? WHERE id = ?", [status, check_out_date, id], function(err) {
      if (err) return res.status(500).send('Error updating booking');
      if (this.changes === 0) return res.status(404).send('Booking not found');
      // Update room status
      db.run("UPDATE rooms SET status = 'available' WHERE id IN (SELECT room_id FROM bookings WHERE id = ?)", [id]);
      logActivity('update', 'booking', id, `Status to ${status}`);
      res.json({ updated: true });
    });
  } else {
    db.run("UPDATE bookings SET status = ? WHERE id = ?", [status, id], function(err) {
      if (err) return res.status(500).send('Error updating booking');
      if (this.changes === 0) return res.status(404).send('Booking not found');
      logActivity('update', 'booking', id, `Status to ${status}`);
      res.json({ updated: true });
    });
  }
});

app.delete('/bookings/:id', (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM bookings WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).send('Error deleting booking');
    if (this.changes === 0) return res.status(404).send('Booking not found');
    // Restore room if cancelled
    db.run("UPDATE rooms SET status = 'available' WHERE id IN (SELECT room_id FROM bookings WHERE id = ?)", [id]);
    logActivity('delete', 'booking', id, 'Cancelled');
    res.json({ deleted: true });
  });
});

// Get activity logs
app.get('/logs', (req, res) => {
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

app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});

// Close db on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error(err.message);
    console.log('✅ SQLite connection closed');
    process.exit(0);
  });
});

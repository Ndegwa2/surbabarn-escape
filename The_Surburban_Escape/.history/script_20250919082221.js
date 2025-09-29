document.addEventListener('DOMContentLoaded', function () {
  const loginSection = document.getElementById('loginSection');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const checkinForm = document.getElementById('checkinForm');
  const addRoomForm = document.getElementById('addRoomForm');
  const addBookingForm = document.getElementById('addBookingForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const userRoleSpan = document.getElementById('userRole');
  const roomsSection = document.getElementById('roomsSection');
  const bookingsSection = document.getElementById('bookingsSection');
  const guestTableBody = document.querySelector('#guestTable tbody');
  const roomTableBody = document.querySelector('#roomTable tbody');
  const bookingTableBody = document.querySelector('#bookingTable tbody');
  const logTableBody = document.querySelector('#logTable tbody');
  const calendarTableBody = document.querySelector('#calendarTable tbody');

  let token = localStorage.getItem('token');
  let userRole = localStorage.getItem('role');

  // Check if already logged in
  if (token && userRole) {
    loginSection.style.display = 'none';
    dashboard.style.display = 'block';
    userRoleSpan.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
    if (userRole === 'admin') {
      roomsSection.style.display = 'block';
      bookingsSection.style.display = 'block';
    }
    loadAllData();
  }

  // Helper to get auth headers
  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Generic fetch helper
  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      }
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }

  // Load all data
  async function loadAllData() {
    try {
      await Promise.all([
        loadGuests(),
        loadRooms(),
        loadBookings(),
        loadLogs(),
        loadCalendar(),
        loadOccupancy()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
      alert('Failed to load data. Please refresh.');
    }
  }

  // Load guests
  async function loadGuests() {
    const guests = await apiFetch('/guests');
    guestTableBody.innerHTML = '';
    guests.forEach(guest => {
      const row = guestTableBody.insertRow();
      row.insertCell(0).textContent = guest.name;
      row.insertCell(1).textContent = guest.phone;
      row.insertCell(2).textContent = guest.email || '';
      row.insertCell(3).textContent = guest.idNumber || '';
      row.insertCell(4).textContent = guest.room;
      row.insertCell(5).textContent = guest.check_in_date || '';
      const statusCell = row.insertCell(6);
      statusCell.innerHTML = guest.booking_status === 'checked_in'
        ? '<span style="color:green;font-weight:bold;">🟢 Checked In</span>'
        : guest.booking_status === 'checked_out' ? '<span style="color:orange;font-weight:bold;">🟡 Checked Out</span>' : '<span style="color:red;">🔴 Other</span>';
      const actionsCell = row.insertCell(7);
      if (guest.booking_status === 'checked_in') {
        actionsCell.innerHTML = `<button onclick="checkout(${guest.id})">Check Out</button>`;
      } else {
        actionsCell.innerHTML = '—';
      }
    });
  }

  // Checkout function
  window.checkout = async function(guestId) {
    if (!confirm('Check out this guest?')) return;
    try {
      const response = await fetch(`/checkout/${guestId}`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        loadGuests();
        loadOccupancy();
      } else {
        alert('Error checking out guest');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Network error');
    }
  };

  // Load rooms
  async function loadRooms() {
    const rooms = await apiFetch('/rooms');
    roomTableBody.innerHTML = '';
    rooms.forEach(room => {
      const row = roomTableBody.insertRow();
      row.insertCell(0).textContent = room.id;
      row.insertCell(1).textContent = room.name;
      row.insertCell(2).textContent = room.type;
      row.insertCell(3).textContent = `$${room.base_rate}`;
      row.insertCell(4).textContent = room.status;
      const actionsCell = row.insertCell(5);
      actionsCell.innerHTML = `
        <button class="btn-edit" onclick="editRoom(${room.id}, '${room.name}', '${room.type}', ${room.base_rate}, '${room.status}')">Edit</button>
        <button class="btn-delete" onclick="deleteRoom(${room.id})">Delete</button>
      `;
    });
  }

  // Edit room (simple prompt for now)
  window.editRoom = async function(id, name, type, rate, status) {
    const newName = prompt('New name:', name);
    const newType = prompt('New type:', type);
    const newRate = prompt('New rate:', rate);
    const newStatus = prompt('New status:', status);
    if (newName && newType && newRate && newStatus) {
      try {
        await apiFetch(`/rooms/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: newName, type: newType, base_rate: parseFloat(newRate), status: newStatus })
        });
        loadRooms();
      } catch (err) {
        alert('Error updating room');
      }
    }
  };

  // Delete room
  window.deleteRoom = async function(id) {
    if (!confirm('Delete this room?')) return;
    try {
      await apiFetch(`/rooms/${id}`, { method: 'DELETE' });
      loadRooms();
    } catch (err) {
      alert('Error deleting room');
    }
  };

  // Load bookings
  async function loadBookings() {
    const bookings = await apiFetch('/bookings');
    bookingTableBody.innerHTML = '';
    bookings.forEach(booking => {
      const row = bookingTableBody.insertRow();
      row.insertCell(0).textContent = booking.id;
      row.insertCell(1).textContent = booking.guest_name;
      row.insertCell(2).textContent = booking.room_name;
      row.insertCell(3).textContent = booking.check_in_date;
      row.insertCell(4).textContent = booking.check_out_date;
      row.insertCell(5).textContent = booking.status;
      row.insertCell(6).textContent = `$${booking.total_price}`;
      const actionsCell = row.insertCell(7);
      actionsCell.innerHTML = `
        <button class="btn-edit" onclick="editBooking(${booking.id}, '${booking.status}')">Edit Status</button>
        <button class="btn-delete" onclick="deleteBooking(${booking.id})">Delete</button>
      `;
    });
  }

  // Edit booking status
  window.editBooking = async function(id, status) {
    const newStatus = prompt('New status:', status);
    if (newStatus) {
      try {
        await apiFetch(`/bookings/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
        loadBookings();
        loadOccupancy();
      } catch (err) {
        alert('Error updating booking');
      }
    }
  };

  // Delete booking
  window.deleteBooking = async function(id) {
    if (!confirm('Cancel this booking?')) return;
    try {
      await apiFetch(`/bookings/${id}`, { method: 'DELETE' });
      loadBookings();
      loadOccupancy();
    } catch (err) {
      alert('Error deleting booking');
    }
  };

  // Load logs
  async function loadLogs() {
    const logs = await apiFetch('/logs');
    logTableBody.innerHTML = '';
    logs.forEach(log => {
      const row = logTableBody.insertRow();
      row.insertCell(0).textContent = log.timestamp;
      row.insertCell(1).textContent = log.user_role;
      row.insertCell(2).textContent = log.action;
      row.insertCell(3).textContent = `${log.entity_type} #${log.entity_id}`;
      row.insertCell(4).textContent = log.description;
    });
  }

  // Load calendar (today's bookings)
  async function loadCalendar() {
    const bookings = await apiFetch('/bookings');
    const today = new Date().toISOString().split('T')[0];
    const todaysBookings = bookings.filter(b => b.check_in_date === today || b.check_out_date === today);
    calendarTableBody.innerHTML = '';
    todaysBookings.forEach(booking => {
      const row = calendarTableBody.insertRow();
      row.insertCell(0).textContent = booking.room_name;
      row.insertCell(1).textContent = booking.check_in_date;
      row.insertCell(2).textContent = booking.check_out_date;
      row.insertCell(3).textContent = booking.guest_name;
      row.insertCell(4).textContent = booking.status;
    });
  }

  // Load occupancy
  async function loadOccupancy() {
    const bookings = await apiFetch('/bookings');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const todayCheckins = bookings.filter(b => b.check_in_date === todayStr && b.status === 'checked_in');
    const todayCheckouts = bookings.filter(b => b.check_out_date === todayStr && b.status === 'checked_out');
    const inHouse = bookings.filter(b => b.status === 'checked_in');
    const lateCheckouts = inHouse.filter(b => new Date(b.check_out_date) < today);

    document.getElementById('todayCheckins').innerHTML = todayCheckins.map(b => `<div>${b.guest_name} to ${b.room_name}</div>`).join('');
    document.getElementById('todayCheckouts').innerHTML = todayCheckouts.map(b => `<div>${b.guest_name} from ${b.room_name}</div>`).join('');
    document.getElementById('inHouse').innerHTML = inHouse.map(b => `<div>${b.guest_name} in ${b.room_name}</div>`).join('');
    document.getElementById('lateCheckouts').innerHTML = lateCheckouts.map(b => `<div>${b.guest_name} overdue from ${b.room_name}</div>`).join('');
  }

  // Login handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!response.ok) {
        const data = await response.json();
        errorEl.textContent = data || 'Login failed';
        errorEl.style.display = 'block';
        return;
      }
      const data = await response.json();
      token = data.token;
      userRole = data.role;
      localStorage.setItem('token', token);
      localStorage.setItem('role', userRole);
      loginSection.style.display = 'none';
      dashboard.style.display = 'block';
      userRoleSpan.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
      if (userRole === 'admin') {
        roomsSection.style.display = 'block';
        bookingsSection.style.display = 'block';
      }
      errorEl.style.display = 'none';
      loadAllData();
    } catch (err) {
      console.error('Login error:', err);
      errorEl.textContent = 'Network error';
      errorEl.style.display = 'block';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    token = null;
    userRole = null;
    dashboard.style.display = 'none';
    loginSection.style.display = 'block';
    roomsSection.style.display = 'none';
    bookingsSection.style.display = 'none';
  });

  // Check-in form
  checkinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      name: document.getElementById('name').value,
      phone: document.getElementById('phone').value,
      email: document.getElementById('email').value,
      idNumber: document.getElementById('idNumber').value,
      roomName: document.getElementById('roomName').value,
      checkInDate: document.getElementById('checkInDate').value,
      checkOutDate: document.getElementById('checkOutDate').value
    };

    try {
      const response = await fetch('/checkin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        checkinForm.reset();
        loadGuests();
        loadOccupancy();
        loadCalendar();
      } else {
        alert('Error checking in guest');
      }
    } catch (err) {
      console.error('Checkin error:', err);
      alert('Network error');
    }
  });

  // Add room form (admin)
  addRoomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      name: document.getElementById('roomNameAdd').value,
      type: document.getElementById('roomType').value,
      base_rate: parseFloat(document.getElementById('baseRate').value),
      status: document.getElementById('roomStatus').value
    };

    try {
      await apiFetch('/rooms', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      addRoomForm.reset();
      loadRooms();
    } catch (err) {
      alert('Error adding room');
    }
  });

  // Add booking form (admin)
  addBookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      guest_id: parseInt(document.getElementById('guestId').value),
      room_id: parseInt(document.getElementById('roomId').value),
      check_in_date: document.getElementById('bookingCheckIn').value,
      check_out_date: document.getElementById('bookingCheckOut').value,
      status: document.getElementById('bookingStatus').value
    };

    try {
      await apiFetch('/bookings', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      addBookingForm.reset();
      loadBookings();
      loadOccupancy();
      loadCalendar();
    } catch (err) {
      alert('Error creating booking');
    }
  });
});
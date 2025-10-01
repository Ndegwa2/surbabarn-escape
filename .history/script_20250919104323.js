document.addEventListener('DOMContentLoaded', function () {
  // Modal close functionality
  const modal = document.getElementById('itemDetailsModal');
  const closeBtn = document.querySelector('.close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Office usage modal
  const usageModal = document.getElementById('addUsageModal');
  const addUsageBtn = document.getElementById('addUsageBtn');
  const closeUsageModal = document.getElementById('closeUsageModal');
  if (addUsageBtn) {
    addUsageBtn.addEventListener('click', () => {
      usageModal.style.display = 'flex';
    });
  }
  if (closeUsageModal) {
    closeUsageModal.addEventListener('click', () => {
      usageModal.style.display = 'none';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === usageModal) {
      usageModal.style.display = 'none';
    }
  });

  // Add usage form
  const addUsageForm = document.getElementById('addUsageForm');
  if (addUsageForm) {
    addUsageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = {
        user_id: parseInt(document.getElementById('usageUserId').value),
        user_type: document.getElementById('usageUserType').value,
        start_time: document.getElementById('usageStartTime').value,
        end_time: document.getElementById('usageEndTime').value,
        purpose: document.getElementById('usagePurpose').value
      };
      try {
        await apiFetch('/office-usage', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        addUsageForm.reset();
        usageModal.style.display = 'none';
        loadOfficeUsage();
      } catch (err) {
        alert('Error adding office usage');
      }
    });
  }
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
  const conferencesSection = document.getElementById('conferencesSection');
  const conferenceBookingsSection = document.getElementById('conferenceBookingsSection');
  const guestTableBody = document.querySelector('#guestTable tbody');
  const roomTableBody = document.querySelector('#roomTable tbody');
  const bookingTableBody = document.querySelector('#bookingTable tbody');
  const confTableBody = document.querySelector('#confTable tbody');
  const conferenceBookingTableBody = document.querySelector('#conferenceBookingTable tbody');
  const logTableBody = document.querySelector('#logTable tbody');
  const calendarTableBody = document.querySelector('#calendarTable tbody');

  // Inventory elements
  const inventorySection = document.getElementById('inventorySection');
  const addInventoryForm = document.getElementById('addInventoryForm');
  const inventoryTableBody = document.querySelector('#inventoryTable tbody');
  const stockTransactionForm = document.getElementById('stockTransactionForm');
  const transactionsTableBody = document.querySelector('#transactionsTable tbody');
  const alertsTableBody = document.querySelector('#alertsTable tbody');
  const transactionItemId = document.getElementById('transactionItemId');

  let token = localStorage.getItem('token');
  let userRole = localStorage.getItem('role');

  // Check if already logged in
  if (token && userRole) {
    const userSection = document.getElementById('userSection');
    loginSection.style.display = 'none';
    dashboard.style.display = 'block';
    userSection.style.display = 'flex';
    userRoleSpan.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
    if (userRole === 'admin') {
      roomsSection.style.display = 'block';
      bookingsSection.style.display = 'block';
      conferencesSection.style.display = 'block';
      conferenceBookingsSection.style.display = 'block';
      inventorySection.style.display = 'block';
      document.querySelector('.card:nth-of-type(3)').style.display = 'block'; // Housekeeping panel
      officeUsageSection.style.display = 'block';
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
        loadRoomsKanban(),
        loadBookings(),
        loadConferences(),
        loadConferenceBookings(),
        loadInventory(),
        loadTransactions(),
        loadAlerts(),
        loadLogs(),
        loadCalendar(),
        loadOccupancy(),
        loadHousekeeping(),
        loadOfficeUsage()
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
  
  // Load conferences
  async function loadConferences() {
    const conferences = await apiFetch('/conferences');
    confTableBody.innerHTML = '';
    conferences.forEach(conf => {
      const row = confTableBody.insertRow();
      row.insertCell(0).textContent = conf.id;
      row.insertCell(1).textContent = conf.name;
      row.insertCell(2).textContent = conf.capacity;
      row.insertCell(3).textContent = conf.equipment || '';
      row.insertCell(4).textContent = `$${conf.hourly_rate}`;
      row.insertCell(5).textContent = `$${conf.daily_rate}`;
      row.insertCell(6).textContent = conf.status;
      const actionsCell = row.insertCell(7);
      actionsCell.innerHTML = `
        <button class="btn-edit" onclick="editConference(${conf.id}, '${conf.name.replace(/'/g, "\\'")}', ${conf.capacity}, ${JSON.stringify(conf.equipment)}, ${conf.hourly_rate}, ${conf.daily_rate}, '${conf.status.replace(/'/g, "\\'")}')">Edit</button>
        <button class="btn-delete" onclick="deleteConference(${conf.id})">Delete</button>
      `;
    });
  }
  
  // Load conference bookings
  async function loadConferenceBookings() {
    const bookings = await apiFetch('/conference-bookings');
    conferenceBookingTableBody.innerHTML = '';
    bookings.forEach(booking => {
      const row = conferenceBookingTableBody.insertRow();
      row.insertCell(0).textContent = booking.id;
      row.insertCell(1).textContent = booking.facility_name;
      row.insertCell(2).textContent = booking.name;
      row.insertCell(3).textContent = booking.date;
      row.insertCell(4).textContent = booking.start_time;
      row.insertCell(5).textContent = booking.end_time;
      row.insertCell(6).textContent = booking.attendees || 1;
      row.insertCell(7).textContent = booking.status;
      row.insertCell(8).textContent = `$${booking.deposit}`;
      row.insertCell(9).textContent = `$${booking.total_price}`;
      const actionsCell = row.insertCell(10);
      actionsCell.innerHTML = `
        <button class="btn-edit" onclick="editConferenceBooking(${booking.id}, '${booking.status}')">Edit Status</button>
        <button class="btn-delete" onclick="deleteConferenceBooking(${booking.id})">Delete</button>
      `;
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

  // Load rooms kanban
  async function loadRoomsKanban() {
    const rooms = await apiFetch('/rooms');
    const availableRooms = document.getElementById('availableRooms');
    const occupiedRooms = document.getElementById('occupiedRooms');
    const dirtyRooms = document.getElementById('dirtyRooms');
    const maintenanceRooms = document.getElementById('maintenanceRooms');

    availableRooms.innerHTML = '';
    occupiedRooms.innerHTML = '';
    dirtyRooms.innerHTML = '';
    maintenanceRooms.innerHTML = '';

    rooms.forEach(room => {
      let targetColumn, housekeepingState = room.housekeeping_state || 'clean';
      if (room.status === 'occupied') {
        targetColumn = occupiedRooms;
      } else if (room.status === 'maintenance' || housekeepingState === 'maintenance') {
        targetColumn = maintenanceRooms;
      } else if (housekeepingState === 'dirty') {
        targetColumn = dirtyRooms;
      } else if (room.status === 'available' && housekeepingState === 'clean') {
        targetColumn = availableRooms;
      } else {
        targetColumn = dirtyRooms; // fallback
      }

      const item = document.createElement('div');
      item.className = 'room-card';
      item.dataset.roomId = room.id;
      item.innerHTML = `
        <div class="room-header">
          <h4 class="room-name">${room.name}</h4>
          <p class="room-details">${room.type} • <span class="rate-highlight">$${room.base_rate}</span></p>
        </div>
        <div class="badges">
          <span class="badge status-badge status-${room.status}">
            ${room.status === 'available' ? '🟢' : room.status === 'occupied' ? '🟦' : room.status === 'dirty' ? '🟡' : '🔧'} ${room.status.charAt(0).toUpperCase() + room.status.slice(1)}
          </span>
          <span class="badge hs-badge hs-${housekeepingState}">
            ${housekeepingState === 'clean' ? '🧹' : housekeepingState === 'dirty' ? '🚮' : '🛠'} ${housekeepingState.charAt(0).toUpperCase() + housekeepingState.slice(1)}
          </span>
        </div>
        <div class="action-bar">
          <button class="action-btn dirty-btn" onclick="updateHousekeepingState(${room.id}, 'dirty')" title="Mark Dirty">🚮</button>
          <button class="action-btn clean-btn" onclick="updateHousekeepingState(${room.id}, 'clean')" title="Mark Clean">🧹</button>
          <button class="action-btn maint-btn" onclick="updateHousekeepingState(${room.id}, 'maintenance')" title="Mark Maintenance">🛠</button>
        </div>
      `;
      targetColumn.appendChild(item);
    });
  }

  // Update housekeeping state
  window.updateHousekeepingState = async function(roomId, state) {
    if (!confirm(`Mark room as ${state}?`)) return;
    try {
      await apiFetch(`/rooms/${roomId}/housekeeping`, {
        method: 'POST',
        body: JSON.stringify({ housekeeping_state: state })
      });
      loadRoomsKanban();
      loadHousekeeping();
    } catch (err) {
      alert('Error updating housekeeping state');
    }
  };

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

  // Load housekeeping panel (dirty rooms)
  async function loadHousekeeping() {
    const rooms = await apiFetch('/rooms');
    const dirtyRooms = rooms.filter(room => (room.housekeeping_state || 'clean') === 'dirty');
    const housekeepingTableBody = document.querySelector('#housekeepingTable tbody');
    housekeepingTableBody.innerHTML = '';
    dirtyRooms.forEach(room => {
      const row = housekeepingTableBody.insertRow();
      row.insertCell(0).textContent = room.name;
      row.insertCell(1).textContent = room.housekeeping_state;
      const assignCell = row.insertCell(2);
      assignCell.innerHTML = `<input type="text" placeholder="Staff ID" class="assign-staff"> <button onclick="assignHousekeeping(${room.id}, this.previousElementSibling.value)">Assign</button>`;
      row.insertCell(3).innerHTML = `
        <button onclick="updateHousekeepingState(${room.id}, 'clean')">Mark Clean</button>
      `;
    });
  }

  // Assign housekeeping (simple, log or update)
  window.assignHousekeeping = async function(roomId, staffId) {
    if (!staffId) {
      alert('Enter staff ID');
      return;
    }
    // For now, just log; could add assignment table later
    alert(`Assigned staff ${staffId} to room ${roomId}`);
    loadHousekeeping();
  };

  // Load office usage
  async function loadOfficeUsage() {
    const usages = await apiFetch('/office-usage');
    const officeUsageTableBody = document.querySelector('#officeUsageTable tbody');
    officeUsageTableBody.innerHTML = '';
    usages.forEach(usage => {
      const row = officeUsageTableBody.insertRow();
      row.insertCell(0).textContent = usage.username || usage.guest_name || usage.user_id; // Approximate
      row.insertCell(1).textContent = usage.user_type;
      row.insertCell(2).textContent = usage.start_time;
      row.insertCell(3).textContent = usage.end_time || 'Ongoing';
      row.insertCell(4).textContent = usage.purpose || '';
      const actionsCell = row.insertCell(5);
      actionsCell.innerHTML = `
        <button class="btn-edit" onclick="editOfficeUsage(${usage.id})">Edit</button>
        <button class="btn-delete" onclick="deleteOfficeUsage(${usage.id})">Delete</button>
      `;
    });
  }

  // Edit office usage (end time or purpose)
  window.editOfficeUsage = async function(id) {
    const endTime = prompt('New end time (datetime-local):');
    const purpose = prompt('New purpose:');
    if (endTime || purpose) {
      try {
        await apiFetch(`/office-usage/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ end_time: endTime, purpose: purpose })
        });
        loadOfficeUsage();
      } catch (err) {
        alert('Error updating office usage');
      }
    }
  };

  // Delete office usage
  window.deleteOfficeUsage = async function(id) {
    if (!confirm('Delete this usage record?')) return;
    try {
      await apiFetch(`/office-usage/${id}`, { method: 'DELETE' });
      loadOfficeUsage();
    } catch (err) {
      alert('Error deleting office usage');
    }
  };

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

  // Load inventory items
  async function loadInventory() {
    const items = await apiFetch('/inventory-items');
    inventoryTableBody.innerHTML = '';
    // Populate transaction select
    transactionItemId.innerHTML = '<option value="">Select Item</option>';
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.current_stock} ${item.unit})`;
      transactionItemId.appendChild(option);

      const row = inventoryTableBody.insertRow();
      row.insertCell(0).textContent = item.id;
      row.insertCell(1).textContent = item.name;
      row.insertCell(2).textContent = item.description || '';
      row.insertCell(3).textContent = item.category;
      row.insertCell(4).textContent = item.total_stock;
      row.insertCell(5).textContent = item.current_stock;
      row.insertCell(6).textContent = item.min_level;
      row.insertCell(7).textContent = item.reorder_threshold;
      row.insertCell(8).textContent = item.unit;
      row.insertCell(9).textContent = `$${item.price_per_unit}`;
      row.insertCell(10).textContent = item.status;
      const actionsCell = row.insertCell(11);
      actionsCell.innerHTML = `
        <button onclick="viewItemDetails(${item.id})">View Details</button>
        <button class="btn-edit" onclick="editInventory(${item.id}, '${item.name.replace(/'/g, "\\'")}', '${(item.description || '').replace(/'/g, "\\'")}', '${item.category}', ${item.total_stock}, ${item.current_stock}, ${item.min_level}, ${item.reorder_threshold}, '${item.unit.replace(/'/g, "\\'")}', ${item.price_per_unit}, '${item.status.replace(/'/g, "\\'")}')">Edit</button>
        <button class="btn-delete" onclick="deleteInventory(${item.id})">Delete</button>
      `;
    });
  }

  // Load stock transactions
  async function loadTransactions() {
    const transactions = await apiFetch('/stock-transactions');
    transactionsTableBody.innerHTML = '';
    transactions.forEach(trans => {
      const row = transactionsTableBody.insertRow();
      row.insertCell(0).textContent = trans.id;
      row.insertCell(1).textContent = trans.item_name;
      row.insertCell(2).textContent = trans.type;
      row.insertCell(3).textContent = trans.quantity;
      row.insertCell(4).textContent = trans.reason || '';
      row.insertCell(5).textContent = trans.transaction_date;
    });
  }

  // Load low stock alerts
  async function loadAlerts() {
    const alerts = await apiFetch('/inventory/alerts');
    alertsTableBody.innerHTML = '';
    alerts.forEach(alert => {
      const row = alertsTableBody.insertRow();
      row.insertCell(0).textContent = alert.name;
      row.insertCell(1).textContent = alert.current_stock;
      row.insertCell(2).textContent = alert.min_level;
      row.style.backgroundColor = '#fff3cd'; // Warning color
    });
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
      const userSection = document.getElementById('userSection');
      loginSection.style.display = 'none';
      dashboard.style.display = 'block';
      userSection.style.display = 'flex';
      userRoleSpan.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
      if (userRole === 'admin') {
        roomsSection.style.display = 'block';
        bookingsSection.style.display = 'block';
        conferencesSection.style.display = 'block';
        conferenceBookingsSection.style.display = 'block';
        inventorySection.style.display = 'block';
        document.querySelector('.card:nth-of-type(3)').style.display = 'block'; // Housekeeping panel
        officeUsageSection.style.display = 'block';
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
    const userSection = document.getElementById('userSection');
    dashboard.style.display = 'none';
    userSection.style.display = 'none';
    loginSection.style.display = 'block';
    roomsSection.style.display = 'none';
    bookingsSection.style.display = 'none';
    conferencesSection.style.display = 'none';
    conferenceBookingsSection.style.display = 'none';
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

// Edit conference (simple prompt for now)
window.editConference = async function(id, name, capacity, equipment, hourly, daily, status) {
  const newName = prompt('New name:', name);
  const newCapacity = prompt('New capacity:', capacity);
  const newEquipment = prompt('New equipment (comma-separated):', equipment.join(', '));
  const newHourly = prompt('New hourly rate:', hourly);
  const newDaily = prompt('New daily rate:', daily);
  const newStatus = prompt('New status:', status);
  if (newName && newCapacity && newHourly && newDaily && newStatus) {
    try {
      await apiFetch(`/conferences/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: newName,
          capacity: parseInt(newCapacity),
          equipment: newEquipment.split(',').map(e => e.trim()),
          hourly_rate: parseFloat(newHourly),
          daily_rate: parseFloat(newDaily),
          status: newStatus
        })
      });
      loadConferences();
    } catch (err) {
      alert('Error updating conference');
    }
  }
};

// Delete conference
window.deleteConference = async function(id) {
  if (!confirm('Delete this conference facility?')) return;
  try {
    await apiFetch(`/conferences/${id}`, { method: 'DELETE' });
    loadConferences();
  } catch (err) {
    alert('Error deleting conference');
  }
};

// Edit conference booking status
window.editConferenceBooking = async function(id, status) {
  const newStatus = prompt('New status:', status);
  if (newStatus) {
    try {
      await apiFetch(`/conference-bookings/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      loadConferenceBookings();
    } catch (err) {
      alert('Error updating conference booking');
    }
  }
};

// Delete conference booking
window.deleteConferenceBooking = async function(id) {
  if (!confirm('Cancel this conference booking?')) return;
  try {
    await apiFetch(`/conference-bookings/${id}`, { method: 'DELETE' });
    loadConferenceBookings();
  } catch (err) {
    alert('Error deleting conference booking');
  }
};

// Edit inventory item
window.editInventory = async function(id, name, description, category, total_stock, current_stock, min_level, reorder_threshold, unit, price_per_unit, status) {
  const newName = prompt('New name:', name);
  const newDesc = prompt('New description:', description);
  const newCategory = prompt('New category (consumables/fixed_assets):', category);
  const newTotal = prompt('New total stock:', total_stock);
  const newCurrent = prompt('New current stock:', current_stock);
  const newMin = prompt('New min level:', min_level);
  const newReorder = prompt('New reorder threshold:', reorder_threshold);
  const newUnit = prompt('New unit:', unit);
  const newPrice = prompt('New price per unit:', price_per_unit);
  const newStatus = prompt('New status (active/inactive/discontinued):', status);
  if (newName && newCategory && newTotal !== null && newCurrent !== null && newMin !== null && newReorder !== null && newStatus) {
    try {
      await apiFetch(`/inventory-items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          category: newCategory,
          total_stock: parseInt(newTotal),
          current_stock: parseInt(newCurrent),
          min_level: parseInt(newMin),
          reorder_threshold: parseInt(newReorder),
          unit: newUnit,
          price_per_unit: parseFloat(newPrice) || 0,
          status: newStatus
        })
      });
      loadInventory();
      loadAlerts();
    } catch (err) {
      alert('Error updating inventory item');
    }
  }
};

// Delete inventory item
window.deleteInventory = async function(id) {
  if (!confirm('Delete this inventory item?')) return;
  try {
    await apiFetch(`/inventory-items/${id}`, { method: 'DELETE' });
    loadInventory();
    loadAlerts();
  } catch (err) {
    alert('Error deleting inventory item');
  }
};

// View item details
window.viewItemDetails = async function(id) {
  try {
    const item = await apiFetch('/inventory-items');
    const selectedItem = item.find(i => i.id === id);
    if (!selectedItem) return;

    // Populate item info
    document.getElementById('modalItemName').textContent = selectedItem.name;
    document.getElementById('modalDescription').textContent = selectedItem.description || 'N/A';
    document.getElementById('modalCategory').textContent = selectedItem.category;
    document.getElementById('modalTotalStock').textContent = selectedItem.total_stock;
    document.getElementById('modalUnit').textContent = selectedItem.unit;
    document.getElementById('modalUnit2').textContent = selectedItem.unit;
    document.getElementById('modalCurrentStock').textContent = selectedItem.current_stock;
    document.getElementById('modalMinLevel').textContent = selectedItem.min_level;
    document.getElementById('modalReorderThreshold').textContent = selectedItem.reorder_threshold;
    document.getElementById('modalPrice').textContent = selectedItem.price_per_unit;
    document.getElementById('modalStatus').textContent = selectedItem.status;

    // Fetch recent transactions for this item
    const transactions = await apiFetch(`/stock-transactions?item_id=${id}`);
    const modalTBody = document.querySelector('#modalTransactionsTable tbody');
    modalTBody.innerHTML = '';
    transactions.slice(0, 10).forEach(trans => { // Last 10 transactions
      const row = modalTBody.insertRow();
      row.insertCell(0).textContent = trans.type;
      row.insertCell(1).textContent = trans.quantity;
      row.insertCell(2).textContent = trans.reason || 'N/A';
      row.insertCell(3).textContent = trans.transaction_date;
    });

    // Show modal
    document.getElementById('itemDetailsModal').style.display = 'flex';
  } catch (err) {
    alert('Error loading item details');
  }
};

// Add conference form (admin)
const addConferenceForm = document.getElementById('addConferenceForm');
addConferenceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    name: document.getElementById('confName').value,
    capacity: parseInt(document.getElementById('confCapacity').value),
    equipment: document.getElementById('confEquipment').value.split(',').map(e => e.trim()),
    hourly_rate: parseFloat(document.getElementById('confHourly').value),
    daily_rate: parseFloat(document.getElementById('confDaily').value),
    status: document.getElementById('confStatus').value
  };

  try {
    await apiFetch('/conferences', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    addConferenceForm.reset();
    loadConferences();
  } catch (err) {
    alert('Error adding conference');
  }
});

// Add conference booking form (admin)
const addConferenceBookingForm = document.getElementById('addConferenceBookingForm');
addConferenceBookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    facility_id: parseInt(document.getElementById('confFacilityId').value),
    name: document.getElementById('confEventName').value,
    date: document.getElementById('confDate').value,
    start_time: document.getElementById('confStartTime').value,
    end_time: document.getElementById('confEndTime').value,
    attendees: parseInt(document.getElementById('confAttendees').value),
    deposit: parseFloat(document.getElementById('confDeposit').value),
    status: document.getElementById('confBookingStatus').value
  };

  try {
    const response = await apiFetch('/conference-bookings', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    addConferenceBookingForm.reset();
    loadConferenceBookings();
    generateConferencePDF(response.id, { ...formData, total_price: response.total_price });
  } catch (err) {
    alert('Error creating conference booking: ' + (err.message || 'Unknown error'));
  }
});

// Add inventory item form (admin)
addInventoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    name: document.getElementById('itemName').value,
    description: document.getElementById('itemDescription').value,
    category: document.getElementById('itemCategory').value,
    total_stock: parseInt(document.getElementById('totalStock').value),
    current_stock: parseInt(document.getElementById('currentStock').value),
    min_level: parseInt(document.getElementById('minLevel').value),
    reorder_threshold: parseInt(document.getElementById('reorderThreshold').value),
    unit: document.getElementById('itemUnit').value,
    price_per_unit: parseFloat(document.getElementById('pricePerUnit').value) || 0,
    status: document.getElementById('itemStatus').value
  };

  try {
    await apiFetch('/inventory-items', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    addInventoryForm.reset();
    loadInventory();
    loadAlerts();
  } catch (err) {
    alert('Error adding inventory item: ' + (err.message || 'Unknown error'));
  }
});

// Stock transaction form (admin)
stockTransactionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = {
    item_id: parseInt(document.getElementById('transactionItemId').value),
    type: document.getElementById('transactionType').value,
    quantity: parseInt(document.getElementById('transactionQuantity').value),
    reason: document.getElementById('transactionReason').value
  };

  if (formData.quantity <= 0) {
    alert('Quantity must be positive');
    return;
  }

  try {
    const response = await apiFetch('/stock-transactions', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    stockTransactionForm.reset();
    loadTransactions();
    loadInventory();
    loadAlerts();
    alert(`Transaction processed. New stock: ${response.new_stock}`);
  } catch (err) {
    alert('Error processing transaction: ' + (err.message || 'Unknown error'));
  }
});

// PDF Generation for Conference Bookings
function generateConferencePDF(bookingId, bookingData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('Conference Booking Confirmation', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Booking ID: ${bookingId}`, 20, 40);
  doc.text(`Event: ${bookingData.name}`, 20, 50);
  doc.text(`Facility ID: ${bookingData.facility_id}`, 20, 60);
  doc.text(`Date: ${bookingData.date}`, 20, 70);
  doc.text(`Time: ${bookingData.start_time} - ${bookingData.end_time}`, 20, 80);
  doc.text(`Attendees: ${bookingData.attendees}`, 20, 90);
  doc.text(`Deposit: $${bookingData.deposit}`, 20, 100);
  // Total price from response
  doc.text(`Total: $${bookingData.total_price || 'TBD'}`, 20, 110);
  
  doc.save(`Conference_Booking_${bookingId}.pdf`);
}
});

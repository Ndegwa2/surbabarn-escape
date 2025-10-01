document.addEventListener('DOMContentLoaded', function () {
// ===== Enhanced Modal controls =====
(function(){
  const modal = document.getElementById('itemDetailsModal');
  const dialog = modal.querySelector('.modal__dialog');

  function openModal(){
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    // Focus the dialog for a11y/ESC handling
    setTimeout(()=> dialog.focus(), 0);
  }
  function closeModal(){
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Hook up close triggers
  modal.addEventListener('click', (e)=>{
    if (e.target.matches('[data-close]')) closeModal();
  });
  // ESC to close
  modal.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') closeModal();
  });

  // Expose in case you want to call openModal() after populating fields
  window.InventoryDetailsModal = { open: openModal, close: closeModal };
})();

// ===== UI helpers: status badge + stock bar + copy =====
(function(){
  const statusEl = document.getElementById('modalStatus');
  function setStatus(status){
    const val = String(status || '').toLowerCase();
    statusEl.textContent = status || '—';
    statusEl.classList.remove('badge--ok','badge--warn','badge--danger');
    if (['ok','in stock','available','healthy'].some(k=>val.includes(k))) statusEl.classList.add('badge--ok');
    else if (['low','warning','reorder','depleting'].some(k=>val.includes(k))) statusEl.classList.add('badge--warn');
    else if (['out','critical','unavailable','damaged'].some(k=>val.includes(k))) statusEl.classList.add('badge--danger');
  }

  const fill = document.getElementById('stockBarFill');
  const pctLabel = document.getElementById('stockPctLabel');
  const legendCurrent = document.getElementById('legendCurrent');
  const legendTotal = document.getElementById('legendTotal');

  function setStock(current, total){
    const c = Number(current) || 0;
    const t = Math.max(Number(total) || 0, 0.0001);
    const pct = Math.round((c / t) * 100);
    fill.style.width = Math.min(Math.max(pct, 0), 100) + '%';
    pctLabel.textContent = pct + '%';
    legendCurrent.textContent = 'Current: ' + c;
    legendTotal.textContent = 'Total: ' + t;
  }

  // Copy button: copies all details neatly
  const copyBtn = document.getElementById('copyItemBtn');
  copyBtn?.addEventListener('click', async ()=>{
    const get = id => (document.getElementById(id)?.textContent ?? '').trim();
    const text = [
      `Item: ${get('modalItemName')}`,
      `Description: ${get('modalDescription')}`,
      `Category: ${get('modalCategory')}`,
      `Total Stock: ${get('modalTotalStock')} ${get('modalUnit')}`,
      `Current Stock: ${get('modalCurrentStock')} ${get('modalUnit2')}`,
      `Min Level: ${get('modalMinLevel')}`,
      `Reorder Threshold: ${get('modalReorderThreshold')}`,
      `Price per Unit: Ksh ${get('modalPrice')}`,
      `Status: ${get('modalStatus')}`
    ].join('\n');
    try{
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied ✔';
      setTimeout(()=> copyBtn.textContent = 'Copy', 1400);
    }catch{
      alert('Copy failed. You can still select and copy manually.');
    }
  });

  // Reorder button in modal
  const reorderBtn = document.getElementById('reorderBtn');
  reorderBtn?.addEventListener('click', async ()=>{
    const itemName = document.getElementById('modalItemName')?.textContent?.trim();
    if (!itemName) {
      alert('Item name not found');
      return;
    }
    // Call the reorder function with the item name
    await reorderItem(itemName);
  });

  // Expose helpers to your code
  window.InventoryDetailsUI = { setStatus, setStock };
})();

// Office usage modal show button
const addUsageBtn = document.getElementById('addUsageBtn');
if (addUsageBtn && usageModal) {
  addUsageBtn.addEventListener('click', () => {
    usageModal.show();
  });
}

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
        // Hide the form container after submission
        document.getElementById('addUsageFormContainer').style.display = 'none';
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
  const officeUsageSection = document.getElementById('officeUsageSection');

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
  let refreshInterval; // For real-time updates

  // Check if already logged in
  if (token && userRole) {
    // Validate token with server before showing dashboard
    fetch('/validate-token', {
      method: 'POST',
      headers: getAuthHeaders()
    }).then(response => {
      if (response.ok) {
        // Token is valid, show dashboard
        const userSection = document.getElementById('userSection');
        loginSection.style.display = 'none';
        dashboard.style.display = 'block';
        userSection.style.display = 'flex';
        userRoleSpan.textContent = userRole.charAt(0).toUpperCase() + userRole.slice(1);
        if (userRole === 'admin') {
          roomsSection.style.display = 'block';
          bookingsSection.style.display = 'block';
          // conferencesSection.style.display = 'block'; // Hidden complex admin sections
          // conferenceBookingsSection.style.display = 'block'; // Hidden complex admin sections
          // inventorySection.style.display = 'block'; // Hidden complex admin sections
          // Show the sections that should be visible to admin
          document.getElementById('guestsSection').style.display = 'block';
          document.getElementById('housekeepingSection').style.display = 'block';
          document.getElementById('calendarSection').style.display = 'block';
          document.getElementById('occupancySection').style.display = 'block';
          document.getElementById('activityLogSection').style.display = 'block';
          officeUsageSection.style.display = 'block';
        }
        loadAllData();
        // Start real-time updates for admin
        if (userRole === 'admin') {
          startRealTimeUpdates();
        }
      } else {
        // Token is invalid, clear localStorage and show login
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        token = null;
        userRole = null;
        loginSection.style.display = 'block';
      }
    }).catch(err => {
      // Network error, clear localStorage and show login
      console.error('Token validation error:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      token = null;
      userRole = null;
      loginSection.style.display = 'block';
    });
  } else {
    // If not logged in, ensure login section is visible
    loginSection.style.display = 'block';
  }

  // Helper to get auth headers
  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Generic table loading utility
  const TableManager = {
    // Load data into table with customizable row rendering
    loadTable: async function(endpoint, tableBodySelector, rowRenderer, options = {}) {
      try {
        const data = await apiFetch(endpoint);
        const tableBody = document.querySelector(tableBodySelector);
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (options.emptyMessage && data.length === 0) {
          const emptyRow = tableBody.insertRow();
          const emptyCell = emptyRow.insertCell(0);
          emptyCell.colSpan = options.colSpan || 10;
          emptyCell.textContent = options.emptyMessage;
          emptyCell.style.textAlign = 'center';
          emptyCell.style.fontStyle = 'italic';
          return;
        }

        data.forEach((item, index) => {
          const row = tableBody.insertRow();
          rowRenderer(row, item, index);
        });
      } catch (err) {
        console.error(`Error loading ${endpoint}:`, err);
        if (options.errorHandler) {
          options.errorHandler(err);
        } else {
          alert(`Failed to load ${endpoint} data`);
        }
      }
    },

    // Create cell with content
    createCell: function(row, content, cellIndex = -1) {
      const cell = row.insertCell(cellIndex);
      if (typeof content === 'string') {
        cell.textContent = content;
      } else if (content instanceof HTMLElement) {
        cell.appendChild(content);
      } else if (content !== null && content !== undefined) {
        cell.innerHTML = content;
      }
      return cell;
    },

    // Create action button
    createActionButton: function(text, onClick, className = 'btn-edit') {
      const button = document.createElement('button');
      button.textContent = text;
      button.className = className;
      button.onclick = onClick;
      return button;
    }
  };

  // Generic CRUD operation utilities
  const CRUDManager = {
    // Generic edit function with prompts
    editWithPrompts: async function(id, endpoint, fields, successCallback) {
      const updates = {};
      let hasUpdates = false;

      for (const field of fields) {
        const currentValue = field.currentValue || '';
        const newValue = prompt(`New ${field.label}:`, currentValue);

        if (newValue !== null && newValue !== currentValue) {
          // Handle different field types
          if (field.type === 'number') {
            updates[field.key] = parseFloat(newValue) || 0;
          } else if (field.type === 'integer') {
            updates[field.key] = parseInt(newValue) || 0;
          } else if (field.type === 'json') {
            updates[field.key] = newValue.split(',').map(item => item.trim());
          } else {
            updates[field.key] = newValue;
          }
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        try {
          await apiFetch(`${endpoint}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
          });
          if (successCallback) successCallback();
        } catch (err) {
          alert(`Error updating ${endpoint}`);
        }
      }
    },

    // Generic delete function
    deleteItem: async function(id, endpoint, itemName = 'item', successCallback) {
      if (confirm(`Delete this ${itemName}?`)) {
        try {
          await apiFetch(`${endpoint}/${id}`, { method: 'DELETE' });
          if (successCallback) successCallback();
        } catch (err) {
          alert(`Error deleting ${itemName}`);
        }
      }
    },

    // Generic status update function
    updateStatus: async function(id, endpoint, currentStatus, successCallback) {
      const newStatus = prompt('New status:', currentStatus);
      if (newStatus && newStatus !== currentStatus) {
        try {
          await apiFetch(`${endpoint}/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
          });
          if (successCallback) successCallback();
        } catch (err) {
          alert('Error updating status');
        }
      }
    }
  };

  // Generic fetch helper
  async function apiFetch(url, options = {}) {
    // Ensure we're using the full API URL
    const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers
      }
    });
    if (!response.ok) {
      // If token is invalid (401 or 403), redirect to login
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        token = null;
        userRole = null;
        // Hide dashboard and show login
        dashboard.style.display = 'none';
        document.getElementById('userSection').style.display = 'none';
        loginSection.style.display = 'block';
        // Hide admin sections
        roomsSection.style.display = 'none';
        bookingsSection.style.display = 'none';
        conferencesSection.style.display = 'none';
        conferenceBookingsSection.style.display = 'none';
        inventorySection.style.display = 'none';
        officeUsageSection.style.display = 'none';
        document.querySelector('.card:nth-of-type(3)').style.display = 'none'; // Housekeeping panel
        // Stop real-time updates
        if (refreshInterval) {
          clearInterval(refreshInterval);
        }
        alert('Your session has expired. Please log in again.');
        throw new Error(`API error: ${response.status}`);
      }
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
        loadOfficeUsage(),
        populateRoomDropdown() // Add this to populate room dropdown
      ]);

      // Add sample inventory item after loading
      addSampleInventoryItem();
    } catch (err) {
      console.error('Error loading data:', err);
      alert('Failed to load data. Please refresh.');
    }
  }
  
  // Populate room dropdown for check-in form
  async function populateRoomDropdown() {
    try {
      const rooms = await apiFetch('/rooms');
      const roomSelect = document.getElementById('roomName');
      
      // Clear existing options except the first one (if it's a placeholder)
      roomSelect.innerHTML = '';
      
      // Add rooms as options
      rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;
        option.textContent = `${room.name} (${room.type})`;
        roomSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error populating room dropdown:', err);
    }
  }
  
  // Load guests
  async function loadGuests() {
    await TableManager.loadTable('/guests', '#guestTable tbody', (row, guest) => {
      TableManager.createCell(row, guest.name);
      TableManager.createCell(row, guest.phone);
      TableManager.createCell(row, guest.email || '');
      TableManager.createCell(row, guest.idNumber || '');
      TableManager.createCell(row, guest.room);
      TableManager.createCell(row, guest.check_in_date || '');

      const statusCell = TableManager.createCell(row, '');
      statusCell.innerHTML = guest.booking_status === 'checked_in'
        ? '<span style="color:green;font-weight:bold;">🟢 Checked In</span>'
        : guest.booking_status === 'checked_out' ? '<span style="color:orange;font-weight:bold;">🟡 Checked Out</span>' : '<span style="color:red;">🔴 Other</span>';

      const actionsCell = TableManager.createCell(row, '');
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
        loadRoomsKanban(); // Refresh room status
        loadHousekeeping(); // Refresh housekeeping panel
      } else {
        alert('Error checking out guest');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Network error');
    }
  };

  // Load rooms kanban
  // Get icon based on room type
  function getRoomIcon(type) {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('studio')) return '🏠';
    if (lowerType.includes('conference') || lowerType.includes('conf')) return '🏢';
    return '🛏️'; // Default for rooms
  }

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
      item.onclick = () => showRoomDetails(room.id, room.name, room.type, room.base_rate, room.status, room.housekeeping_state);
      item.style.cursor = 'pointer';
      item.innerHTML = `
        <div class="room-header">
          <h4 class="room-name">${getRoomIcon(room.type)} ${room.name}</h4>
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
          <button class="action-btn dirty-btn" onclick="event.stopPropagation(); updateHousekeepingState(${room.id}, 'dirty')" title="Mark Dirty">🚮</button>
          <button class="action-btn clean-btn" onclick="event.stopPropagation(); updateHousekeepingState(${room.id}, 'clean')" title="Mark Clean">🧹</button>
          <button class="action-btn maint-btn" onclick="event.stopPropagation(); updateHousekeepingState(${room.id}, 'maintenance')" title="Mark Maintenance">🛠</button>
        </div>
      `;
      targetColumn.appendChild(item);
    });

    // Initialize drag & drop
    initKanban();
  }

  // Initialize Kanban drag & drop
  function initKanban() {
    const columns = document.querySelectorAll('.kanban-items');
    columns.forEach(col => {
      new Sortable(col, {
        group: 'kanban',
        animation: 150,
        onAdd: async function (evt) {
          const column = evt.to.closest('.kanban-column');
          const newStatus = column.dataset.status;
          const roomId = parseInt(evt.item.dataset.roomId);
          if (!roomId) return;

          let updateData = {};
          switch(newStatus) {
            case 'available':
              updateData = { status: 'available', housekeeping_state: 'clean' };
              break;
            case 'occupied':
              updateData = { status: 'occupied' };
              break;
            case 'dirty':
              updateData = { housekeeping_state: 'dirty' };
              break;
            case 'maintenance':
              updateData = { status: 'maintenance', housekeeping_state: 'clean' };
              break;
            default:
              return;
          }

          try {
            await apiFetch(`/rooms/${roomId}`, {
              method: 'PUT',
              body: JSON.stringify(updateData)
            });
            // Reload to reflect changes and re-initialize sortable if needed
            loadRoomsKanban();
          } catch (err) {
            console.error('Error updating room status:', err);
            alert('Failed to update room status');
            // Note: For better UX, could implement revert, but for now reload will reposition correctly
          }
        }
      });
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
    await TableManager.loadTable('/bookings', '#bookingTable tbody', (row, booking) => {
      TableManager.createCell(row, booking.id);
      TableManager.createCell(row, booking.guest_name);
      TableManager.createCell(row, booking.room_name);
      TableManager.createCell(row, booking.check_in_date);
      TableManager.createCell(row, booking.check_out_date);
      TableManager.createCell(row, booking.status);
      TableManager.createCell(row, `$${booking.total_price}`);

      const actionsCell = TableManager.createCell(row, '');
      actionsCell.innerHTML = `
        <button class="btn-edit" onclick="editBooking(${booking.id}, '${booking.status}')">Edit Status</button>
        <button class="btn-delete" onclick="deleteBooking(${booking.id})">Delete</button>
      `;
    });
  }

  // Edit booking status
  window.editBooking = async function(id, status) {
    await CRUDManager.updateStatus(id, '/bookings', status, () => {
      loadBookings();
      loadOccupancy();
    });
  };

  // Delete booking
  window.deleteBooking = async function(id) {
    await CRUDManager.deleteItem(id, '/bookings', 'booking', () => {
      loadBookings();
      loadOccupancy();
    });
  };

  // Load logs
  async function loadLogs() {
    await TableManager.loadTable('/logs', '#logTable tbody', (row, log) => {
      TableManager.createCell(row, log.timestamp);
      TableManager.createCell(row, log.user_role);
      TableManager.createCell(row, log.action);
      TableManager.createCell(row, `${log.entity_type} #${log.entity_id}`);
      TableManager.createCell(row, log.description);
    });
  }

  // Load housekeeping panel (assigned tasks and unassigned dirty rooms)
  async function loadHousekeeping() {
    try {
      // Load assigned tasks
      const tasks = await apiFetch('/housekeeping-tasks');
      const assignedTasksTableBody = document.querySelector('#assignedTasksTable tbody');
      assignedTasksTableBody.innerHTML = '';
      
      // Filter assigned tasks (not completed)
      const assignedTasks = tasks.filter(task => task.status !== 'completed');
      
      assignedTasks.forEach(task => {
        const row = assignedTasksTableBody.insertRow();
        row.insertCell(0).textContent = task.room_name;
        row.insertCell(1).textContent = task.maid_name;
        row.insertCell(2).textContent = task.assigned_by_name;
        row.insertCell(3).textContent = new Date(task.assigned_date).toLocaleString();
        row.insertCell(4).textContent = task.status;
        
        const actionsCell = row.insertCell(5);
        if (task.status === 'assigned') {
          actionsCell.innerHTML = `<button onclick="updateTaskStatus(${task.id}, 'in_progress')">Start</button>`;
        } else if (task.status === 'in_progress') {
          actionsCell.innerHTML = `<button onclick="updateTaskStatus(${task.id}, 'completed')">Complete</button>`;
        } else {
          actionsCell.textContent = '—';
        }
      });
      
      // Load unassigned dirty rooms
      const rooms = await apiFetch('/rooms');
      const dirtyRooms = rooms.filter(room => (room.housekeeping_state || 'clean') === 'dirty');
      
      // Filter out rooms that already have assigned tasks
      const assignedRoomIds = assignedTasks.map(task => task.room_id);
      const unassignedDirtyRooms = dirtyRooms.filter(room => !assignedRoomIds.includes(room.id));
      
      const housekeepingTableBody = document.querySelector('#housekeepingTable tbody');
      housekeepingTableBody.innerHTML = '';
      
      // Load staff members for assignment dropdown
      const users = await apiFetch('/users');
      const staffMembers = users.filter(user => user.role === 'staff');
      
      unassignedDirtyRooms.forEach(room => {
        const row = housekeepingTableBody.insertRow();
        row.insertCell(0).textContent = room.name;
        row.insertCell(1).textContent = room.housekeeping_state;
        
        // Create assignment dropdown
        const assignCell = row.insertCell(2);
        const select = document.createElement('select');
        select.className = 'assign-staff';
        select.innerHTML = '<option value="">Select Staff</option>';
        staffMembers.forEach(staff => {
          const option = document.createElement('option');
          option.value = staff.id;
          option.textContent = staff.username;
          select.appendChild(option);
        });
        assignCell.appendChild(select);
        
        const assignButton = document.createElement('button');
        assignButton.textContent = 'Assign';
        assignButton.onclick = () => assignHousekeeping(room.id, select.value);
        assignCell.appendChild(assignButton);
        
        row.insertCell(3).innerHTML = `
          <button onclick="updateHousekeepingState(${room.id}, 'clean')">Mark Clean</button>
        `;
      });
    } catch (err) {
      console.error('Error loading housekeeping data:', err);
    }
  }
  
  // Update task status
  window.updateTaskStatus = async function(taskId, status) {
    try {
      await apiFetch(`/housekeeping-tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      loadHousekeeping();
    } catch (err) {
      console.error('Error updating task status:', err);
      alert('Failed to update task status');
    }
  };

  // Assign housekeeping task
  window.assignHousekeeping = async function(roomId, staffId) {
    if (!staffId) {
      alert('Please select a staff member');
      return;
    }
    
    try {
      // Create a new housekeeping task
      await apiFetch('/housekeeping-tasks', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          maid_id: staffId,
          assigned_by: 1 // Assuming admin ID is 1 for now, in a real app this would be the current user ID
        })
      });
      
      alert('Task assigned successfully');
      loadHousekeeping();
    } catch (err) {
      console.error('Error assigning housekeeping task:', err);
      alert('Failed to assign task');
    }
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

  // Load inventory items with card-based UI
  async function loadInventory() {
    const items = await apiFetch('/inventory-items');
    const container = document.getElementById('inventoryCardsContainer');
    container.innerHTML = '';

    // Populate transaction select
    transactionItemId.innerHTML = '<option value="">Select Item</option>';

    // Update dashboard stats
    updateInventoryDashboard(items);

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.current_stock} ${item.unit})`;
      transactionItemId.appendChild(option);

      // Create card element
      const card = document.createElement('div');
      card.className = 'inventory-card';

      // Calculate stock metrics
      const stockPercentage = Math.min((item.current_stock / item.total_stock) * 100, 100);
      const stockStatus = getStockStatus(item);
      const totalValue = item.current_stock * item.price_per_unit;

      // Determine progress bar color
      let progressClass = 'progress';
      if (stockStatus === 'critical') progressClass += ' critical';
      else if (stockStatus === 'low') progressClass += ' low';
      else if (stockStatus === 'overstock') progressClass += ' overstock';

      card.innerHTML = `
        <h3>${item.name}</h3>
        <p><strong>Category:</strong> ${item.category === 'consumables' ? '🛒' : '🏢'} ${item.category}</p>
        <p><strong>Total Stock:</strong> ${item.total_stock} ${item.unit}</p>
        <p><strong>Current Stock:</strong> ${item.current_stock} ${item.unit}</p>
        <p><strong>Min Level:</strong> ${item.min_level}</p>
        <p><strong>Reorder Threshold:</strong> ${item.reorder_threshold}</p>
        <p><strong>Price per Unit:</strong> $${item.price_per_unit}</p>
        <p><strong>Status:</strong> ${item.status === 'active' ? '✅' : item.status === 'inactive' ? '⏸️' : '🛑'} ${item.status}</p>
        ${item.description ? `<p><strong>Description:</strong> ${item.description}</p>` : ''}
        <p><strong>Stock Level:</strong> ${Math.round(stockPercentage)}%</p>

        <div class="progress-bar">
          <div class="${progressClass}" style="width: ${stockPercentage}%"></div>
        </div>

        <div class="card-actions">
          <button class="btn btn-use" onclick="useInventoryItem(${item.id}, '${item.name}', ${item.current_stock})">Use Item</button>
          <button class="btn btn-reorder" onclick="reorderItem('${item.name}', ${item.min_level * 2})">Reorder</button>
        </div>
      `;

      container.appendChild(card);
    });
  }

  // Get stock status for visual indicators
  function getStockStatus(item) {
    const percentage = (item.current_stock / item.total_stock) * 100;
    if (item.current_stock <= item.min_level) return 'critical';
    if (item.current_stock <= item.reorder_threshold) return 'low';
    if (percentage > 100) return 'overstock';
    return 'optimal';
  }

  // Update inventory dashboard stats
  function updateInventoryDashboard(items) {
    const dashboard = document.getElementById('inventoryDashboard');
    if (!dashboard) return;

    const totalItems = items.length;
    const lowStockItems = items.filter(item => item.current_stock <= item.min_level).length;
    const totalValue = items.reduce((sum, item) => sum + (item.current_stock * item.price_per_unit), 0);

    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('lowStockItems').textContent = lowStockItems;
    document.getElementById('totalValue').textContent = `$${totalValue.toFixed(2)}`;

    // Show dashboard
    dashboard.style.display = 'grid';
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

  // Load low stock alerts with enhanced UI
  async function loadAlerts() {
    const alerts = await apiFetch('/inventory/alerts');
    alertsTableBody.innerHTML = '';
    alerts.forEach(alert => {
      const row = alertsTableBody.insertRow();
      const alertLevel = alert.current_stock === 0 ? 'critical' : alert.current_stock <= alert.min_level * 0.5 ? 'high' : 'medium';

      row.innerHTML = `
        <td>
          <div class="alert-item">
            <div class="alert-name">${alert.name}</div>
            <div class="alert-description">Requires immediate attention</div>
          </div>
        </td>
        <td>
          <div class="alert-status ${alertLevel}">
            <span class="status-indicator ${alertLevel}"></span>
            ${alert.current_stock} units remaining
          </div>
        </td>
        <td>
          <button class="reorder-btn" onclick="reorderItem('${alert.name}', ${alert.min_level * 2})">
            📦 Reorder Now
          </button>
        </td>
      `;
    });
  }

  // Add sample inventory item (Cleaning Supplies)
  async function addSampleInventoryItem() {
    try {
      // Check if we already have this item
      const items = await apiFetch('/inventory-items');
      const existingItem = items.find(item => item.name.toLowerCase().includes('cleaning'));

      if (!existingItem) {
        const sampleItem = {
          name: 'Cleaning Supplies',
          description: 'Various cleaning products and supplies for hotel maintenance',
          category: 'consumables',
          total_stock: 50,
          current_stock: 45, // Fixed: was 125, now 45 (within total capacity)
          min_level: 15,
          reorder_threshold: 25,
          unit: 'bottles',
          price_per_unit: 5.00,
          status: 'active'
        };

        await apiFetch('/inventory-items', {
          method: 'POST',
          body: JSON.stringify(sampleItem)
        });

        console.log('Sample inventory item added successfully');
      }
    } catch (err) {
      console.log('Sample item may already exist or error occurred:', err.message);
    }
  }

  // Use inventory item function
  window.useInventoryItem = async function(itemId, itemName, currentStock) {
    const quantity = prompt(`How many units of ${itemName} would you like to use? (Current stock: ${currentStock})`);

    if (quantity === null || quantity === '') return;

    const useQuantity = parseInt(quantity);
    if (isNaN(useQuantity) || useQuantity <= 0) {
      alert('Please enter a valid positive number');
      return;
    }

    if (useQuantity > currentStock) {
      alert(`Cannot use ${useQuantity} units. Only ${currentStock} units available.`);
      return;
    }

    if (confirm(`Use ${useQuantity} units of ${itemName}?`)) {
      try {
        // Create stock-out transaction
        await apiFetch('/stock-transactions', {
          method: 'POST',
          body: JSON.stringify({
            item_id: itemId,
            type: 'out',
            quantity: useQuantity,
            reason: 'Item usage'
          })
        });

        alert(`Successfully used ${useQuantity} units of ${itemName}`);
        loadInventory();
        loadAlerts();
      } catch (err) {
        alert('Error processing usage: ' + err.message);
      }
    }
  };

  // Reorder item function
  window.reorderItem = async function(itemName, quantity) {
    if (confirm(`Create reorder request for ${itemName} (${quantity} units)?`)) {
      try {
        // Find the item
        const items = await apiFetch('/inventory-items');
        const item = items.find(i => i.name === itemName);

        if (item) {
          // Create stock-in transaction
          await apiFetch('/stock-transactions', {
            method: 'POST',
            body: JSON.stringify({
              item_id: item.id,
              type: 'in',
              quantity: quantity,
              reason: 'Reorder - Low stock alert'
            })
          });

          alert(`Reorder processed! ${quantity} units added to ${itemName}`);
          loadInventory();
          loadAlerts();
        }
      } catch (err) {
        alert('Error processing reorder: ' + err.message);
      }
    }
  };

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
        // conferencesSection.style.display = 'block'; // Hidden complex admin sections
        // conferenceBookingsSection.style.display = 'block'; // Hidden complex admin sections
        // inventorySection.style.display = 'block'; // Hidden complex admin sections
        // Show the sections that should be visible to admin
        document.getElementById('guestsSection').style.display = 'block';
        document.getElementById('housekeepingSection').style.display = 'block';
        document.getElementById('calendarSection').style.display = 'block';
        document.getElementById('occupancySection').style.display = 'block';
        document.getElementById('activityLogSection').style.display = 'block';
        officeUsageSection.style.display = 'block';
      } else if (userRole === 'staff') {
        // Redirect staff users to the maid dashboard
        window.location.href = 'maid.html';
        return;
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
    // Stop real-time updates
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
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
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    token = null;
    userRole = null;
    // Toggle form visibility
    window.toggleForm = function(containerId) {
      const container = document.getElementById(containerId);
      if (container.style.display === 'none') {
        container.style.display = 'block';
      } else {
        container.style.display = 'none';
      }
    };
  
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
          // Show confirmation message with green tick
          const confirmationMessage = document.createElement('div');
          confirmationMessage.innerHTML = '✅ Guest checked in successfully!';
          confirmationMessage.style.color = 'green';
          confirmationMessage.style.fontWeight = 'bold';
          confirmationMessage.style.marginTop = '10px';
          confirmationMessage.style.padding = '10px';
          confirmationMessage.style.border = '1px solid green';
          confirmationMessage.style.borderRadius = '5px';
          confirmationMessage.style.backgroundColor = '#f0fff0';
          
          // Insert the confirmation message after the form
          checkinForm.parentNode.insertBefore(confirmationMessage, checkinForm.nextSibling);
          
          // Remove the message after 5 seconds
          setTimeout(() => {
            confirmationMessage.remove();
          }, 5000);
          
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
  await CRUDManager.updateStatus(id, '/conference-bookings', status, () => {
    loadConferenceBookings();
  });
};

// Delete conference booking
window.deleteConferenceBooking = async function(id) {
  await CRUDManager.deleteItem(id, '/conference-bookings', 'conference booking', () => {
    loadConferenceBookings();
  });
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

// Enhanced view item details
window.viewItemDetails = async function(id) {
  try {
    const items = await apiFetch('/inventory-items');
    const selectedItem = items.find(i => i.id === id);
    if (!selectedItem) return;

    // Calculate stock metrics
    const stockPercentage = Math.min((selectedItem.current_stock / selectedItem.total_stock) * 100, 100);
    const stockStatus = getStockStatus(selectedItem);
    const totalValue = selectedItem.current_stock * selectedItem.price_per_unit;

    // Update modal elements
    document.getElementById('modalItemName').textContent = selectedItem.name;
    document.getElementById('modalDescription').textContent = selectedItem.description || '—';
    document.getElementById('modalCategory').textContent = selectedItem.category === 'consumables' ? '🛒 Consumables' : '🏢 Fixed Assets';
    document.getElementById('modalTotalStock').textContent = selectedItem.total_stock;
    document.getElementById('modalCurrentStock').textContent = selectedItem.current_stock;
    document.getElementById('modalUnit').textContent = selectedItem.unit;
    document.getElementById('modalUnit2').textContent = selectedItem.unit;
    document.getElementById('modalMinLevel').textContent = selectedItem.min_level;
    document.getElementById('modalReorderThreshold').textContent = selectedItem.reorder_threshold;
    document.getElementById('modalPrice').textContent = selectedItem.price_per_unit.toFixed(2);

    // Set stock bar and status using the new UI helpers
    window.InventoryDetailsUI.setStock(selectedItem.current_stock, selectedItem.total_stock);
    window.InventoryDetailsUI.setStatus(stockStatus);

    // Fetch and display recent transactions
    try {
      const transactions = await apiFetch(`/stock-transactions?item_id=${id}`);
      const container = document.createElement('div');
      container.id = 'modalTransactionsContainer';

      if (transactions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--muted); font-style: italic; padding: 20px;">No transactions found</p>';
      } else {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.innerHTML = `
          <thead>
            <tr style="background: rgba(148,163,184,.08);">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid rgba(148,163,184,.15); color: var(--muted);">Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid rgba(148,163,184,.15); color: var(--muted);">Type</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid rgba(148,163,184,.15); color: var(--muted);">Quantity</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid rgba(148,163,184,.15); color: var(--muted);">Reason</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        transactions.slice(0, 10).forEach(trans => {
          const row = tbody.insertRow();
          row.innerHTML = `
            <td style="padding: 12px; border-bottom: 1px solid rgba(148,163,184,.12);">${new Date(trans.transaction_date).toLocaleDateString()}</td>
            <td style="padding: 12px; border-bottom: 1px solid rgba(148,163,184,.12);">
              <span style="padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;
                background: ${trans.type === 'in' ? 'rgba(16,185,129,.12)' : trans.type === 'out' ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)'};
                color: ${trans.type === 'in' ? 'var(--ok)' : trans.type === 'out' ? 'var(--danger)' : 'var(--warn)'}">
                ${trans.type === 'in' ? '📈' : trans.type === 'out' ? '📉' : '⚖️'} ${trans.type.toUpperCase()}
              </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid rgba(148,163,184,.12);">${trans.quantity} ${selectedItem.unit}</td>
            <td style="padding: 12px; border-bottom: 1px solid rgba(148,163,184,.12);">${trans.reason || 'N/A'}</td>
          `;
        });

        container.innerHTML = '';
        container.appendChild(table);
      }

      // Replace existing transactions container or create one
      const existingContainer = document.getElementById('modalTransactionsContainer');
      if (existingContainer) {
        existingContainer.remove();
      }

      // Insert after the stock bar
      const stockBar = document.querySelector('.stockBar');
      stockBar.parentNode.insertBefore(container, stockBar.nextSibling);

    } catch (err) {
      console.error('Error loading transactions:', err);
      const container = document.createElement('div');
      container.id = 'modalTransactionsContainer';
      container.innerHTML = '<p style="text-align: center; color: var(--danger); padding: 20px;">Error loading transactions</p>';

      const existingContainer = document.getElementById('modalTransactionsContainer');
      if (existingContainer) {
        existingContainer.remove();
      }

      const stockBar = document.querySelector('.stockBar');
      stockBar.parentNode.insertBefore(container, stockBar.nextSibling);
    }

    // Open the modal using the new modal system
    window.InventoryDetailsModal.open();

  } catch (err) {
    console.error('Error loading item details:', err);
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

// Apply filters and search
function applyFilters() {
  const searchTerm = document.getElementById('roomSearch').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;

  apiFetch('/rooms').then(rooms => {
    const availableRooms = document.getElementById('availableRooms');
    const occupiedRooms = document.getElementById('occupiedRooms');
    const dirtyRooms = document.getElementById('dirtyRooms');
    const maintenanceRooms = document.getElementById('maintenanceRooms');

    // Clear columns
    availableRooms.innerHTML = '';
    occupiedRooms.innerHTML = '';
    dirtyRooms.innerHTML = '';
    maintenanceRooms.innerHTML = '';

    // Filter rooms
    const filteredRooms = rooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm) || room.type.toLowerCase().includes(searchTerm);
      const matchesStatus = !statusFilter || room.status === statusFilter || (statusFilter === 'dirty' && room.housekeeping_state === 'dirty');
      return matchesSearch && matchesStatus;
    });

    // Place filtered rooms in columns (same logic as loadRoomsKanban)
    filteredRooms.forEach(room => {
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
        targetColumn = dirtyRooms;
      }

      const item = document.createElement('div');
      item.className = 'room-card';
      item.dataset.roomId = room.id;
      item.onclick = () => showRoomDetails(room.id, room.name, room.type, room.base_rate, room.status, room.housekeeping_state);
      item.style.cursor = 'pointer';
      item.innerHTML = `
        <div class="room-header">
          <h4 class="room-name">${getRoomIcon(room.type)} ${room.name}</h4>
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
          <button class="action-btn dirty-btn" onclick="event.stopPropagation(); updateHousekeepingState(${room.id}, 'dirty')" title="Mark Dirty">🚮</button>
          <button class="action-btn clean-btn" onclick="event.stopPropagation(); updateHousekeepingState(${room.id}, 'clean')" title="Mark Clean">🧹</button>
          <button class="action-btn maint-btn" onclick="event.stopPropagation(); updateHousekeepingState(${room.id}, 'maintenance')" title="Mark Maintenance">🛠</button>
        </div>
      `;
      targetColumn.appendChild(item);
    });

    // Re-initialize sortable
    initKanban();
  }).catch(err => {
    console.error('Error applying filters:', err);
    alert('Failed to apply filters');
  });
}

// Real-time search and filter
const searchInput = document.getElementById('roomSearch');
const statusSelect = document.getElementById('statusFilter');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');

if (searchInput) searchInput.addEventListener('input', applyFilters);
if (statusSelect) statusSelect.addEventListener('change', applyFilters);
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);

// Initial load with filters if needed - only if user is logged in
if (token && userRole) {
  applyFilters();
}
});

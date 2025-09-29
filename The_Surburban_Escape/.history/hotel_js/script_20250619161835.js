document.addEventListener('DOMContentLoaded', function() {
    const checkinForm = document.getElementById('checkinForm');
    const guestTableBody = document.getElementById('guestTable').getElementsByTagName('tbody')[0];

    function fetchGuests() {
        fetch('http://localhost:3000/guests')
            .then(response => response.json())
            .then(guests => {
                guestTableBody.innerHTML = '';
                guests.forEach(guest => {
                    let row = guestTableBody.insertRow();
                    let nameCell = row.insertCell();
                    let phoneCell = row.insertCell();
                    let emailCell = row.insertCell();
                    let roomCell = row.insertCell();
                    let actionsCell = row.insertCell();

                    nameCell.innerHTML = guest.name;
                    phoneCell.innerHTML = guest.phone;
                    emailCell.innerHTML = guest.email;
                    roomCell.innerHTML = guest.room;
                    actionsCell.innerHTML = `
                        <button onclick="checkout(${guest.id})">Check Out</button>
                    `;
                });
            });
    }

    checkinForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const name = document.getElementById('name').value;
        const phone = document.getElementById('phone').value;
        const email = document.getElementById('email').value;
        const idNumber = document.getElementById('idNumber').value;
        const room = document.getElementById('room').value;

        fetch('http://localhost:3000/checkin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, phone, email, idNumber, room })
        })
        .then(response => {
            if (response.ok) {
                fetchGuests();
                checkinForm.reset();
            } else {
                alert('Error checking in guest');
            }
        });
    });

    window.checkout = function(id) {
        fetch(`http://localhost:3000/checkout/${id}`, {
            method: 'POST'
        })
        .then(response => {
            if (response.ok) {
                fetchGuests();
            } else {
                alert('Error checking out guest');
            }
        });
    };

    fetchGuests();
});
from flask import Flask, render_template, request, redirect
import sqlite3
from collections import namedtuple

app = Flask(__name__)

# Initialize the database with full guest profile structure
def init_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            id_number TEXT,
            room TEXT NOT NULL,
            status TEXT DEFAULT 'Checked In'
        )
    ''')
    conn.commit()
    conn.close()

# Fetch guests and convert rows to namedtuple for cleaner template access
def fetch_guests():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    guests = conn.execute("SELECT * FROM guests").fetchall()
    conn.close()
    return [dict(g) for g in guests]

@app.route('/')
def home():
    guests = fetch_guests()
    return render_template('index.html', guests=guests)

@app.route('/checkin', methods=['POST'])
def checkin():
    name = request.form['guestName']
    phone = request.form['phone']
    email = request.form.get('email', '')
    id_number = request.form.get('idNumber', '')
    room = request.form['roomSelect']
    
    conn = sqlite3.connect('database.db')
    conn.execute('''
        INSERT INTO guests (name, phone, email, id_number, room)
        VALUES (?, ?, ?, ?, ?)
    ''', (name, phone, email, id_number, room))
    conn.commit()
    conn.close()
    return redirect('/')

@app.route('/checkout/<id>', methods=['POST'])
def checkout(id):
    conn = sqlite3.connect('database.db')
    conn.execute("UPDATE guests SET status = 'Checked Out' WHERE id = ? AND status = 'Checked In'", (id,))
    conn.commit()
    conn.close()
    return redirect('/')

if __name__ == '__main__':
    init_db()
    app.run(debug=True)

const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'ndegwa',
  password: 'Mzee_Mzima',
  database: 'hotel'
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Connected to MySQL');
});

app.post('/checkin', (req, res) => {
  const { name, phone, email, idNumber, room } = req.body;
  const sql = 'INSERT INTO guests (name, phone, email, idNumber, room) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [name, phone, email, idNumber, room], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error inserting data');
      return;
    }
    console.log('Guest checked in');
    res.status(200).send('Guest checked in successfully');
  });
});

app.post('/checkout/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM guests WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error deleting data');
      return;
    }
    console.log('Guest checked out');
    res.status(200).send('Guest checked out successfully');
  });
});

app.get('/guests', (req, res) => {
    const sql = 'SELECT * FROM guests';
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error fetching guests');
            return;
        }
        res.status(200).json(results);
    });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
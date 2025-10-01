const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'localhost',
  user: 'your_username',
  password: 'your_password',
  database: 'hotel'
});

db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log('Connected to MySQL');
});

app.post('/checkin', (req, res) => {
  const { name, phone, email, room } = req.body;
  const sql = 'INSERT INTO guests (name, phone, email, room) VALUES (?, ?, ?, ?)';
  db.query(sql, [name, phone, email, room], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error inserting data');
      return;
    }
    console.log('Guest checked in');
    res.status(200).send('Guest checked in successfully');
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
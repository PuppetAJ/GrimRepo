const express = require('express');
const PORT = process.env.PORT || 3001;
const app = express();
const mysql = require('mysql2');

//Express middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

//Connect to db
const db = mysql.createConnection(
    {
        host: 'localhost',
        user: 'root',
        password: 'root',
        database: 'cards'
    },
    console.log('Connected to cards db')
)

//returns all cards (deck) in the deck as json
app.get('./characters', (req, res) => {
    const sql = `SELECT * FROM characters`;
    
    db.query(sql, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message})
            return
        }
        res.json({
            message: 'success',
            data: rows
        });
    });
  });
  
//Test
app.get('/', (req, res) => {
    res.json({
        message: 'Hello World'
    })
})



// GET a single card
app.get('/characters/:id', (req, res) => {
    const sql = `SELECT * FROM characters WHERE id = ?`;
    const params = [req.params.id];
  
    db.query(sql, params, (err, row) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.json({
        message: 'success',
        data: row
      });
    });
  });

// Delete a candidate
app.delete('/characters/:id', (req, res) => {
    const sql = `DELETE FROM charactesr WHERE id = ?`;
    const params = [req.params.id];
  
    db.query(sql, params, (err, result) => {
      if (err) {
        res.statusMessage(400).json({ error: res.message });
      } else if (!result.affectedRows) {
        res.json({
          message: 'Card not found'
        });
      } else {
        res.json({
          message: 'deleted',
          changes: result.affectedRows,
          id: req.params.id
        });
      }
    });
  });

// Create a card
const sql = `INSERT INTO characters (id, tier, name, attack, defense, sacrifice) 
VALUES (?,?,?,?,?,?)`;
const params = [, 'E', 'Test', 1, 1, 1];

db.query(sql, params, (err, result) => {
    if (err) {
        res.status(400).json({ error: err.message });
        return;
}
    res.json({
        message: 'success',
        data: body
    })
});

//'Not found' 'Catch all'
app.use((req, res) => {
    res.status(404).end();
})

//Starts server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
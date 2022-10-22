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

//Test
app.get('/', (req, res) => {
    res.json({
        message: 'Hello World'
    })
})

//'Not found' 'Catch all'
app.use((req, res) => {
    res.status(404).end();
})

//Starts server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
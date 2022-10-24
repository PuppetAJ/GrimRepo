//**Need to look up es6 syntax for 3js */
const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars')

const app = express();
const PORT = process.env.PORT || 3001;

const sequelize = require("./config/connection")

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



//'Not found' 'Catch all'
app.use((req, res) => {
    res.status(404).end();
})

//Starts server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
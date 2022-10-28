//**Need to look up es6 syntax for 3js */
const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const path = require('path');
const sequelize = require("./config/connection");
const SequelizeStore = require('connect-session-sequelize')(session.Store);

// Declare session, with unique secret
const sess = {
  secret: '065b15a8-e7bc-4676-8e76-33f18f2df80d',
  cookie: {},
  resave: false,
  saveUnitialized: true,
  // store session using connect-session-sequelize package with our database
  store: new SequelizeStore({
      db: sequelize
  }),
  expires: new Date(Date.now() + 3600000)
};

const app = express();
const PORT = process.env.PORT || 3001;

//Express middleware
app.use(session(sess));
app.set('view engine', 'handlebars');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// database: 'cards'



//'Not found' 'Catch all'
// app.use((req, res) => {
//     res.status(404).end();
// })

// sync with database and then start the server
sequelize.sync({ force: false }).then(() => {
  app.listen(PORT, () => console.log(`Now listening on url: http://localhost:${PORT}`));
});
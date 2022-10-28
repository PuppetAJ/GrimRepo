// Import packages
const Sequelize = require('sequelize');

// Import dotenv
require('dotenv').config();

// Declare sequelize variable
let sequelize;

// If there's a process.env.JAWSDB_URL then.. 
if (process.env.JAWSDB_URL) {
  // make the sequelize variable into a new sequelize instance using that jawsdb url
  sequelize = new Sequelize(process.env.JAWSDB_URL);
  // otherwise.. use localhost and our local .env file
} else {
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: 'localhost',
    dialect: 'mysql',
    port: 3306
  });
}

// Export connection
module.exports = sequelize;
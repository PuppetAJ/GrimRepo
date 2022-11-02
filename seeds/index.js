// Import seeding functions
const seedCards = require('./card-seeds');
const seedPlayers = require('./player-seeds');

// Import sequelize connection
const sequelize = require('../config/connection');

// Function for running all seeding functions
const seedAll = async () => {
  await sequelize.sync({ force: true });
  console.log('\n----- DATABASE SYNCED -----\n');
  await seedCards();
  console.log('\n----- CARDS SEEDED -----\n');
  await seedPlayers();
  console.log('\n---- PLAYERS SEEDED ----\n');
  process.exit(0);
}

// Execute function on script call
seedAll();
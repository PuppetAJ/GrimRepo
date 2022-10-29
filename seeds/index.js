const seedCards = require('./card-seeds');

const sequelize = require('../config/connection');

const seedAll = async () => {
  await sequelize.sync({ force: true });
  console.log('\n----- DATABASE SYNCED -----\n');
  await seedCards();
  console.log('\n----- CARDS SEEDED -----\n');
  process.exit(0);
}

seedAll();
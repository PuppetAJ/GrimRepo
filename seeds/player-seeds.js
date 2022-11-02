// Imports
const sequelize = require('../config/connection');
const { Player } = require('../models');

// Data we want to insert
const playerdata = [
  {
    username: 'kwm0304',
    email: 'testuser1@gmail.com',
    password: 'testpassword',
    highscore: 500
  },
  {
    username: 'PuppetAJ',
    email: 'testuser2@gmail.com',
    password: 'testpassword',
    highscore: 1000
  },
  {
    username: 'JohanH',
    email: 'testuser3@gmail.com',
    password: 'testpassword',
    highscore: 5000
  }
];

// Seeding function
const seedPlayers = () => Player.bulkCreate(playerdata);

// Export
module.exports = seedPlayers;
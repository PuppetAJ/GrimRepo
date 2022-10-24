const sequelize = require('../config/connection');
const { Player } = require('../models');

const playerdata = [
  {
    username: 'kwm0304',
    password: '',
    health: 20,
    wins: 5,
    losses: 1
  }
];

const seedPlayers = () => Player.bulkCreate(playerdata) //{individualHooks: true});

module.exports = seedPlayers;
const sequelize = require('../config/connection');
const { Player } = require('../models');

const playerdata = [
  {
    username: 'kwm0304',
    password: '',

    wins: 5,
    losses: 1
  }
];

const seedPlayers = () => Player.bulkCreate(playerdata) //{individualHooks: true});

module.exports = seedPlayers;

//create user db in schema
//split player table into login info and record table  w/ player username 
// join these on primaryKey
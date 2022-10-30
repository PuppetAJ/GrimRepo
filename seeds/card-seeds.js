const { Card } = require('../models')
const cards = [
    {
        tier: 'E',
        name: 'OffCenterDiv',
        attack: 0,
        defense: 6,
        cost: 0 
    },
    {
        tier: 'E',
        name: 'Hello_World',
        attack: 1,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'E',
        name: 'Syntax_Err',
        attack: 1,
        defense: 2,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'Loop',
        attack: 1,
        defense: 2,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'if(losing)',
        attack: 2,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'RobloxDevOps',
        attack: 2,
        defense: 3,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'GoogleFu',
        attack: 3,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'Gitsome',
        attack: 4,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'GrimRepo',
        attack: 3,
        defense: 2,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'Gitbasher',
        attack: 2,
        defense: 4,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'Firewall',
        attack: 2,
        defense: 6,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'SQLSyntaxErr',
        attack: 4,
        defense: 2,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'NullPointer',
        attack: 4,
        defense: 2,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'Bug',
        attack: 0,
        defense: 8,
        cost: 1 
    },
    {
        tier: 'C',
        name: '//BrokenCode',
        attack: 3,
        defense: 4,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'Cookie',
        attack: 3,
        defense: 4,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'Iterator',
        attack: 5,
        defense: 2,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'Bootstrapped',
        attack: 2,
        defense: 5,
        cost: 1 
    },
    {
        tier: 'B',
        name: 'destroyEnemy(you)',
        attack: 8,
        defense: 2,
        cost: 2 
    },
    {
        tier: 'B',
        name: 'DeathNode',
        attack: 7,
        defense: 3,
        cost: 2 
    },
    {
        tier: 'B',
        name: 'JSONFoorhees',
        attack: 5,
        defense: 8,
        cost: 2 
    },
    {
        tier: 'B',
        name: 'Documentation',
        attack: 7,
        defense: 7,
        cost: 2
    },
    {
        tier: 'A',
        name: 'FourOhFour',
        attack: 4,
        defense: 0,
        cost: 4
    },
    {
        tier: 'A',
        name: 'RubberDuck',
        attack: 4,
        defense: 12,
        cost: 3 
    },
    {
        tier: 'A',
        name: 'JACK',
        attack: 13,
        defense: 13,
        cost: 3
    },
    {
      tier: 'S',
      name: 'Y2K',
      attack: 2000,
      defense: 2000,
      cost: 0
    }
];

const seedCards = () => Card.bulkCreate(cards);

module.exports = seedCards;
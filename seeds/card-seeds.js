const { Card } = require('../models')
const cards = [
    {
        tier: 'E',
        name: 'OffCenterDiv',
        attack: 5,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'E',
        name: 'Jester',
        attack: 4,
        defense: 2,
        cost: 0 
    },
    {
        tier: 'E',
        name: 'CTRLALTDELETE',
        attack: 3,
        defense: 3,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'StackOverflowing',
        attack: 6,
        defense: 2,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'forEach',
        attack: 7,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'Terminal',
        attack: 4,
        defense: 4,
        cost: 0 
    },
    {
        tier: 'D',
        name: 'GoogleFu',
        attack: 5,
        defense: 3,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'Gitsome',
        attack: 5,
        defense: 5,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'GrimRepo',
        attack: 8,
        defense: 2,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'Gitbasher',
        attack: 2,
        defense: 8,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'CascadingSamuraiStars',
        attack: 7,
        defense: 3,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'ErrorCatcher',
        attack: 1,
        defense: 9,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'BranchSwitcher',
        attack: 3,
        defense: 7,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'FourOhFour',
        attack: 4,
        defense: 6,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'Refactorer',
        attack: 6,
        defense: 4,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'CTRLV',
        attack: 9,
        defense: 1,
        cost: 0 
    },
    {
        tier: 'C',
        name: 'Iterator',
        attack: 10,
        defense: 0,
        cost: 1 
    },
    {
        tier: 'C',
        name: 'Bootstrapped',
        attack: 0,
        defense: 10,
        cost: 1 
    },
    {
        tier: 'B',
        name: 'destroyEnemy(you)',
        attack: 8,
        defense: 4,
        cost: 1 
    },
    {
        tier: 'B',
        name: 'DeathNode',
        attack: 9,
        defense: 3,
        cost: 1 
    },
    {
        tier: 'B',
        name: 'EventListener',
        attack: 2,
        defense: 10,
        cost: 1 
    },
    {
        tier: 'B',
        name: 'JSONFoorhees',
        attack: 11,
        defense: 1,
        cost: 1 
    },
    {
        tier: 'A',
        name: 'FatalError',
        attack: 9,
        defense: 5,
        cost: 2 
    },
    {
        tier: 'A',
        name: 'TheCompiler',
        attack: 12,
        defense: 2,
        cost: 3 
    },
    {
        tier: 'A',
        name: 'FullyStacked',
        attack: 13,
        defense: 1,
        cost: 4 
    }
];

const seedCards = () => Card.bulkCreate(cards);

module.exports = seedCards;
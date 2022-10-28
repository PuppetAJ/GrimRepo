// const Characters = require("../../models/Characaters");

//timer
const turnTimer = document.getElementById('timer')
var timeLeft;
//Buttons
const startButton = document.getElementById('start-btn')
const doneButton = document.getElementById('done-btn')
const nextButton = document.getElementById('next-btn')
//Decks
const playerDeck = document.getElementById('deck')
const AIDeckEl = document.getElementById('AIDeck')
//Hand slots
let hand_1 = document.getElementById('Hand1')
let hand_2 = document.getElementById('Hand2')
let hand_3 = document.getElementById('Hand3')
let hand_4 = document.getElementById('Hand4')
//Game board slots
const tile_1 = document.getElementById('tile1')
const tile_2 = document.getElementById('tile2')
const tile_3 = document.getElementById('tile3')
const tile_4 = document.getElementById('tile4')
//Opponents hand/tiles
const AIhand_1 = document.getElementById('AIHand1')
const AIhand_2 = document.getElementById('AIHand2')
const AIhand_3 = document.getElementById('AIHand3')
const AIhand_4 = document.getElementById('AIHand4')
const AItile_1 = document.getElementById('AItile1')
const AItile_2 = document.getElementById('AItile2')
const AItile_3 = document.getElementById('AItile3')
const AItile_4 = document.getElementById('AItile4')

//Buttons
// startButton.addEventListener('click', startGame)
// doneButton.addEventListener('click', endTurn)
// nextButton.addEventListener('click', fight)

let cards = [
    {
        tier: 'E',
        name: 'OffCenterDiv',
        attack: 5,
        defense: 1,
        sacrifice: 0 
    },
    {
        tier: 'E',
        name: 'Jester',
        attack: 4,
        defense: 2,
        sacrifice: 0 
    },
    {
        tier: 'E',
        name: 'CTRLALTDELETE',
        attack: 3,
        defense: 3,
        sacrifice: 0 
    },
    {
        tier: 'D',
        name: 'StackOverflowing',
        attack: 6,
        defense: 2,
        sacrifice: 0 
    },
    {
        tier: 'D',
        name: 'forEach',
        attack: 7,
        defense: 1,
        sacrifice: 0 
    },
    {
        tier: 'D',
        name: 'Terminal',
        attack: 4,
        defense: 4,
        sacrifice: 0 
    },
    {
        tier: 'D',
        name: 'GoogleFu',
        attack: 5,
        defense: 3,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'Gitsome',
        attack: 5,
        defense: 5,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'GrimRepo',
        attack: 8,
        defense: 2,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'Gitbasher',
        attack: 2,
        defense: 8,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'CascadingSamuraiStars',
        attack: 7,
        defense: 3,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'ErrorCatcher',
        attack: 1,
        defense: 9,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'BranchSwitcher',
        attack: 3,
        defense: 7,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'FourOhFour',
        attack: 4,
        defense: 6,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'Refactorer',
        attack: 6,
        defense: 4,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'CTRLV',
        attack: 9,
        defense: 1,
        sacrifice: 0 
    },
    {
        tier: 'C',
        name: 'Iterator',
        attack: 10,
        defense: 0,
        sacrifice: 1 
    },
    {
        tier: 'C',
        name: 'Bootstrapped',
        attack: 0,
        defense: 10,
        sacrifice: 1 
    },
    {
        tier: 'B',
        name: 'destroyEnemy(you)',
        attack: 8,
        defense: 4,
        sacrifice: 1 
    },
    {
        tier: 'B',
        name: 'DeathNode',
        attack: 9,
        defense: 3,
        sacrifice: 1 
    },
    {
        tier: 'B',
        name: 'EventListener',
        attack: 2,
        defense: 10,
        sacrifice: 1 
    },
    {
        tier: 'B',
        name: 'JSONFoorhees',
        attack: 11,
        defense: 1,
        sacrifice: 1 
    },
    {
        tier: 'A',
        name: 'FatalError',
        attack: 9,
        defense: 5,
        sacrifice: 2 
    },
    {
        tier: 'A',
        name: 'TheCompiler',
        attack: 12,
        defense: 2,
        sacrifice: 3 
    },
    {
        tier: 'A',
        name: 'FullyStacked',
        attack: 13,
        defense: 1,
        sacrifice: 4 
    }
];


let hand = [];



//Strategy Phase
// function countDown() {
//     var timeInterval = setInterval(function() {
//         timeLeft--;
//         turnTimer.textContent=timeLeft;
//         if (timeLeft <=0 ) {
//             clearInterval(timeInterval)
//             endTurn()
//         }
//     }, 1000)
// }

// function startGame() {
//     timeLeft = 60;
//     countDown();
//     startButton.classList.add('hidden')
//     doneButton.classList.remove('hidden')
//     nextButton.classList.remove('hidden')
//     generateHand(4)
//     generateAIHand()
//     generateAIPlacement()

// }

//Draw card w/ Oppcard array 
function draw() {
    var index = Math.floor(Math.random()*Oppcards.length-1)
        return Oppcards.splice(index, 1)
}
//Place their hand


//Attack logic

//draws specific number of cards (4) and pushes to hand array
function generateHand(num) {
    for (var i = 0; i < num; i++) {
        hand.push(draw());
    }
    console.log(hand)
    console.log(cards)

    //assigning drawn cards to hand slots
    // hand_1.innerHTML = hand[0];
    // hand_2.innerHTML = hand[1];
    // hand_3.innerHTML = hand[2];
    // hand_4.innerHTML = hand[3];
    // console.log(hand_1); returns undefined
}


let card1 = hand[0]
//draws one card and removes it from array 
function draw() {
    var index = Math.floor(Math.random()*cards.length-1)
        return cards.splice(index, 1)
}



// function endTurn()
// function fight()
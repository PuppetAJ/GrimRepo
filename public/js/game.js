const Characters = require("../../models/Characaters");

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
const hand_1 = document.getElementById('Hand1')
const hand_2 = document.getElementById('Hand2')
const hand_3 = document.getElementById('Hand3')
const hand_4 = document.getElementById('Hand4')
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
startButton.addEventListener('click', startGame)
doneButton.addEventListener('click', endTurn)
nextButton.addEventListener('click', fight)

//Strategy Phase
function countDown() {
    var timeInterval = setInterval(function() {
        timeLeft--;
        turnTimer.textContent=timeLeft;
        if (timeLeft <=0 ) {
            clearInterval(timeInterval)
            endTurn()
        }
    }, 1000)
}

function startGame() {
    timeLeft = 60;
    countDown();
    startButton.classList.add('hidden')
    doneButton.classList.remove('hidden')
    nextButton.classList.remove('hidden')
    generateHand()
    generateAIHand()
    generateAIPlacement()
}

function generateHand() {
    Characters.prototype.random = function () {
        return this[Math.floor((Math.random()*this.length))]
    }
}
function endTurn()
function fight()

//
//Strategy phase
    //Cards dealt(4) -> Players cards populate, can see opponents cards(placement) -> You place cards -> Hit done btn
    //Hover effect when selecting card in hand hover effect when clicked on where it needs to be played
    //fx to move card back to hand or to different placement (optional)
    //
//Attack phase
    //Done btn addClass 'hide' -> show
    //Triggered by done btn -> animation? -> boxes behind board that show new attack/defense (if positive show number one color, negative another, dead another)
    //Cards attack left to right, card health updated(or killed), player health updated, 
        //all drawn and active cards removed from deck (cannot be drawed again)
        //remaining cards (updated defense, updated player health)
    //cards in hand removed from deck -> hit next btn

//isAlive ->decreases your defense by opp attack -> if !isAlive triggers random draw 

    //Back to strategy phase
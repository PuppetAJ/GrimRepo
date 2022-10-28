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

const router = require('express').Router();
const homeRoutes = require('./home-routes.js')

router.use('/', homeRoutes);

// If a non existent page is loaded send this
router.use((req, res) => {
  res.status(404).end();
});

// Export routes
module.exports = router;


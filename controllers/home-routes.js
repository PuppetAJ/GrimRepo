// Import models, helper functions, and router
const router = require('express').Router();
const withAuth = require('../utils/auth');
const { Player } = require('../models');

// GET '/' render homepage
router.get('/', (req, res) => {
  sess = req.session;
  res.render('homepage', {
    loggedIn: req.session.loggedIn
  }) 
});

// POST logout (destroy session if exists) ('/logout')
router.post('/logout', (req, res) => {
  if (req.session.loggedIn) {
    req.session.destroy(() => {
      res.status(204).end();
    });
  }
  else {
    res.status(404).end();
  }
});

// GET game page '/game'
router.get('/game', withAuth, (req, res) => {
  let username = req.session.username
  username = username.toUpperCase();
  res.render('game', {
    loggedIn: req.session.loggedIn,
    user_id: req.session.user_id,
    username: username
  })
});

// GET leaderboard page '/leaderboard'
router.get('/leaderboard', withAuth, (req, res) => {
  Player.findAll({
    order: [['highscore', 'DESC']],
    attributes: ['highscore', 'username'],
  })
  .then(dbPlayerData => {
    const scores = dbPlayerData;
    res.render('leaderboard', {
      scores,
      username: req.session.username
    })
  })
  .catch(err => {
      console.log(err);
      res.status(500).json(err);
  });
})

// Export router
module.exports = router;
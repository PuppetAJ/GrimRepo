const router = require('express').Router();
const withAuth = require('../utils/auth');

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

router.get('/game', withAuth, (req, res) => {
  res.render('game', {
    loggedIn: req.session.loggedIn,
    user_id: req.session.user_id,
    username: req.session.username
  })
});

router.get('/leaderboard', (req, res) => {
  res.render('leaderboard')
})



module.exports = router;
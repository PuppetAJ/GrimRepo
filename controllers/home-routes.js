const router = require('express').Router();
const withAuth = require('../utils/auth');

router.get('/', (req, res) => {
  res.render('homepage', {
    loggedIn: req.session.loggedIn
  });
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
    loggedIn: req.session.loggedIn
  })
})



module.exports = router;
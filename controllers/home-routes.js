const router = require('express').Router();
const path = require('path');

router.get('/', (req, res) => {
  res.render('homepage');
});

module.exports = router;
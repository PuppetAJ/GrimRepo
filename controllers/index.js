const router = require('express').Router();
const homeRoutes = require('./home-routes.js');
const apiRoutes = require('./api');

router.use('/', homeRoutes);
router.use('/api', apiRoutes);

// If a non existent page is loaded send this
router.use((req, res) => {
  res.status(404).end();
});

// Export routes
module.exports = router;


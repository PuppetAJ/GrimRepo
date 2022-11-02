// Import router
const router = require('express').Router();

// Import routes
const homeRoutes = require('./home-routes.js');
const apiRoutes = require('./api');

// Declare prefixes to use before routes
router.use('/', homeRoutes);
router.use('/api', apiRoutes);

// If a non existent page is loaded send this
router.use((req, res) => {
  res.status(404).end();
});

// Export routes
module.exports = router;


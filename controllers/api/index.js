// Import router
const router = require('express').Router();

// Import routes
const playerRoutes = require('./player-routes');
const cardRoutes = require('./card-routes');

// Declare prefix to use before routes
router.use('/players', playerRoutes);
router.use('/cards', cardRoutes);

// Export router
module.exports = router;
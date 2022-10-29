const router = require('express').Router();

const playerRoutes = require('./player-routes');

router.use('/player', playerRoutes);

module.exports = router;
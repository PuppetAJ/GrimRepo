const router = require('express').Router();

const playerRoutes = require('./player-routes');
const cardRoutes = require('./card-routes');

router.use('/players', playerRoutes);
router.use('/cards', cardRoutes);

module.exports = router;
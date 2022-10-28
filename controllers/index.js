<<<<<<< HEAD
const router = require('express').Router();
const homeRoutes = require('./home-routes.js')

router.use('/', homeRoutes);

// If a non existent page is loaded send this
router.use((req, res) => {
  res.status(404).end();
});

// Export routes
module.exports = router;

=======
>>>>>>> kenan

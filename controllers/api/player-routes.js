// Import router, models, and helper functions
const router = require('express').Router();
const { Player } = require('../../models');
const withAuth = require('../../utils/auth');

// GET all players /api/players
router.get('/', (req, res) => {
  Player.findAll({
    attributes: {exclude: ['password']}
  })
  .then(dbPlayerData => res.json(dbPlayerData))
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  });
});

// GET one player's data by session /api/players/highscore/
router.get('/highscore/', withAuth, (req, res) => {
  Player.findOne({
    attributes: {exclude: ['password']},

    where: {
      id: req.session.user_id
    }
  })
  .then(dbPlayerData => {
    if(!dbPlayerData) {
      res.status(404).json({message: `No player found with this id!`});
      return;
    }
    res.json(dbPlayerData);
  })
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  });
});

// GET one player by ID /api/players/:id
router.get('/:id', (req, res) => {
  Player.findOne({
    attributes: {exclude: ['password']},

    where: {
      id: req.params.id
    }
  })
  .then(dbPlayerData => {
    if(!dbPlayerData) {
      res.status(404).json({message: `No player found with this id!`});
      return;
    }
    res.json(dbPlayerData);
  })
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  });
});

// POST /api/players
router.post('/', (req, res) => {
  Player.create({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  })
  .then(dbPlayerData => {
    req.session.save(() => {
      req.session.user_id = dbPlayerData.id;
      req.session.username = dbPlayerData.username;
      req.session.loggedIn = true;

      res.json(dbPlayerData);
    });
  })
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  });
});

// POST login route /api/players/login
router.post('/login', (req, res) => {
  Player.findOne({
    where: {
      email: req.body.email
    }
  })
  .then(dbPlayerData => {
    if(!dbPlayerData) {
      res.status(400).json({message: 'No user with that email address!'});
      return;
    }

    const validPassword = dbPlayerData.checkPassword(req.body.password);

    if(!validPassword) {
      res.status(400).json({message: 'Incorrect Password!'});
      return;
    }
    
    req.session.save(() => {
      req.session.user_id = dbPlayerData.id;
      req.session.username = dbPlayerData.username;
      req.session.loggedIn = true;

      res.json({user: dbPlayerData, message: 'You are now logged in!'});
    })
  });
});

// PUT update player by ID /api/players/:id
router.put('/:id', (req, res) => {
  Player.update(req.body, {
    individualHooks: true,

    where: {
      id: req.params.id
    }
  })
  .then(dbPlayerData => {
    if(!dbPlayerData[0]) {
      res.status(404).json({message: 'No Player found with this id!'});
      return;
    }
    res.json(dbPlayerData);
  })
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  });
});

// PUT (route for updating using session ID) /api/players/ 
// Important not to have individual hooks enabled here, since 
router.put('/', withAuth, (req, res) => {
  Player.update(
  {
    highscore: req.body.score
  },
  {
    where: {
      id: req.session.user_id
    }
  })
  .then(dbPlayerData => {
    if(!dbPlayerData[0]) {
      res.status(404).json({message: 'No Player found with this id!'});
      return;
    }
    res.json(dbPlayerData);
  })
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  })
})

// DELETE Delete a player /api/players/1
router.delete('/:id', (req, res) => {
  Player.destroy({
    where: {
      id: req.params.id
    }
  })
  .then(dbUserData => {
    if (!dbUserData) {
      res.status(404).json({message: `No player found with this id`});
      return;
    }
    res.json(dbUserData);
  })
  .catch(err => {
    console.log(err);
    res.status(500).json(err);
  });
});

// Export router
module.exports = router;
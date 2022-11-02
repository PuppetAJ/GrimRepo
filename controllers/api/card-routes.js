// Declare imports
const router = require('express').Router();
const { Card } = require('../../models');

// GET all cards /api/cards/
router.get('/', (req, res) => {
  Card.findAll()
    .then(dbCardData => res.json(dbCardData))
    .catch(err => {
      console.log(err);
      res.status(500).json(err);
    });
});

// GET one card by ID /api/cards/:id
router.get('/:id', (req, res) => {
  Card.findOne({
    where: {
      id: req.params.id
    }
  })
    .then(dbCardData => {
      if(!dbCardData) {
        res.status(404).json({message: 'No card found with this id!'});
        return;
      }
      res.json(dbCardData);
    })
    .catch(err => {
      console.log(err);
      res.status(404).json(err);
    });
});

// GET one card by name /api/cards/name/:name
router.get('/name/:name', (req, res) => {
  Card.findOne({
    where: {
      name: req.params.name
    }
  })
    .then(dbCardData => {
      if(!dbCardData) {
        res.status(404).json({message: 'No card found with this name!'});
        return;
      }
      res.json(dbCardData);
    })
    .catch(err => {
      console.log(err);
      res.status(404).json(err);
    });
});

// We don't necessarily want users to be able to create and delete cards from our DB, however they are here if we need them

// CREATE a card /api/cards/
router.post('/', (req, res) => {
  Card.create({
    tier: req.body.tier,
    name: req.body.name,
    attack: req.body.attack,
    defense: req.body.defense,
    cost: req.body.cost
  })
    .then(dbCardData => res.json(dbCardData))
    .catch(err => {
      console.log(err);
      res.status(500).json(err);
    })
});

// UPDATE a card /api/cards/:id
router.put('/:id', (req, res) => {
  Card.update(req.body, {
    where: {
      id: req.params.id
    }
  })
    .then(dbCardData => {
      if (!dbCardData) {
        res.status(404).json({ message: 'No card found with this id!' });
        return;
      }
      res.json(dbCardData);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json(err);
    })
});

// DELETE a card /api/cards/:id
router.delete('/:id', (req,res) => {
  Card.destroy({
    where: {
      id: req.params.id
    }
  })
    .then(dbCardData => {
      if(!dbCardData) {
        res.status(404).json({ message: 'No card found with this id!' });
        return;
      }
      res.json(dbCardData);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json(err);
    })
});

// Export router
module.exports = router;

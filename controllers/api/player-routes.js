const router = require('express').Router();
const { Player } = require('../../models');

// Get /api/player
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

// GET /api/player/1
router.get('/:id', (req, res) => {
    Player.findOne({
        attributes: {exclude: ['password']},

        where: {
            id: req.params.id
        }
    })
        .then(dbPlayerData => {
            if(!dbPlayerData) {
                res.status(404).json({message: `No player found with this id`});
                return;
            }
            res.json(dbPlayerData);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json(err);
        });
});

// POST /api/player
router.post('/', (req, res) => {
    Player.create({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password
    })
        .then(dbPlayerData => res.json(dbPlayerData))
        .catch(err => {
            console.log(err);
            res.status(500).json(err);
        });
});

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

            res.json({user: dbPlayerData, message: 'You are now logged in!'});
        });
});

// PUT /api/player/1
router.put('/:id', (req, res) => {
    Player.update(req.body, {
        individualHooks: true,

        where: {
            id: req.params.id
        }
    })
        .then(dbPlayerData => {
            if(!dbPlayerData[0]) {
                res.status(404).json({message: 'No Player found with this id'});
                return;
            }
            res.json(dbPlayerData);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json(err);
        });
});

// DELETE /api/player/1
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
        })
});


module.exports = router;
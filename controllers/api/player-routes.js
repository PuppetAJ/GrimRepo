const router = require('express').Router();
const { Player } = require('../../models');

//GET all players
router.get('/', (req, res) => {
    Player.findAll({
        attributes: { exclude: ['password'] }
    })
        .then(dbPlayerData => res.json(dbPlayerData))
        .catch(err => {
            console.log(err);
            res.status(500).json(err);
        });
});

//GET single player
router.get('/:id', (req,res) => {
    Player.findOne({
        where: {
            id: req.params.id
        }
    })
    .then(dbPlayerData => {
        if(!dbPlayerData) {
            res.status(404).json({ message: 'No player found with this id' });
            return;
        }
        res.json(dbPlayerData);
    })
    .catch(err => {
        console.log(err);
        res.status(500).json(err);
    });
});

//POST creates a user
router.post('/', (req, res) => {
    //expects {username: 'kwm0304', password: 'password1234', health: 20, wins: 5, losses: 1}
    Player.create({
        username: req.body.username,
        password: req.body.password,
        health: req.body.health,
        wins: req.body.wins,
        losses: req.body.losses
    })
    .then(dbPlayerData => {
        req.session.save(() => {
            req.session.id = dbPlayerData.id;
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

//PUT updates a player
router.put('/:id', (req, res) => {
    Player.update(req.body, {
        where: {
            id: req.params.id
        }
    })
    .then(dbPlayerData => {
        if (!dbPlayerData[0]) {
            res.status(404).json({ message: 'No player found with this id' });
            return;
        }
        res.json(dbPlayerData);
    })
    .catch(err => {
        console.log(err);
        res.status(500).json(err);
    });
});    

//DELETE a player
router.delete('/:id', (req, res) => {
    Player.destroy({
        where: {
            id: req.params.id
        }
    })
        .then(dbPlayerData => {
            if (!dbPlayerData) {
                res.status(404).json({ message: 'No user found with this id' });
                return;
            }
            res.json(dbPlayerData);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json(err);
        })
})

module.exports = router;


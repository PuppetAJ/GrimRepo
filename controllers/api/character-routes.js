const router = require('express').Router();
const { Characters } = require('../../models');

router.get('/', (req, res) => {
      })

      router.get('/:id', (req,res) => {
        Character.findOne({
            where: {
                id: req.params.id
            }
        })
        .then(dbPlayerData => {
            if(!dbPlayerData) {
                res.status(404).json({ message: 'No player found with this id' });
                return;
            }
            res.json(db);
        })
        .catch(err => {
            console.log(err);
            res.status(500).json(err);
        });
    });
module.exports = router;
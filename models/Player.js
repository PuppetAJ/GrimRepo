const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');
const bcrypt = require('bcrypt');

//Player Model
class Player extends Model {
    checkPassword(loginPw) {
        return bcrypt.compareSync(loginPw, this.password);
    }
}

Player.init (
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            // validate: {
            //     isUsername: true
            // }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: [8]
            }
        },
        health: {
            type: DataTypes.INTEGER
        },
        wins: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        losses: {
            type: DataTypes.INTEGER,
            allowNull: true
        }    
        
    },
    {
        hooks: {
            async beforeCreate(newPlayerData) {
                newPlayerData.password = await bcrypt.hash(newPlayerData.password, 10);
                return newPlayerData;
            },
            
            async beforeUpdate(updatePlayerData) {
                updatePlayerData.password = await bcrypt.hash(updatePlayerData.password, 10);
                return updatePlayerData;
            }
        },

        sequelize,
        timestamps: false,
        freezeTableName: true,
        modelName: 'Player'
    }
)

module.exports = Player;
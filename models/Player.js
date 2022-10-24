const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

//Player Model
class Player extends Model {}

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
            validate: {
                isUsername: true
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
        sequelize,
        timestamps: false,
        freezeTableName: true,
        modelName: 'Player'
    }
)

module.exports = Player;
const { Model, DataTypes } = require("sequelize");
const sequelize = require('../config/connection');

class Card extends Model {}

Card.init(
    {
        //define id column
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        tier: {
            type: DataTypes.STRING,
            notNull: true,
            validate: {
                len: [1]
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            // validate: {
            //     isName: true
            // }
        },
        attack: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        defense: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        cost: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    },
    {
        sequelize,
        timestamps: false,
        freezeTableName: true,
        underscored: true,
        modelName: 'cards'
    }
);

module.exports = Card;
// Imports
const { Model, DataTypes } = require("sequelize");
const sequelize = require('../config/connection');

// Declare model constructor
class Card extends Model {}

// Initialize card table / model columns
Card.init(
  {
    // Define columns
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
      allowNull: false
    },
    attack: {
      type: DataTypes.INTEGER,
      allowNull: true
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
    // table settings
    sequelize,
    timestamps: false,
    freezeTableName: true,
    underscored: true,
    modelName: 'cards'
  }
);

// Export model
module.exports = Card;
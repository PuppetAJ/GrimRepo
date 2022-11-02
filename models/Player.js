// Imports
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');
const bcrypt = require('bcrypt');

// Player model / constructor
class Player extends Model {
  // method for checking password on each player using bcrypt
  checkPassword(loginPw) {
    return bcrypt.compareSync(loginPw, this.password);
  }
}

// Player table initialization
Player.init (
    // columns
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
      unique: true
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
    highscore: {
      type: DataTypes.INTEGER
    }
  },
  {
    // hooks to use before creation / updating
    hooks: {
      async beforeCreate(newPlayerData) {
        newPlayerData.password = await bcrypt.hash(newPlayerData.password, 10);
        return newPlayerData;
      },
      
      async beforeUpdate(updatePlayerData) {
        updatePlayerData.password = await bcrypt.hash(updatePlayerData.password, 10);
        return updatePlayerData;
      },

      async beforeBulkCreate(newUsersData) {
        // Before bulk user creation, each password must be hashed
        hashedUsersData = [];
        for (i=0; i < newUsersData.length; i++) {
          newUsersData[i].password = await bcrypt.hash(newUsersData[i].password, 10);
          hashedUsersData.push(newUsersData[i]);
        }
        return hashedUsersData;
      }
    },

    // table settings
    sequelize,
    timestamps: false,
    freezeTableName: true,
    modelName: 'Player'
  }
)

// Export model
module.exports = Player;
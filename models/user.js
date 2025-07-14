'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      this.belongsToMany(models.Subject, { through: 'UserSubjects' });
      this.hasMany(models.Task, { as: 'authoredTasks', foreignKey: 'authorId' });
      this.hasMany(models.Task, { as: 'assignedTasks', foreignKey: 'assignedToId' });
    }
  }
  
  User.init({
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      validate: {
        len: [3, 20],
      }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('student', 'teacher', 'admin'),
      defaultValue: 'student'
    },
    score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'User',
  });
  
  return User;
};
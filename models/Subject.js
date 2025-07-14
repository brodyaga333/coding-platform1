'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subject extends Model {
    static associate(models) {
      this.belongsToMany(models.User, { through: 'UserSubjects' });
      this.hasMany(models.Task);
    }
  }
  
  Subject.init({
    name: { 
      type: DataTypes.STRING, 
      allowNull: false 
    }
  }, {
    sequelize,
    modelName: 'Subject',
  });
  
  return Subject;
};
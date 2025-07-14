'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserSubject extends Model {}
  
  UserSubject.init({}, {
    sequelize,
    modelName: 'UserSubject',
    tableName: 'UserSubjects'
  });
  
  return UserSubject;
};
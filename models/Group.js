'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Group extends Model {
    static associate(models) {
      // Множество пользователей в группе
      this.belongsToMany(models.User, { through: 'GroupUsers', foreignKey: 'groupId' });
      // Группа может иметь много задач
      this.hasMany(models.Task, { foreignKey: 'groupId' });
    }
  }
  Group.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Group',
  });
  return Group;
};

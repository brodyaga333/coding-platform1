'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Task extends Model {
    static associate(models) {
      this.belongsTo(models.User, { as: 'author', foreignKey: 'authorId' });
      this.belongsTo(models.User, { as: 'assignedTo', foreignKey: 'assignedToId' });
      this.belongsTo(models.Subject, { foreignKey: 'subjectId' });
      this.belongsTo(models.Group, { foreignKey: 'groupId' });

    }
  }
  
  Task.init({
    title: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT, 
      allowNull: false 
    },
    deadline: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
    priority: { 
      type: DataTypes.ENUM('high', 'medium', 'low'), 
      defaultValue: 'medium' 
    },
    status: { 
      type: DataTypes.ENUM('todo', 'in_progress', 'completed'), 
      defaultValue: 'todo' 
    },
    rewardPoints: { 
      type: DataTypes.INTEGER, 
      defaultValue: 10 
    },
    groupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Groups',
            key: 'id'
        }
    },
    subjectId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'Subjects', key: 'id' }
    }
  }, 
  {
    sequelize,
    modelName: 'Task',
  });
  
  return Task;
};
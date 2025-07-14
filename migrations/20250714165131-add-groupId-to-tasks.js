'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Tasks', 'groupId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Groups',  // имя таблицы, на которую ссылаемся (проверь, как у тебя называется)
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Tasks', 'groupId');
  }
};

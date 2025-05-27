module.exports = (sequelize, DataTypes) => {
  return sequelize.define("User", {
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
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user'
    },
    score: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
  });
};
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Problem extends Model { }
    Problem.init({
        title: { type: DataTypes.STRING, allowNull: false },
        description: { type: DataTypes.TEXT, allowNull: false },
        templateCode: DataTypes.TEXT,
        testCases: {
            type: DataTypes.JSONB,
            validate: {
                isValid(value) {
                    if (!Array.isArray(value)) {
                        throw new Error('Test cases must be an array');
                    }
                    value.forEach((test, i) => {
                        if (!test.hasOwnProperty('input') || !test.hasOwnProperty('expected')) {
                            throw new Error(`Test case ${i} must have 'input' and 'expected' properties`);
                        }
                    });
                }
            }
        },
        difficulty: {
            type: DataTypes.ENUM('beginner', 'intermediate', 'expert'),
            allowNull: false,
            defaultValue: 'beginner'
        },
        createdByAI: { type: DataTypes.BOOLEAN, defaultValue: false }
    }, {
        sequelize,
        modelName: 'Problem',
        tableName: 'Problems'
    });
    return Problem;
};

const express = require('express');
const router = express.Router();
const { Problem } = require('../models');

router.get('/', async (req, res) => {
    try {
        const problems = await Problem.findAll();
        res.json(problems);
    } catch (error) {
        console.error('Ошибка при получении задач:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

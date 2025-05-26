require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize, Problem } = require('./models');
require('dotenv').config();
const axios = require('axios');
const { Task, TestCase } = require('./models'); // если нужно, поправим путь

async function start() {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected');
        await sequelize.sync();

        const app = express();
        app.use(cors());
        app.use(express.json());

        // Получение задач по уровню сложности
        app.get('/api/problems', async (req, res) => {
            try {
                const difficulty = (req.query.difficulty || 'beginner').toLowerCase().trim();
                const problems = await Problem.findAll({ where: { difficulty } });
                res.json(problems);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Ошибка при получении задач' });
            }
        });


    app.post('/api/jdoodle', async (req, res) => {
        const { code, input, language } = req.body;

        const payload = {
            clientId: process.env.JDOODLE_CLIENT_ID,
            clientSecret: process.env.JDOODLE_CLIENT_SECRET,
            script: code,
            language,
            versionIndex: getVersionIndex(language),
            stdin: input || ''
        };

        try {
            const response = await fetch('https://api.jdoodle.com/v1/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            res.json(data);
        } catch (err) {
            console.error('JDoodle API error:', err);
            res.status(500).json({ error: 'Ошибка при выполнении кода через JDoodle' });
        }
    });

    // вспомогательная функция
    function getVersionIndex(lang) {
        const map = {
            python3: '4',
            java: '4',
            cpp: '5',
            c: '5'
        };
        return map[lang] || '0';
    }

    app.post('/run-tests/:taskId', async (req, res) => {
    const { code, language } = req.body;
    const { taskId } = req.params;

    try {
        const task = await Task.findByPk(taskId);
        if (!task || task.type !== 'code') {
        return res.status(400).json({ error: 'Неверный тип задачи или задача не найдена' });
        }

        const testCases = await TestCase.findAll({ where: { taskId } });

        const languageMap = {
        cpp: 'cpp17',
        c: 'c',
        java: 'java',
        python3: 'python3'
        };

        const results = [];

        for (const testCase of testCases) {
        const payload = {
            script: code,
            language: languageMap[language],
            versionIndex: '0',
            stdin: testCase.input,
            clientId: process.env.JDOODLE_CLIENT_ID,
            clientSecret: process.env.JDOODLE_CLIENT_SECRET
        };

        try {
            const { data } = await axios.post('https://api.jdoodle.com/v1/execute', payload);
            const cleanedOutput = (data.output || '').trim();
            const expected = testCase.output.trim();

            results.push({
            input: testCase.input,
            output: cleanedOutput,
            expected,
            passed: cleanedOutput === expected
            });
        } catch (err) {
            results.push({
            input: testCase.input,
            output: 'Ошибка компиляции или JDoodle',
            expected: testCase.output.trim(),
            passed: false
            });
        }
        }

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
    });


    



        // Статические файлы
        app.use(express.static(path.join(__dirname, 'public')));

        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
    } catch (err) {
        console.error('❌ Fatal error:', err);
    }


}



start();

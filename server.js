require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize, Problem } = require('./models');
require('dotenv').config();
const axios = require('axios');


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


    app.post('/api/judge0', async (req, res) => {
        const { code, input, language_id } = req.body;

        try {
            const response = await axios.post(
                'http://localhost:2358/submissions?base64_encoded=false&wait=true',
                {
                    source_code: code,
                    stdin: input || '',
                    language_id
                },
                {
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            res.json(response.data);
        } catch (error) {
            console.error('Ошибка при работе с Judge0:', error.message);
            res.status(500).json({ error: 'Ошибка выполнения через Judge0' });
        }
    });


    function normalizeOutput(output) {
        if (typeof output === 'object') {
            output = JSON.stringify(output);
        }
        return String(output).trim().replace(/\r/g, '').replace(/\s+$/gm, '');
    }


    app.post('/api/run-task-tests/:taskId', async (req, res) => {
        const { taskId } = req.params;
        const { code, language, input } = req.body;

        try {
            // Получаем задачу из базы
            const task = await Problem.findByPk(taskId);
            if (!task) return res.status(404).json({ error: 'Задача не найдена' });

            // Парсим тесты из БД
           let testCases = task.testCases;
            if (!Array.isArray(testCases)) {
                return res.status(500).json({ error: 'testCases должно быть массивом' });
            }

            // Функция для преобразования входных данных теста в строку для stdin
            function prepareInput(inputVal) {
            if (Array.isArray(inputVal)) {
                return inputVal.join(' ') + '\n';
            } else if (typeof inputVal === 'object' && inputVal !== null) {
                return Object.values(inputVal).join(' ') + '\n';
            } else {
                return String(inputVal) + '\n';
            }
            }

           

            // Иначе запускаем все тесты из БД
            const results = [];
            for (const test of testCases) {
                const testInput = prepareInput(test.input);
                const expectedOutput = normalizeOutput(test.expected);

                const actualOutput = normalizeOutput(await runCodeOnJudge0({ code, language, input: testInput }));
                
                const passed = expectedOutput === actualOutput;
                
                results.push({
                    input: testInput.trim(),
                    expected: expectedOutput,
                    output: actualOutput.trim(),
                    passed
                });
            }
            

            res.json(results);

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Внутренняя ошибка сервера' });
        }
    });



    



    async function runCodeOnJudge0({ code, language, input }) {
        const languageMap = {
            python3: 71,
            java: 62,
            cpp: 54,
            c: 50
        };

        const language_id = languageMap[language.toLowerCase()] || 71;

        try {
            const response = await axios.post(
            'http://localhost:2358/submissions?base64_encoded=false&wait=true',
            {
                source_code: code,
                stdin: input || '',
                language_id
            },
            { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.data.stdout !== null) return response.data.stdout;
            if (response.data.compile_output) return response.data.compile_output;
            if (response.data.stderr) return response.data.stderr;

            return '';
        } catch (err) {
            console.error('Ошибка Judge0:', err.message);
            throw new Error('Ошибка вызова Judge0');
        }
    }


        // Статические файлы
        app.use(express.static(path.join(__dirname, 'public')));

        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
    } catch (err) {
        console.error('❌ Fatal error:', err);
    }


}



start();

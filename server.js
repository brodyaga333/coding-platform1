require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize, Problem, User } = require('./models');

const axios = require('axios');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require('express-session');


async function start() {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected');
        await sequelize.sync();

        const app = express();
        app.use(cors({
            origin: 'http://localhost:4000', // Укажите ваш фронтенд-URL
            credentials: true // Разрешите передачу кук
        }));
        app.use(express.json());

        app.use(session({
            secret: 'secret string',
            resave: false,
            saveUninitialized: false,
            cookie: {
                httpOnly: true,
                secure: false, // true если HTTPS
                maxAge: 24 * 60 * 60 * 1000 // 1 день
            }
        }));

        // Получение задач по уровню сложности
       


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

        function computeLevel(score) {
            const thresholds = [0, 100, 250, 500, 1000]; // можно расширить
            let level = 1;
            for (let i = 0; i < thresholds.length; i++) {
                if (score >= thresholds[i]) {
                    level = i + 1;
                }
            }
            const nextLevelThreshold = thresholds[level] || (score + 100);
            return { level, nextLevelThreshold };
        }


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

        app.post('/api/add-problem', isAuthenticated, isAdmin, async (req, res) => {
            try {
                const { title, description, templateCode, testCases, difficulty } = req.body;

                const problem = await Problem.create({
                    title,
                    description,
                    templateCode,
                    testCases,
                    difficulty
                });

                res.status(201).json(problem);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Ошибка при добавлении задачи' });
            }
        });


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
                
                const allPassed = results.every(r => r.passed);

                if (allPassed && req.session.user) {
                    const user = await User.findByPk(req.session.user.id);
                    if (user) {
                        const reward = task.rewardPoints || 20; // по умолчанию 20, если поле есть
                        user.score += reward;
                        await user.save();
                    }
                }
                
                res.json(results);

            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
        });

        app.post('/api/register', async (req, res) => {
            const { username, password } = req.body;
            const hash = await bcrypt.hash(password, saltRounds);
            try {
                const user = await User.create({ username, passwordHash: hash });
                res.json({ success: true, user });
            } catch (err) {
                res.status(400).json({ error: 'Пользователь уже существует или ошибка валидации' });
            }
        });

        

        app.post('/api/login', async (req, res) => {
            console.log('Login attempt:', req.body);
            try {
                const { username, password } = req.body;
                const user = await User.findOne({ where: { username } });
                if (!user) {
                return res.status(401).json({ error: 'Пользователь не найден' });
                }
                const validPassword = await bcrypt.compare(password, user.passwordHash);
                if (!validPassword) {
                return res.status(401).json({ error: 'Неверный пароль' });
                }
                req.session.user = { id: user.id, username: user.username, role: user.role || 'user' };
                return res.json({ message: 'Успешный вход' });
            } catch (err) {
                console.error('Login error:', err);
                return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
            }
        });

        



        

        app.post('/api/logout', (req, res) => {
            req.session.destroy(() => {
                res.json({ success: true });
            });
        });
        
        function isAdmin(req, res, next) {
            if (req.session.user && req.session.user.role === 'admin') {
                return next();
            }
            return res.status(403).json({ error: 'Доступ запрещён' });
        }

        function isAuthenticated(req, res, next) {
        if (req.session && req.session.user && req.session.user.id) {
            return next();
        }
        return res.status(401).json({ error: 'Неавторизованный доступ' });
    }

        app.get('/api/me', isAuthenticated, async (req, res) => {
            const user = await User.findByPk(req.session.user.id); // Sequelize
            if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

            const score = Number(user.score); // защита
            const { level, nextLevelThreshold } = computeLevel(score);

            res.json({
                username: user.username,
                role: user.role, 
                score: user.score,
                level,
                nextLevelThreshold,
            });
        });


        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        app.get('/tasks.html', (req, res) => {
            if (!req.session.user) {
                return res.redirect('/');
            }
            res.sendFile(path.join(__dirname, 'public', 'tasks.html'));
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
        // После настройки статических файлов добавьте:
        
        const PORT = process.env.PORT || 4000;
        app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
    } catch (err) {
        console.error('❌ Fatal error:', err);
    }


}



start();

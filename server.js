require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize, User, Subject, Task, Group } = require('./models');


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

        app.use((req, res, next) => {
            if (req.session && req.session.user) {
                req.user = req.session.user;
            }
            next();
        });

       
        app.post('/api/subjects', isAuthenticated, isTeacher, async (req, res) => {
            try {
                const { name } = req.body;
                const subject = await Subject.create({ name });
                res.status(201).json(subject);
            } catch (error) {
                res.status(500).json({ error: 'Ошибка при создании предмета' });
            }
            });





        app.post('/api/tasks', isAuthenticated, async (req, res) => {
            try {
                const { title, description, deadline, priority, subjectId, assignedToId } = req.body;
                
                // Валидация данных
                if (!title || !description || !deadline || !subjectId || !assignedToId) {
                return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
                }

                const task = await Task.create({
                title,
                description,
                deadline: new Date(deadline),
                priority: priority || 'medium',
                subjectId,
                authorId: req.session.user.id,
                assignedToId,
                status: 'todo',
                rewardPoints: calculateRewardPoints(priority) // Добавим функцию расчета баллов
                });

                // Возвращаем задачу с связанными данными
                const createdTask = await Task.findByPk(task.id, {
                include: [
                    { model: User, as: 'author' },
                    { model: User, as: 'assignedTo' },
                    { model: Subject }
                ]
                });

                res.status(201).json(createdTask);
            } catch (error) {
                console.error('Ошибка создания задачи:', error);
                res.status(500).json({ error: 'Ошибка при создании задачи' });
            }
        });

        // Функция расчета баллов за задачу
        function calculateRewardPoints(priority) {
            const points = {
                high: 30,
                medium: 20,
                low: 10
            };
            return points[priority] || 20;
        }


        app.get('/api/tasks', isAuthenticated, async (req, res) => {
            try {
                console.log('Текущий пользователь:', req.session.user);
                const { subjectId, status, assigneeId, priority } = req.query;
                const where = {};

                // 🎓 Если пользователь — студент: показывать только свои задачи
                if (req.session.user.role === 'student') {
                where.assignedToId = req.session.user.id;
                }

                // 👨‍🏫 Если преподаватель и выбран конкретный студент
                if (req.session.user.role === 'teacher' && assigneeId && assigneeId !== 'all') {
                where.assignedToId = assigneeId;
                }

                // 📘 Фильтр по предмету
                if (subjectId && subjectId !== 'all') {
                where.subjectId = subjectId;
                }

                // ✅ Фильтр по статусу
                if (status && status !== 'all') {
                where.status = status;
                }

                // 🔥 Фильтр по приоритету (раньше его не было)
                if (priority && priority !== 'all') {
                where.priority = priority;
                }

                const tasks = await Task.findAll({
                where,
                include: [
                    { model: User, as: 'author', attributes: ['id', 'username', 'role', 'score'] },
                    { model: User, as: 'assignedTo', attributes: ['id', 'username', 'role', 'score'] },
                    { model: Subject, attributes: ['id', 'name'] }
                ],
                order: [['deadline', 'ASC']]
                });

                // 🧾 Убедимся, что tasks — это массив
                if (!Array.isArray(tasks)) {
                console.error('Ожидался массив задач, но получен:', tasks);
                return res.status(500).json({ error: 'Ошибка получения задач (неверный формат)' });
                }

                res.json(tasks);
            } catch (err) {
                console.error('Ошибка при GET /api/tasks:', err); 
                res.status(500).json({ error: 'Ошибка при получении задач' });
            }
        });


        app.put('/api/tasks/:id/status', isAuthenticated, async (req, res) => {
            try {
                const task = await Task.findByPk(req.params.id);
                if (!task) return res.status(404).json({ error: 'Задача не найдена' });
                
                task.status = req.body.status;
                await task.save();
                
                // Начисление баллов при завершении
                if (task.status === 'completed') {
                const user = await User.findByPk(task.assignedToId);
                user.score += task.rewardPoints;
                await user.save();
                }
                
                res.json(task);
            } catch (error) {
                res.status(500).json({ error: 'Ошибка при обновлении задачи' });
            }
            });

        app.get('/api/subjects', isAuthenticated, async (req, res) => {
            try {
                const subjects = await Subject.findAll();
                res.json(subjects);
            } catch (err) {
                res.status(500).json({ error: 'Ошибка при получении предметов' });
            }
        });

        // Добавьте middleware для проверки роли преподавателя
        function isTeacher(req, res, next) {
            if (req.session.user && (req.session.user.role === 'teacher' || req.session.user.role === 'admin')) {
                return next();
            }
            return res.status(403).json({ error: 'Доступ запрещён' });
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




        app.post('/api/register', async (req, res) => {
            const { username, password, role } = req.body;
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

        

        app.get('/api/groups', isAuthenticated, async (req, res) => {
            try {
                const groups = await Group.findAll({
                include: [
                    {
                    model: User,
                    attributes: ['id', 'username'],
                    through: { attributes: [] }
                    }
                ]
                });
                res.json(groups);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Ошибка при получении групп' });
            }
        });


        // Создать новую группу
        app.post('/api/groups', isAuthenticated, isTeacher, async (req, res) => {
            try {
                const { name } = req.body;
                const group = await Group.create({ name });
                res.status(201).json(group);
            } catch (err) {
                res.status(500).json({ error: 'Ошибка при создании группы' });
            }
        });

        // Назначить студентов в группу
        app.put('/api/groups/:id/users', isAuthenticated, isTeacher, async (req, res) => {
            try {
                const group = await Group.findByPk(req.params.id);
                if (!group) return res.status(404).json({ error: 'Группа не найдена' });
                const { userIds } = req.body; // [1,2,3]
                await group.setUsers(userIds);
                const updated = await Group.findByPk(group.id, {
                include: [{ model: User, through: { attributes: [] }, attributes: ['id', 'username'] }]
                });
                res.json(updated);
            } catch (err) {
                res.status(500).json({ error: 'Ошибка при назначении пользователей' });
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
            if (req.session.user) return next();
            return res.status(403).json({ message: 'Unauthorized' });
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

        app.get('/api/users', isAuthenticated, isTeacher, async (req, res) => {
            try {
                const users = await User.findAll({
                where: { role: 'student' },
                attributes: ['id', 'username']
                });
                res.json(users);
            } catch (err) {
                res.status(500).json({ error: 'Ошибка при получении пользователей' });
            }
        });


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

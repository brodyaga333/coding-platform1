const express = require('express');
const router = express.Router();

// Для примера — храним пользователей в памяти
const users = [];

router.post('/register', (req, res) => {
  const { name, password } = req.body;
  if (users.find(u => u.name === name)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const user = { name, password };
  users.push(user);
  res.json({ success: true });
});

router.post('/login', (req, res) => {
  const { name, password } = req.body;
  const user = users.find(u => u.name === name && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Сохраняем пользователя в сессии
  req.session.user = { name };
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

module.exports = router;
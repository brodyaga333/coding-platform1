let editors = {};

function getDifficultyLabel(difficulty) {
  const labels = {
    beginner: 'Начинающий',
    intermediate: 'Продвинутый',
    expert: 'Эксперт'
  };
  return labels[difficulty] || difficulty;
}

function getLanguageMode(lang) {
  const map = {
    python3: 'python',
    cpp: 'text/x-c++src',
    c: 'text/x-csrc',
    java: 'text/x-java'
  };
  return map[lang] || 'python';
}

// загрузка задач
async function loadTasks(difficulty = 'beginner') {
  const container = document.getElementById('tasks-container');
  container.innerHTML = 'Загрузка задач...';
  editors = {}; // Очистка старых редакторов

  try {
    const res = await fetch(`/api/problems?difficulty=${difficulty}`);
    if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);

    const tasks = await res.json();

    container.innerHTML = tasks.map(task => {
      const textareaId = `gen-code-${task.id}`;
      const langSelectId = `gen-lang-${task.id}`;
      const resultId = `gen-result-${task.id}`;

      return `
        <div class="task" id="task-${task.id}">
          <div class="difficulty ${task.difficulty}">${getDifficultyLabel(task.difficulty)}</div>
          <h3>${task.title}</h3>
          <p>${task.description}</p>
          <pre>${task.templateCode.replace(/\\n/g, '\n')}</pre>
          <textarea id="${textareaId}">${task.templateCode}</textarea><br>
          <select id="${langSelectId}" onchange="updateEditorMode(${task.id})">
            <option value="python3">Python 3</option>
            <option value="cpp">C++</option>
            <option value="c">C</option>
            <option value="java">Java</option>
          </select>
          <button onclick="compileWithJudge0(${task.id})">▶ Проверить</button>
          <div id="${resultId}" class="result"></div>
        </div>
      `;
    }).join('');

    // Инициализируем CodeMirror
    tasks.forEach(task => {
        const textarea = document.getElementById(`gen-code-${task.id}`);
        const langSelect = document.getElementById(`gen-lang-${task.id}`);
        const initialLang = langSelect.value || 'python3'; // язык из селекта

        const editor = CodeMirror.fromTextArea(textarea, {
            lineNumbers: true,
            mode: getLanguageMode(initialLang),  // выставляем правильный режим
            theme: 'default'
        });

        editors[task.id] = editor;
    });

  } catch (err) {
    container.innerHTML = `Ошибка: ${err.message}`;
    console.error(err);
  }
}

function isAuthenticated(req, res, next) {
  console.log('isAuthenticated start');
  if (req.session.user) {
    console.log('Пользователь аутентифицирован, идём дальше');
    return next();
  }
  console.log('Пользователь НЕ аутентифицирован, отдаём 401');
  return res.status(401).json({ error: 'Требуется вход' });
}


function isAdmin(req, res, next) {
  if (req.session.user?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Только для админов' });
}

function updateEditorMode(taskId) {
    const lang = document.getElementById(`gen-lang-${taskId}`).value;
    const mode = getLanguageMode(lang);
    const editor = editors[taskId];
    if (editor) editor.setOption('mode', mode);
}

// компиляция через Judge0
async function compileWithJudge0(taskId) {
  const code = editors[taskId]?.getValue() || '';
  const language = document.getElementById(`gen-lang-${taskId}`).value;
  const resultDiv = document.getElementById(`gen-result-${taskId}`);

  resultDiv.innerHTML = '⏳ Выполняются тесты...';

  try {
    const res = await fetch(`/api/run-task-tests/${taskId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language })
    });

    if (!res.ok) throw new Error(`Ошибка сервера: ${res.status} ${await res.text()}`);
    const results = await res.json();

    resultDiv.innerHTML = results.map(test => `
      <div style="background:${test.passed ? '#d4edda' : '#f8d7da'};padding:10px;margin-bottom:5px;">
        <strong>Ввод:</strong> <pre>${test.input}</pre>
        <strong>Ожидалось:</strong> <pre>${test.expected}</pre>
        <strong>Получено:</strong> <pre>${test.output}</pre>
        <strong>Результат:</strong> ${test.passed ? '✅ Пройден' : '❌ Не пройден'}
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    resultDiv.innerHTML = `<span style="color:red;">❌ Ошибка: ${err.message}</span>`;
  }
}

async function login(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    username: form.username.value,
    password: form.password.value
  };

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Добавьте эту строку
    body: JSON.stringify(data)
  });

  const msg = document.getElementById('login-msg');
  if (res.ok) {
    window.location.href = '/tasks.html'; // Исправьте редирект
  } else {
    const err = await res.json();
    msg.textContent = err.error || 'Ошибка входа';
  }
}

async function checkAuth() {
    const res = await fetch('/api/me');
    if (!res.ok) {
        window.location.href = '/auth.html';
        return false;
    }

    const user = await res.json();
    console.log('Response user:', user);

    const score = Number(user.score);
    const level = Number(user.level);
    const nextLevelThreshold = Number(user.nextLevelThreshold);

    console.log({score, level, nextLevelThreshold});

    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-level').textContent = level;
    document.getElementById('profile-score').textContent = score;
    document.getElementById('profile-next').textContent = nextLevelThreshold - score;

    localStorage.setItem('username', user.username);
    localStorage.setItem('level', level);
    localStorage.setItem('score', score);
    localStorage.setItem('nextLevel', nextLevelThreshold);

    if (user.role === 'admin') {
      const openBtn = document.getElementById('open-admin-btn');
      openBtn.style.display = 'block';

      openBtn.addEventListener('click', showAdminPanel); // ✅ Показывать форму только при клике
      document.getElementById('add-task-form').addEventListener('submit', handleAddTask);
    }

    return true;
}

function computeLevel(score) {
    score = Number(score);
    const levelThresholds = [0, 100, 250, 500, 1000]; // можно расширить
    let level = 1;

    for (let i = 0; i < levelThresholds.length; i++) {
        if (score >= levelThresholds[i]) {
        level = i + 1;
        }
    }

    const nextLevelThreshold = levelThresholds[level] || (score + 100);
    return { level, nextLevelThreshold };
}



// функции для admin
function showAdminPanel() {
  document.getElementById('admin-panel').style.display = 'block';
  document.getElementById('admin-panel-overlay').style.display = 'block';
}

function closeAdminPanel() {
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-panel-overlay').style.display = 'none';
}

function addTestCase() {
    const container = document.getElementById('test-cases');
    const newTest = document.createElement('div');
    newTest.className = 'test-case';
    newTest.innerHTML = `
        <input type="text" placeholder="Ввод" class="test-input">
        <input type="text" placeholder="Ожидаемый вывод" class="test-expected">
        <button type="button" onclick="removeTestCase(this)">×</button>
    `;
    container.appendChild(newTest);
}

function removeTestCase(button) {
    button.parentElement.remove();
}

async function handleAddTask(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        data.testCases = JSON.parse(data.testCases);
    } catch (err) {
        alert('Ошибка в JSON тестов');
        return;
    }

    const res = await fetch('/api/add-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
    });

    const result = await res.json();

    const resultDiv = document.getElementById('add-problem-result');
    if (res.ok) {
        resultDiv.textContent = '✅ Задача успешно добавлена!';
        form.reset();
    } else {
        resultDiv.textContent = '❌ Ошибка: ' + (result.error || 'неизвестная');
    }
}





function showProfile() {
    document.getElementById('profile-details').style.display = 'block';
}

function hideProfile() {
    document.getElementById('profile-details').style.display = 'none';
}








window.onload = async () => {
  const authorized = await checkAuth();
  if (authorized) {
    loadTasks('beginner');

    // Назначаем обработчик только если форма уже есть
    const form = document.getElementById('add-task-form');
    if (form) {
      form.addEventListener('submit', handleAddTask);
    }

  }
};


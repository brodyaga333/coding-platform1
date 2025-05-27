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
      const editor = CodeMirror.fromTextArea(textarea, {
        lineNumbers: true,
        mode: getLanguageMode('python3'), // По умолчанию
        theme: 'default'
      });
      editors[task.id] = editor;
    });

  } catch (err) {
    container.innerHTML = `Ошибка: ${err.message}`;
    console.error(err);
  }
}

function updateEditorMode(taskId) {
    const lang = document.getElementById(`gen-lang-${taskId}`).value;
    const mode = getLanguageMode(lang);
    const editor = editors[taskId];
    if (editor) editor.setOption('mode', mode);
}

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

window.onload = () => loadTasks('beginner');
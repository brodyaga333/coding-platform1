async function loadTasks(difficulty = 'beginner') {
    const container = document.getElementById('tasks-container');
    container.innerHTML = 'Загрузка задач...';

    try {
        const res = await fetch(`/api/problems?difficulty=${difficulty}`);
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);

        const tasks = await res.json();
        if (!Array.isArray(tasks)) throw new Error('Неверный формат данных');

        container.innerHTML = tasks.map(task => `
            <div class="task" id="task-${task.id}">
                <div class="difficulty ${task.difficulty}">
                    ${getDifficultyLabel(task.difficulty)}
                </div>
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <pre>${task.templateCode.replace(/\\n/g, '\n')}</pre>

                <textarea id="gen-code-${task.id}" rows="10" cols="80" placeholder="Введите код здесь..."></textarea><br>
                <textarea id="gen-input-${task.id}" rows="5" cols="80" placeholder="Введите входные данные (если есть)...">${(task.testCases?.[0]?.input || '')}</textarea>
                <select id="gen-lang-${task.id}">
                    <option value="python3">Python 3</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="java">Java</option>
                </select>
                <br>
                <button onclick="compileWithJDoodle(${task.id})">▶ Выполнить через JDoodle</button>
                <div id="gen-result-${task.id}" class="result"></div>

                

                
            </div>
        `).join('');

        
    } catch (err) {
        container.innerHTML = `Ошибка: ${err.message}`;
        console.error(err);
    }
}

function getDifficultyLabel(difficulty) {
    const labels = {
        beginner: 'Начинающий',
        intermediate: 'Средний',
        expert: 'Эксперт'
    };
    return labels[difficulty] || 'Неизвестно';
}


document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('codeForm');
  const resultList = document.getElementById('testResults');
  const taskIdInput = document.getElementById('taskId');

  // Проверяем, что это форма для локальной проверки тестов (не JDoodle)
  if (form && resultList && taskIdInput) {
    const taskId = taskIdInput.value;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      const code = document.getElementById('code').value;
      const language = document.getElementById('language').value;

      try {
        const res = await fetch(`/run-tests/${taskId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code, language })
        });

        const results = await res.json();

        resultList.innerHTML = '';

        results.forEach(test => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>Ввод:</strong> ${test.input}<br>
                          <strong>Ожидается:</strong> ${test.expected}<br>
                          <strong>Получено:</strong> ${test.output}<br>
                          <strong>Результат:</strong> ${test.passed ? '✅ Пройден' : '❌ Не пройден'}`;
          li.style.backgroundColor = test.passed ? '#d4edda' : '#f8d7da';
          li.style.padding = '10px';
          li.style.marginBottom = '5px';
          resultList.appendChild(li);
        });

      } catch (error) {
        console.error('Ошибка:', error);
        resultList.innerHTML = '<li>Произошла ошибка при проверке тестов</li>';
      }
    });
  }
});


async function compileWithJDoodle(taskId) {
    const code = document.getElementById(`gen-code-${taskId}`).value;
    const input = document.getElementById(`gen-input-${taskId}`).value;
    const language = document.getElementById(`gen-lang-${taskId}`).value;
    const resultDiv = document.getElementById(`gen-result-${taskId}`);

    resultDiv.innerHTML = '⏳ Выполняется...';

    try {
        const res = await fetch('/api/jdoodle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, input, language })
        });

        if (!res.ok) throw new Error(`Ошибка выполнения: ${res.status}`);

        const data = await res.json();

        resultDiv.innerHTML = `
            <strong>Вывод:</strong><br>
            <pre>${(data.output || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            ${data.memory ? `<strong>Память:</strong> ${data.memory}<br>` : ''}
            ${data.cpuTime ? `<strong>Время:</strong> ${data.cpuTime}<br>` : ''}
        `;
    } catch (err) {
        console.error('JDoodle error:', err);
        resultDiv.innerHTML = `<span style="color:red;">❌ Ошибка: ${err.message}</span>`;
    }
}



window.onload = () => loadTasks('beginner');

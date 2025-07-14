// script.js - Полная реализация (исправленная)

// Форматирование даты
function formatDate(dateString) {
  const options = {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  };
  return new Date(dateString).toLocaleString('ru-RU', options);
}

// Лейблы приоритета и статуса
function getPriorityLabel(priority) {
  const labels = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
  return labels[priority] || priority;
}
function getStatusLabel(status) {
  const labels = { todo: 'К выполнению', in_progress: 'В процессе', completed: 'Завершено' };
  return labels[status] || status;
}

// Проверка авторизации и получение профиля
async function checkAuth() {
  const res = await fetch('/api/me', { credentials: 'include' });
  if (!res.ok) {
    window.location.href = '/auth.html';
    return false;
  }
  const user = await res.json();
  localStorage.setItem('user', JSON.stringify(user));

  // Если на странице есть профиль, обновляем его
  const usernameEl = document.getElementById('profile-username');
  if (usernameEl) usernameEl.textContent = user.username;
  const levelEl = document.getElementById('profile-level');
  if (levelEl) levelEl.textContent = user.level;
  const scoreEl = document.getElementById('profile-score');
  if (scoreEl) scoreEl.textContent = user.score;
  const nextEl = document.getElementById('profile-next');
  if (nextEl) nextEl.textContent = user.nextLevelThreshold - user.score;
  const levelImg = document.getElementById('profile-level-img');
  if (levelImg) {
    levelImg.src = `/images/levels/level${user.level}.png`;
    levelImg.alt = `Уровень ${user.level}`;
  }

  return true;
}

// Роль и отображение UI
function setupRoleBasedUI() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const btnCreate = document.getElementById('create-task-btn');
  const filterAssignee = document.getElementById('assignee-filter');

  if (btnCreate) btnCreate.style.display = 'block'; // ← показываем всем

  if (user.role === 'teacher' || user.role === 'admin') {
    const titleEl = document.getElementById('tasks-title');
    if (titleEl) titleEl.textContent = 'Задачи студентов';
    if (filterAssignee) filterAssignee.style.display = 'block';
  } else {
    const titleEl = document.getElementById('tasks-title');
    if (titleEl) titleEl.textContent = 'Мои задачи';
    if (filterAssignee) filterAssignee.style.display = 'none';
  }
}


// Загрузка списка предметов
async function loadSubjects() {
  const res = await fetch('/api/subjects', { credentials: 'include' });
  const subjects = await res.json();
  const optAll = '<option value="all">Все предметы</option>';
  const list = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const subjFilter = document.getElementById('subject-filter');
  if (subjFilter) subjFilter.innerHTML = optAll + list;
  const subjSelect = document.getElementById('task-subject');
  if (subjSelect) subjSelect.innerHTML = '<option value="">-- Выберите предмет --</option>' + list;
}

// Загрузка списка студентов



// Фильтр студентов для преподавателя
async function loadStudentsForFilter() {
  const role = localStorage.getItem('userRole');
  if (role !== 'admin' && role !== 'teacher') return;
  const res = await fetch('/api/users', { credentials: 'include' });
  const users = await res.json();
  const list = users.map(u => `<option value="${u.id}">${u.username}</option>`).join('');
  const assigneeFilter = document.getElementById('assignee-filter');
  if (assigneeFilter) assigneeFilter.innerHTML = '<option value="all">Все студенты</option>' + list;
}

// Загрузка и отображение задач
async function loadTasks() {
  // Получаем текущие значения фильтров
  const subjectId = document.getElementById('subject-filter')?.value || 'all';
  const status = document.getElementById('status-filter')?.value || 'all';
  const priority = document.getElementById('priority-filter')?.value || 'all';

  // Получаем данные пользователя
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const role = user.role;
  const userId = user.id;

  // Формируем базовый URL с обязательными параметрами
  let url = `/api/tasks?subjectId=${subjectId}&status=${status}`;

  // Добавляем параметр приоритета, если он выбран
  if (priority !== 'all') {
    url += `&priority=${priority}`;
  }

  // Добавляем фильтр по назначенному пользователю
  if (role === 'student' && userId) {
    // Для студентов показываем только их задачи
    url += `&assigneeId=${userId}`;
  } else if (role === 'teacher' || role === 'admin') {
    // Для преподавателей учитываем выбранного студента в фильтре
    const selectedStudent = document.getElementById('assignee-filter')?.value;
    if (selectedStudent && selectedStudent !== 'all') {
      url += `&assigneeId=${selectedStudent}`;
    }
  }

  try {
    console.log('Загрузка задач по URL:', url);
    const res = await fetch(url, { credentials: 'include' });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Ошибка загрузки задач:', res.status, errorText);
      
      // Показываем сообщение об ошибке
      const container = document.getElementById('tasks-container');
      container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Ошибка загрузки задач (код ${res.status})</p>
        </div>`;
      return;
    }

    const tasks = await res.json();
    console.log('Получены задачи:', tasks);

    const container = document.getElementById('tasks-container');
    
    // Проверяем, что получили массив задач
    if (!Array.isArray(tasks)) {
      console.error('Ожидался массив задач, получено:', tasks);
      container.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Ошибка формата данных</p>
        </div>`;
      return;
    }

    // Если задач нет - показываем соответствующее сообщение
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="no-tasks">
          <i class="fas fa-tasks"></i>
          <p>Нет задач по выбранным фильтрам</p>
        </div>`;
      return;
    }

    // Рендерим задачи
    container.innerHTML = tasks.map(renderTaskCard).join('');
    
  } catch (err) {
    console.error('Ошибка в loadTasks:', err);
    const container = document.getElementById('tasks-container');
    container.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Ошибка соединения: ${err.message}</p>
      </div>`;
  }
}




// Обновление статуса задачи
async function updateTaskStatus(id, status) {
  await fetch(`/api/tasks/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status })
  });
  await loadTasks();
}

// Рендер карточек задач
function renderTaskCard(task) {
  // Проверяем наличие обязательных полей
  if (!task || !task.id) {
    console.error('Некорректная задача:', task);
    return '';
  }

  // Подготавливаем данные для отображения
  const subjectName = task.Subject?.name || 'Без предмета';
  const assignedToName = task.assignedTo?.username || 'Не назначено';
  const deadlineFormatted = task.deadline ? formatDate(task.deadline) : 'Нет срока';
  const priorityLabel = getPriorityLabel(task.priority || 'medium');
  const statusLabel = getStatusLabel(task.status || 'todo');

  // Определяем доступные действия в зависимости от статуса
  let actionsHTML = '';
  if (task.status !== 'completed') {
    actionsHTML = `
      <div class="task-actions">
        <button onclick="updateTaskStatus(${task.id}, 'in_progress')" 
                class="btn btn-warning">
          <i class="fas fa-play"></i> В процессе
        </button>
        <button onclick="updateTaskStatus(${task.id}, 'completed')" 
                class="btn btn-success">
          <i class="fas fa-check"></i> Завершить
        </button>
      </div>`;
  }

  // Возвращаем HTML карточки задачи
  return `
    <div class="task-card ${task.priority || 'medium'}" data-task-id="${task.id}">
      <div class="task-header">
        <h3 class="task-title">${task.title || 'Без названия'}</h3>
        <span class="task-priority ${task.priority || 'medium'}">
          ${priorityLabel}
        </span>
      </div>
      
      <div class="task-description">
        ${task.description || 'Нет описания'}
      </div>
      
      <div class="task-meta">
        <div><i class="fas fa-book"></i> ${subjectName}</div>
        <div><i class="fas fa-user-graduate"></i> ${assignedToName}</div>
        <div><i class="fas fa-calendar-alt"></i> ${deadlineFormatted}</div>
        <div class="task-status ${task.status || 'todo'}">
          <i class="fas fa-circle"></i> ${statusLabel}
        </div>
      </div>
      
      ${actionsHTML}
    </div>
  `;
}

// Модалка
function openModal() {
  const m = document.getElementById('task-modal');
  if (m) {
    console.log('Открываем модалку');
    m.style.display = 'flex';
    m.style.alignItems = 'center';
    m.style.justifyContent = 'center';
  }
}
function closeModal() {
  const m = document.getElementById('task-modal');
  if (m) {
    console.log('Закрываем модалку');
    m.style.display = 'none';
  }
}

// Обработчик создания задачи
async function handleTaskSubmit(e) {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const taskData = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-description').value,
    deadline: document.getElementById('task-deadline').value,
    priority: document.getElementById('task-priority').value,
    subjectId: document.getElementById('task-subject').value,
    assignedToId: document.getElementById('task-assignee').value
  };

  // Если студент — автоматически назначаем задачу себе
  if (user.role === 'student') {
    taskData.assignedToId = user.id;
  }

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(taskData)
    });

    if (res.ok) {
      closeModal();
      e.target.reset();
      await loadTasks();
    } else {
      const err = await res.json();
      alert('Ошибка при создании задачи: ' + (err.error || res.statusText));
    }
  } catch (err) {
    console.error('Ошибка при создании задачи:', err);
    alert('Произошла ошибка при создании задачи');
  }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', async () => {
  if (await checkAuth()) {
    setupRoleBasedUI();
    await loadSubjects();
    
    
    await loadStudentsForFilter();
    await loadTasks();

    // Навигация по вкладкам
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        switch(item.textContent.trim()) {
          case 'Задачи': showSection('tasks-section'); break;
          case 'Предметы': showSection('subjects-section'); loadSubjectsTab(); break;
          case 'Прогресс': showSection('progress-section'); loadProgressTab(); break;
        }
      });
    });

    // Кнопки и формы
    const btn = document.getElementById('create-task-btn');
    if (btn) btn.addEventListener('click', openModal);
    const closeBtn = document.querySelector('.close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const form = document.getElementById('task-form');
    if (form) form.addEventListener('submit', handleTaskSubmit);
    window.addEventListener('click', e => {
      const modal = document.getElementById('task-modal');
      if (e.target === modal) closeModal();
    });

    // Предметы
    const addSubjBtn = document.getElementById('add-subject-btn');
    const subjModalClose = document.getElementById('subj-close-btn');
    const subjForm = document.getElementById('subject-form');
    if (addSubjBtn) addSubjBtn.addEventListener('click', openSubjectModal);
    if (subjModalClose) subjModalClose.addEventListener('click', closeSubjectModal);
    if (subjForm) subjForm.addEventListener('submit', handleSubjectSubmit);

    // Группы (placeholder)
    // TODO: добавить загрузку и выбор групп
  }
});

// Функции для вкладки "Предметы"
function showSection(id) {
  document.getElementById('tasks-section').style.display = (id==='tasks-section'? 'block':'none');
  document.getElementById('subjects-section').style.display = (id==='subjects-section'? 'block':'none');
  document.getElementById('progress-section').style.display = (id==='progress-section'? 'block':'none');
}

async function loadSubjectsTab() {
  const res = await fetch('/api/subjects', { credentials: 'include' });
  const subjects = await res.json();
  const list = document.getElementById('subjects-list');
  if (list) {
    list.innerHTML = subjects.map(s => `<li>${s.name}</li>`).join('');
  }
}

function openSubjectModal() {
  const m = document.getElementById('subject-modal');
  if (m) m.style.display='flex';
}
function closeSubjectModal() {
  const m = document.getElementById('subject-modal');
  if (m) m.style.display='none';
}

async function handleSubjectSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('subject-name').value;
  const res = await fetch('/api/subjects', {
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
    body: JSON.stringify({name})
  });
  if (res.ok) {
    closeSubjectModal();
    await loadSubjectsTab();
    await loadSubjects();
  } else alert('Ошибка создания предмета');
}

// TODO: функции для вкладки "Прогресс" и работу с группами

/* ==========================================================================
   MAINCRAFTS TECHNOLOGY — script.js
   Handles: mobile nav toggle, sticky navbar shadow on scroll,
   and contact form validation.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  initNavToggle();
  initNavScrollShadow();
  renderSubmissions(); // no-op if this page has no submissions list
  initTaskDashboard(); // no-op if this page has no task dashboard
  updateCartBadge();   // safe on every page — just reads LocalStorage
});

/* ==========================================================================
   SHARED CART HELPERS (TASK 5)
   getCart()/updateCartBadge() live here (not catalog.js) so every page's
   nav — not just the catalog/cart pages — shows an accurate item count.
   ========================================================================== */
var CART_STORAGE_KEY = 'maincraftsCart';

function getCart() {
  var stored = localStorage.getItem(CART_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function updateCartBadge() {
  var badge = document.getElementById('cartBadge');
  if (!badge) return;

  var totalQty = getCart().reduce(function (sum, item) { return sum + item.qty; }, 0);

  if (totalQty > 0) {
    badge.textContent = totalQty > 99 ? '99+' : totalQty;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ---- Mobile hamburger menu ---- */
function initNavToggle() {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');

  if (!toggle || !links) return;

  toggle.addEventListener('click', function () {
    var isOpen = links.classList.toggle('is-open');
    toggle.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close menu automatically when a link is tapped (better mobile UX)
  links.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      links.classList.remove('is-open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---- Subtle shadow on the sticky navbar once the page is scrolled ---- */
function initNavScrollShadow() {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  function updateShadow() {
    navbar.classList.toggle('is-scrolled', window.scrollY > 8);
  }

  updateShadow();
  window.addEventListener('scroll', updateShadow, { passive: true });
}

/* ==========================================================================
   CONTACT FORM VALIDATION + LOCALSTORAGE SUBMISSION
   Called via the form's onsubmit="return validateForm()" attribute.
   Validates Name, Email, and Message, then saves the submission to
   LocalStorage as part of an array of past submissions.
   ========================================================================== */
function validateForm() {
  var form = document.forms['contactForm'];
  var nameField = form['name'];
  var emailField = form['email'];
  var messageField = form['message'];

  // Trim whitespace from every field before validating/saving
  var name = nameField.value.trim();
  var email = emailField.value.trim();
  var message = messageField.value.trim();

  var nameFieldWrap = nameField.closest('.field');
  var emailFieldWrap = emailField.closest('.field');
  var messageFieldWrap = messageField.closest('.field');

  // Simple, reasonable email format check: something@something.something
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var isValid = true;

  // Reset previous error states before re-checking
  clearFieldError(nameFieldWrap);
  clearFieldError(emailFieldWrap);
  clearFieldError(messageFieldWrap);

  if (name === '') {
    setFieldError(nameFieldWrap, 'Name is required.');
    isValid = false;
  }

  if (email === '') {
    setFieldError(emailFieldWrap, 'Email is required.');
    isValid = false;
  } else if (!emailPattern.test(email)) {
    setFieldError(emailFieldWrap, 'Enter a valid email address.');
    isValid = false;
  }

  if (message === '') {
    setFieldError(messageFieldWrap, 'Message is required.');
    isValid = false;
  }

  if (!isValid) {
    // preventDefault() equivalent for a plain onsubmit handler: returning
    // false stops the browser from submitting/reloading the page.
    alert('Please fill out all fields correctly before submitting.');
    return false;
  }

  // ---- All fields valid: save this submission to LocalStorage ----
  saveSubmission({ name: name, email: email, message: message });

  // Show a friendly success message, then clear the form fields
  showFormSuccess();
  form.reset();

  return false; // stop the default form submission / page reload
}

/* ---- Save one submission into the "contacts" array in LocalStorage ---- */
function saveSubmission(entry) {
  var submissions = [];

  // Read any existing submissions first, so we never overwrite old ones
  var existing = localStorage.getItem('contacts');
  if (existing) {
    try {
      submissions = JSON.parse(existing);
    } catch (e) {
      submissions = []; // if the stored data is ever corrupted, start fresh
    }
  }

  submissions.push(entry);

  // Save the updated array back as a JSON string
  localStorage.setItem('contacts', JSON.stringify(submissions));
}

function setFieldError(fieldWrap, message) {
  if (!fieldWrap) return;
  fieldWrap.classList.add('has-error');
  var errorEl = fieldWrap.querySelector('.field-error');
  if (errorEl) errorEl.textContent = message;
}

function clearFieldError(fieldWrap) {
  if (!fieldWrap) return;
  fieldWrap.classList.remove('has-error');
}

function showFormSuccess() {
  var successEl = document.querySelector('.form-success');
  if (!successEl) return;
  successEl.classList.add('is-visible');
  successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  window.setTimeout(function () {
    successEl.classList.remove('is-visible');
  }, 5000);
}

/* ==========================================================================
   SUBMISSIONS PAGE
   Reads saved submissions from LocalStorage and displays them dynamically.
   Does nothing on pages that don't have a #submissionsList element, so it's
   safe to call this on every page.
   ========================================================================== */
function renderSubmissions() {
  var listEl = document.getElementById('submissionsList');
  var emptyEl = document.getElementById('submissionsEmpty');
  var countEl = document.getElementById('submissionsCount');
  if (!listEl) return; // not the submissions page — do nothing

  var submissions = [];
  var stored = localStorage.getItem('contacts');
  if (stored) {
    try {
      submissions = JSON.parse(stored);
    } catch (e) {
      submissions = [];
    }
  }

  // Clear out any existing content before rendering
  listEl.innerHTML = '';

  if (countEl) {
    countEl.textContent = submissions.length;
  }

  if (submissions.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  // Build one card per saved submission, most recent first
  submissions.slice().reverse().forEach(function (entry, i) {
    var card = document.createElement('article');
    card.className = 'submission-card';

    var indexTag = document.createElement('span');
    indexTag.className = 'submission-index';
    indexTag.textContent = 'ENTRY.' + String(submissions.length - i).padStart(2, '0');
    card.appendChild(indexTag);

    var nameEl = document.createElement('h3');
    nameEl.textContent = entry.name;
    card.appendChild(nameEl);

    var emailEl = document.createElement('p');
    emailEl.className = 'submission-email';
    var emailIcon = document.createElement('i');
    emailIcon.className = 'fa-solid fa-envelope';
    emailEl.appendChild(emailIcon);
    emailEl.appendChild(document.createTextNode(' ' + entry.email));
    card.appendChild(emailEl);

    var messageEl = document.createElement('p');
    messageEl.className = 'submission-message';
    messageEl.textContent = entry.message;
    card.appendChild(messageEl);

    listEl.appendChild(card);
  });
}

/* ==========================================================================
   TASK MANAGER DASHBOARD (TASK 4)
   Frontend-only CRUD: Add, Edit, Delete, Mark as Completed.
   Persists to LocalStorage under the "maincraftsTasks" key.
   Supports live search by name and a status filter (all/pending/completed).
   Does nothing on pages that don't have a #taskList element, so it's safe
   to call on every page.
   ========================================================================== */

var TASKS_STORAGE_KEY = 'maincraftsTasks';
var dashState = { search: '', filter: 'all' };

function initTaskDashboard() {
  var listEl = document.getElementById('taskList');
  if (!listEl) return; // not the dashboard page — do nothing

  var form = document.getElementById('taskForm');
  var input = document.getElementById('taskInput');
  var searchBox = document.getElementById('searchBox');
  var filterSelect = document.getElementById('filterSelect');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      addTask();
    });
  }

  if (input) {
    input.addEventListener('keyup', function (e) {
      clearTaskInputError();
      if (e.key === 'Enter') addTask();
    });
  }

  if (searchBox) {
    searchBox.addEventListener('keyup', function () {
      dashState.search = searchBox.value.trim().toLowerCase();
      renderTasks();
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', function () {
      dashState.filter = filterSelect.value;
      renderTasks();
    });
  }

  renderTasks();
}

/* ---- Storage helpers ---- */
function getTasks() {
  var stored = localStorage.getItem(TASKS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

/* ---- Create ---- */
function addTask() {
  var input = document.getElementById('taskInput');
  if (!input) return;

  var text = input.value.trim();
  if (text === '') {
    showTaskInputError("Task text can't be empty.");
    return;
  }

  var tasks = getTasks();
  tasks.push({
    id: Date.now(),
    name: text,
    completed: false
  });
  saveTasks(tasks);

  input.value = '';
  clearTaskInputError();
  input.focus();
  renderTasks();
}

/* ---- Update: toggle completed ---- */
function toggleTaskCompleted(id) {
  var tasks = getTasks();
  tasks = tasks.map(function (t) {
    if (t.id === id) t.completed = !t.completed;
    return t;
  });
  saveTasks(tasks);
  renderTasks();
}

/* ---- Update: edit text ---- */
function startEditTask(id) {
  var row = document.querySelector('.task-row[data-id="' + id + '"]');
  if (!row) return;
  row.classList.add('is-editing');

  var main = row.querySelector('.task-main');
  var textEl = row.querySelector('.task-text');
  var currentText = textEl ? textEl.textContent : '';

  main.innerHTML = '<input type="text" class="task-edit-input" value="' +
    escapeHtml(currentText) + '" />';

  var editInput = main.querySelector('.task-edit-input');
  editInput.focus();
  editInput.select();

  editInput.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') saveEditTask(id);
    if (e.key === 'Escape') renderTasks();
  });

  var actions = row.querySelector('.task-actions');
  actions.innerHTML =
    '<button type="button" class="task-icon-btn is-save" title="Save" onclick="saveEditTask(' + id + ')"><i class="fa-solid fa-check"></i></button>' +
    '<button type="button" class="task-icon-btn" title="Cancel" onclick="renderTasks()"><i class="fa-solid fa-xmark"></i></button>';
}

function saveEditTask(id) {
  var row = document.querySelector('.task-row[data-id="' + id + '"]');
  if (!row) return;
  var editInput = row.querySelector('.task-edit-input');
  var newText = editInput ? editInput.value.trim() : '';

  if (newText === '') {
    editInput.classList.add('has-error');
    editInput.focus();
    return;
  }

  var tasks = getTasks();
  tasks = tasks.map(function (t) {
    if (t.id === id) t.name = newText;
    return t;
  });
  saveTasks(tasks);
  renderTasks();
}

/* ---- Delete ---- */
function deleteTask(id) {
  var tasks = getTasks();
  tasks = tasks.filter(function (t) { return t.id !== id; });
  saveTasks(tasks);
  renderTasks();
}

/* ---- Read / Render (applies search + filter) ---- */
function renderTasks() {
  var listEl = document.getElementById('taskList');
  var emptyEl = document.getElementById('taskEmpty');
  var emptyTitle = document.getElementById('taskEmptyTitle');
  var emptyText = document.getElementById('taskEmptyText');
  var countEl = document.getElementById('taskCount');
  var countDoneEl = document.getElementById('taskCountDone');
  if (!listEl) return;

  var allTasks = getTasks();

  if (countEl) countEl.textContent = allTasks.length;
  if (countDoneEl) {
    countDoneEl.textContent = allTasks.filter(function (t) { return t.completed; }).length;
  }

  var visible = allTasks.filter(function (t) {
    var matchesSearch = !dashState.search || t.name.toLowerCase().indexOf(dashState.search) !== -1;
    var matchesFilter =
      dashState.filter === 'all' ||
      (dashState.filter === 'completed' && t.completed) ||
      (dashState.filter === 'pending' && !t.completed);
    return matchesSearch && matchesFilter;
  });

  listEl.innerHTML = '';

  if (allTasks.length === 0) {
    if (emptyEl) {
      emptyEl.style.display = 'flex';
      if (emptyTitle) emptyTitle.textContent = 'No tasks yet.';
      if (emptyText) emptyText.textContent = 'Add your first task above to get started.';
    }
    return;
  }

  if (visible.length === 0) {
    if (emptyEl) {
      emptyEl.style.display = 'flex';
      if (emptyTitle) emptyTitle.textContent = 'No matching tasks.';
      if (emptyText) emptyText.textContent = 'Try a different search term or filter.';
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  visible.slice().reverse().forEach(function (task, i) {
    var row = document.createElement('li');
    row.className = 'task-row' + (task.completed ? ' is-completed' : '');
    row.setAttribute('data-id', task.id);

    var checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'task-check';
    checkBtn.title = task.completed ? 'Mark as pending' : 'Mark as completed';
    checkBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    checkBtn.addEventListener('click', function () { toggleTaskCompleted(task.id); });
    row.appendChild(checkBtn);

    var main = document.createElement('div');
    main.className = 'task-main';

    var indexTag = document.createElement('span');
    indexTag.className = 'task-index';
    indexTag.textContent = 'TASK.' + String(visible.length - i).padStart(2, '0');
    main.appendChild(indexTag);

    var textEl = document.createElement('span');
    textEl.className = 'task-text';
    textEl.textContent = task.name;
    main.appendChild(textEl);

    row.appendChild(main);

    var actions = document.createElement('div');
    actions.className = 'task-actions';

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task-icon-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.addEventListener('click', function () { startEditTask(task.id); });
    actions.appendChild(editBtn);

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'task-icon-btn is-delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.addEventListener('click', function () { deleteTask(task.id); });
    actions.appendChild(deleteBtn);

    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

/* ---- Small helpers ---- */
function showTaskInputError(message) {
  var input = document.getElementById('taskInput');
  var errorEl = document.getElementById('taskInputError');
  if (input) input.classList.add('has-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('is-visible');
  }
}

function clearTaskInputError() {
  var input = document.getElementById('taskInput');
  var errorEl = document.getElementById('taskInputError');
  if (input) input.classList.remove('has-error');
  if (errorEl) errorEl.classList.remove('is-visible');
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

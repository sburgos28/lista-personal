/**
 * Punto de entrada de Lista Personal.
 *
 * Aquí vive la "fontanería": referencias al DOM, estado de la interfaz
 * (filtro y edición), listeners y coordinación entre el store y la UI.
 */
import { DEFAULT_PRIORITY, FILTERS } from './constants.js';
import { isStorageAvailable } from './storage.js';
import { createTaskStore } from './taskStore.js';
import { initTheme } from './theme.js';
import { createUI } from './ui.js';

/* --------------------------------------------------------------------------
   Referencias al DOM
   Las guardamos una sola vez para no consultar el documento en cada evento.
   -------------------------------------------------------------------------- */
const dom = {
  form: document.querySelector('#task-form'),
  titleInput: document.querySelector('#task-title'),
  titleLabel: document.querySelector('#task-title-label'),
  prioritySelect: document.querySelector('#task-priority'),
  submitButton: document.querySelector('#task-submit'),
  cancelEditButton: document.querySelector('#cancel-edit'),
  editHint: document.querySelector('#edit-hint'),
  editHintTitle: document.querySelector('#edit-hint-title'),
  formError: document.querySelector('#form-error'),
  taskList: document.querySelector('#task-list'),
  taskTemplate: document.querySelector('#task-template'),
  emptyState: document.querySelector('#empty-state'),
  emptyStateTitle: document.querySelector('#empty-state-title'),
  emptyStateText: document.querySelector('#empty-state-text'),
  summaryText: document.querySelector('#summary-text'),
  summaryPercent: document.querySelector('#summary-percent'),
  progress: document.querySelector('#progress'),
  progressBar: document.querySelector('#progress-bar'),
  filterButtons: [...document.querySelectorAll('[data-filter]')],
  storageWarning: document.querySelector('#storage-warning'),
  storageNote: document.querySelector('#storage-note'),
  todayLabel: document.querySelector('#today-label'),
  deleteDialog: document.querySelector('#delete-dialog'),
  deleteDialogTask: document.querySelector('#delete-dialog-task'),
  cancelDeleteButton: document.querySelector('#cancel-delete'),
  confirmDeleteButton: document.querySelector('#confirm-delete'),
  toast: document.querySelector('#toast'),
};

/* --------------------------------------------------------------------------
   Dependencias y estado de la interfaz
   -------------------------------------------------------------------------- */
const ui = createUI({
  taskList: dom.taskList,
  taskTemplate: dom.taskTemplate,
  emptyState: dom.emptyState,
  emptyStateTitle: dom.emptyStateTitle,
  emptyStateText: dom.emptyStateText,
  summaryText: dom.summaryText,
  summaryPercent: dom.summaryPercent,
  progress: dom.progress,
  progressBar: dom.progressBar,
  filterButtons: dom.filterButtons,
  toast: dom.toast,
});

const store = createTaskStore({
  // Si localStorage falla (modo privado, cuota llena...), avisamos de forma
  // persistente. Los cambios siguen funcionando en memoria.
  onSaveError: showStorageWarning,
});

let currentFilter = 'all';
let editingId = null;
let pendingDeleteId = null;
let deleteTrigger = null;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const todayFormatter = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/* --------------------------------------------------------------------------
   Utilidades
   -------------------------------------------------------------------------- */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function showStorageWarning() {
  dom.storageWarning.hidden = false;
  dom.storageNote.hidden = true;
}

function getVisibleTasks() {
  const tasks = store.getTasks();

  if (currentFilter === 'pending') {
    return tasks.filter((task) => !task.completed);
  }

  if (currentFilter === 'completed') {
    return tasks.filter((task) => task.completed);
  }

  return tasks;
}

function showFormError(message) {
  dom.formError.textContent = message;
  dom.formError.hidden = false;
  dom.titleInput.setAttribute('aria-invalid', 'true');
  dom.titleInput.focus();
}

function clearFormError() {
  dom.formError.hidden = true;
  dom.formError.textContent = '';
  dom.titleInput.removeAttribute('aria-invalid');
}

/**
 * Renderiza de nuevo y, opcionalmente, devuelve el foco al control que el
 * usuario acaba de usar. Sin esto, reemplazar la lista dejaría el foco en
 * <body> y rompería la navegación con teclado.
 */
function refresh({ focusTaskId = null, focusAction = null } = {}) {
  ui.render({
    tasks: getVisibleTasks(),
    stats: store.getStats(),
    filter: currentFilter,
    editingId,
  });

  if (!focusTaskId || !focusAction) return;

  const taskElement = [...dom.taskList.children].find(
    (element) => element.dataset.taskId === focusTaskId,
  );

  const selector = focusAction === 'toggle'
    ? '.task__checkbox'
    : `[data-action="${focusAction}"]`;

  const target = taskElement?.querySelector(selector);

  if (target) {
    target.focus();
    return;
  }

  // La tarea ya no está visible con el filtro actual (por ejemplo, acaba de
  // completarse estando en "Pendientes"). Llevamos el foco al filtro activo.
  dom.filterButtons
    .find((button) => button.dataset.filter === currentFilter)
    ?.focus();
}

/* --------------------------------------------------------------------------
   Formulario: crear, editar y cancelar
   -------------------------------------------------------------------------- */
function resetForm({ focus = false } = {}) {
  dom.form.reset();
  dom.prioritySelect.value = DEFAULT_PRIORITY;
  editingId = null;

  dom.form.classList.remove('is-editing');
  dom.titleLabel.textContent = 'Nueva tarea';
  dom.submitButton.textContent = 'Añadir tarea';
  dom.cancelEditButton.hidden = true;
  dom.editHint.hidden = true;
  dom.editHintTitle.textContent = '';
  clearFormError();

  if (focus) dom.titleInput.focus();
}

function startEditing(id) {
  const task = store.getTask(id);
  if (!task) return;

  editingId = id;
  dom.titleInput.value = task.title;
  dom.prioritySelect.value = task.priority;
  dom.titleLabel.textContent = 'Editar tarea';
  dom.submitButton.textContent = 'Guardar cambios';
  dom.cancelEditButton.hidden = false;
  dom.editHintTitle.textContent = task.title;
  dom.editHint.hidden = false;
  dom.form.classList.add('is-editing');
  clearFormError();

  refresh();

  // En móvil el formulario puede estar fuera de pantalla: lo acercamos y
  // evitamos que el foco provoque un segundo salto.
  dom.form.scrollIntoView({
    behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
    block: 'center',
  });
  dom.titleInput.focus({ preventScroll: true });
  dom.titleInput.select();
}

function handleSubmit(event) {
  event.preventDefault();

  const title = dom.titleInput.value.trim();
  const priority = dom.prioritySelect.value;

  if (!title) {
    showFormError('Escribe un título para la tarea.');
    return;
  }

  if (editingId) {
    const updated = store.updateTask(editingId, { title, priority });

    if (!updated) {
      showFormError('No se pudo guardar la tarea. Inténtalo de nuevo.');
      return;
    }

    resetForm();
    ui.showToast('Cambios guardados');
  } else {
    const created = store.addTask({ title, priority });

    if (!created) {
      showFormError('No se pudo crear la tarea. Inténtalo de nuevo.');
      return;
    }

    resetForm();

    // Si el usuario está en "Completadas", una tarea nueva quedaría invisible.
    // Cambiamos a "Pendientes" para que vea el resultado de su acción.
    if (currentFilter === 'completed') {
      currentFilter = 'pending';
    }

    ui.showToast('Tarea añadida');
  }

  refresh();
  dom.titleInput.focus();
}

/* --------------------------------------------------------------------------
   Lista: completar, editar y eliminar
   -------------------------------------------------------------------------- */
function handleTaskChange(event) {
  const checkbox = event.target.closest('.task__checkbox');
  if (!checkbox) return;

  const taskElement = checkbox.closest('[data-task-id]');
  if (!taskElement) return;

  const updated = store.toggleTask(taskElement.dataset.taskId);
  if (!updated) return;

  refresh({ focusTaskId: updated.id, focusAction: 'toggle' });
  ui.showToast(
    updated.completed ? 'Tarea completada' : 'Tarea marcada como pendiente',
  );
}

function handleTaskClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const taskElement = button.closest('[data-task-id]');
  if (!taskElement) return;

  const { taskId } = taskElement.dataset;

  if (button.dataset.action === 'edit') {
    startEditing(taskId);
  }

  if (button.dataset.action === 'delete') {
    openDeleteDialog(taskId, button);
  }
}

/* --------------------------------------------------------------------------
   Confirmación de borrado con <dialog>
   -------------------------------------------------------------------------- */
function openDeleteDialog(id, trigger) {
  const task = store.getTask(id);
  if (!task) return;

  pendingDeleteId = id;
  deleteTrigger = trigger ?? null;
  dom.deleteDialogTask.textContent = `«${task.title}»`;

  if (!dom.deleteDialog.open) {
    dom.deleteDialog.showModal();
  }

  // El foco inicial en la opción segura, no en "Eliminar".
  dom.cancelDeleteButton.focus();
}

function handleConfirmDelete() {
  const id = pendingDeleteId;
  if (!id) return;

  const taskWasBeingEdited = editingId === id;
  const deleted = store.deleteTask(id);

  dom.deleteDialog.close();

  if (!deleted) return;

  if (taskWasBeingEdited) {
    resetForm();
  }

  refresh();
  ui.showToast('Tarea eliminada');
  dom.titleInput.focus();
}

/* --------------------------------------------------------------------------
   Eventos
   -------------------------------------------------------------------------- */
dom.form.addEventListener('submit', handleSubmit);

dom.titleInput.addEventListener('input', clearFormError);

dom.cancelEditButton.addEventListener('click', () => {
  resetForm({ focus: true });
  refresh();
});

dom.taskList.addEventListener('change', handleTaskChange);
dom.taskList.addEventListener('click', handleTaskClick);

for (const button of dom.filterButtons) {
  button.addEventListener('click', () => {
    const nextFilter = button.dataset.filter;

    if (!FILTERS.includes(nextFilter) || nextFilter === currentFilter) return;

    currentFilter = nextFilter;
    refresh();
  });
}

dom.cancelDeleteButton.addEventListener('click', () => {
  dom.deleteDialog.close();
});

dom.confirmDeleteButton.addEventListener('click', handleConfirmDelete);

// Cerrar al hacer clic fuera del panel del diálogo.
dom.deleteDialog.addEventListener('click', (event) => {
  if (event.target === dom.deleteDialog) {
    dom.deleteDialog.close();
  }
});

// Limpiar el estado y devolver el foco al botón que abrió el diálogo.
dom.deleteDialog.addEventListener('close', () => {
  const trigger = deleteTrigger;
  deleteTrigger = null;
  pendingDeleteId = null;

  if (trigger?.isConnected) {
    trigger.focus();
  }
});

// Escape cancela la edición, salvo que el diálogo esté abierto (ahí lo
// gestiona el propio <dialog>).
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || dom.deleteDialog.open || !editingId) return;

  resetForm({ focus: true });
  refresh();
});

/* --------------------------------------------------------------------------
   Arranque
   -------------------------------------------------------------------------- */
function init() {
  initTheme();

  if (!isStorageAvailable()) {
    showStorageWarning();
  }

  dom.todayLabel.textContent = capitalize(todayFormatter.format(new Date()));
  refresh();
}

init();

// Ampliación futura: sincronizar entre pestañas escuchando el evento
// "storage" y volviendo a cargar el estado en el store.

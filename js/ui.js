/**
 * Capa de presentación.
 *
 * Recibe datos ya calculados y actualiza el DOM. No conoce el store ni
 * localStorage: eso facilita cambiar el origen de los datos sin tocar
 * esta parte.
 */
import { PRIORITY_LABELS } from './constants.js';

const shortDateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
});

const fullDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeStyle: 'short',
});

const EMPTY_STATES = {
  all: {
    title: 'Tu lista está vacía',
    text: 'Añade tu primera tarea con el formulario de arriba.',
  },
  pending: {
    title: '¡Todo al día!',
    text: 'No tienes tareas pendientes. Buen trabajo.',
  },
  completed: {
    title: 'Aún no hay completadas',
    text: 'Marca una tarea con el cuadrado de la izquierda y aparecerá aquí.',
  },
};

/**
 * Devuelve una etiqueta corta y legible: Hoy, Ayer, Hace 3 días o la fecha.
 * @param {Date} date
 */
function relativeDate(date) {
  const startOfDay = (value) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const today = new Date();
  const dayDiff = Math.round(
    (startOfDay(today) - startOfDay(date)) / 86_400_000,
  );

  if (dayDiff === 0) return 'Hoy';
  if (dayDiff === 1) return 'Ayer';
  if (dayDiff > 1 && dayDiff < 7) return `Hace ${dayDiff} días`;

  return shortDateFormatter.format(date);
}

/**
 * Crea la UI y devuelve solo los métodos que necesita app.js.
 *
 * @param {object} elements Referencias del DOM necesarias para renderizar.
 */
export function createUI(elements) {
  const {
    taskList,
    taskTemplate,
    emptyState,
    emptyStateTitle,
    emptyStateText,
    summaryText,
    summaryPercent,
    progress,
    progressBar,
    filterButtons,
    toast,
  } = elements;

  const toastMessage = toast.querySelector('.toast__message');
  let toastTimerId = null;

  /**
   * Clona el <template> y rellena cada dato con textContent.
   * Nunca usamos innerHTML con datos del usuario: así un título como
   * <img onerror=...> se muestra como texto y no se ejecuta.
   */
  function createTaskElement(task, isEditing) {
    const fragment = taskTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.task');

    item.dataset.taskId = task.id;
    item.classList.toggle('is-completed', task.completed);
    item.classList.toggle('is-editing', isEditing);

    const checkbox = fragment.querySelector('.task__checkbox');
    checkbox.checked = task.completed;
    checkbox.setAttribute(
      'aria-label',
      task.completed
        ? `Marcar «${task.title}» como pendiente`
        : `Marcar «${task.title}» como completada`,
    );

    fragment.querySelector('.task__title').textContent = task.title;

    const priorityBadge = fragment.querySelector('.priority-badge');
    priorityBadge.dataset.priority = task.priority;
    priorityBadge.textContent =
      PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.media;

    const dateElement = fragment.querySelector('.task__date');
    const createdDate = new Date(task.createdAt);

    if (Number.isNaN(createdDate.getTime())) {
      dateElement.textContent = 'Sin fecha';
    } else {
      dateElement.dateTime = createdDate.toISOString();
      dateElement.textContent = relativeDate(createdDate);
      dateElement.title = fullDateFormatter.format(createdDate);
    }

    const editButton = fragment.querySelector('[data-action="edit"]');
    const deleteButton = fragment.querySelector('[data-action="delete"]');

    editButton.setAttribute('aria-label', `Editar «${task.title}»`);
    editButton.title = 'Editar tarea';
    deleteButton.setAttribute('aria-label', `Eliminar «${task.title}»`);
    deleteButton.title = 'Eliminar tarea';

    return item;
  }

  function renderTasks(tasks, editingId) {
    const fragment = document.createDocumentFragment();

    for (const task of tasks) {
      fragment.append(createTaskElement(task, task.id === editingId));
    }

    // replaceChildren sustituye toda la lista de una vez: menos repintados
    // que borrar y añadir nodo a nodo.
    taskList.replaceChildren(fragment);
  }

  function renderEmptyState(tasks, filter, stats) {
    const isEmpty = tasks.length === 0;

    taskList.hidden = isEmpty;
    emptyState.hidden = !isEmpty;

    if (!isEmpty) return;

    // Si no hay tareas en absoluto, el mensaje de "todo al día" sería
    // engañoso; en ese caso mostramos siempre la bienvenida.
    const content = stats.total === 0
      ? EMPTY_STATES.all
      : EMPTY_STATES[filter] ?? EMPTY_STATES.all;

    emptyStateTitle.textContent = content.title;
    emptyStateText.textContent = content.text;
  }

  function renderStats(stats) {
    const { total, completed, percent } = stats;

    if (total === 0) {
      summaryText.textContent = 'Aún no hay tareas';
    } else if (total === 1) {
      summaryText.textContent = `${completed} de 1 completada`;
    } else {
      summaryText.textContent = `${completed} de ${total} completadas`;
    }

    summaryPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
    progress.setAttribute('aria-valuenow', String(percent));
    progress.setAttribute(
      'aria-valuetext',
      total === 0
        ? 'Sin tareas'
        : `${completed} de ${total} tareas completadas`,
    );
  }

  function renderFilters(filter, stats) {
    for (const button of filterButtons) {
      const name = button.dataset.filter;
      const isActive = name === filter;
      const count = button.querySelector('.filter__count');

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));

      if (count) {
        const value = name === 'all' ? stats.total : stats[name];
        count.textContent = String(value ?? 0);
      }
    }
  }

  /**
   * Punto único de render. Recibe únicamente lo que necesita pintar.
   */
  function render({ tasks, stats, filter, editingId }) {
    renderFilters(filter, stats);
    renderStats(stats);
    renderTasks(tasks, editingId);
    renderEmptyState(tasks, filter, stats);
  }

  /**
   * Aviso breve y accesible (role="status"). Se reutiliza un solo nodo
   * para no llenar el DOM de mensajes.
   */
  function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('is-visible');

    window.clearTimeout(toastTimerId);
    toastTimerId = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  // Para listas muy grandes se podría pasar a actualizaciones por id en vez
  // de re-renderizar; para este tamaño, la simplicidad compensa.

  return { render, showToast };
}

/**
 * Estado y reglas de negocio de las tareas.
 *
 * Este módulo no toca el DOM: recibe datos, aplica validaciones, actualiza
 * su estado interno y persiste. Esa separación hace que la lógica sea fácil
 * de explicar, de reutilizar y de probar con tests unitarios.
 */
import {
  DEFAULT_PRIORITY,
  MAX_TITLE_LENGTH,
  PRIORITIES,
} from './constants.js';
import { loadTasks, saveTasks } from './storage.js';

/**
 * Genera un identificador único.
 * crypto.randomUUID solo existe en contextos seguros (https o localhost);
 * el fallback cubre navegadores antiguos o file://.
 */
function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanTitle(title) {
  return String(title ?? '').trim().slice(0, MAX_TITLE_LENGTH);
}

function cleanPriority(priority) {
  return PRIORITIES.includes(priority) ? priority : DEFAULT_PRIORITY;
}

/**
 * Crea una instancia del store. Se usa una clausura para mantener el array
 * privado: desde fuera solo se accede mediante los métodos públicos.
 *
 * @param {{ onSaveError?: () => void }} [options]
 */
export function createTaskStore({ onSaveError } = {}) {
  let tasks = loadTasks();

  function persist() {
    const saved = saveTasks(tasks);
    if (!saved) onSaveError?.();
    return saved;
  }

  /**
   * Añade una tarea al principio de la lista.
   * @returns {object | null} La tarea creada, o null si el título es inválido.
   */
  function addTask({ title, priority }) {
    const clean = cleanTitle(title);
    if (!clean) return null;

    const task = {
      id: createId(),
      title: clean,
      priority: cleanPriority(priority),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    // Las tareas nuevas aparecen arriba, que es donde el usuario mira.
    tasks = [task, ...tasks];
    persist();
    return task;
  }

  /**
   * Actualiza título y prioridad. No toca el estado completed.
   * @returns {object | null}
   */
  function updateTask(id, { title, priority }) {
    const current = getTask(id);
    if (!current) return null;

    const nextTitle = cleanTitle(title);
    if (!nextTitle) return null;

    const updated = {
      ...current,
      title: nextTitle,
      priority: cleanPriority(priority),
    };

    // Creamos un array nuevo en lugar de mutar el existente. Es una práctica
    // sencilla que evita efectos secundarios difíciles de rastrear.
    tasks = tasks.map((task) => (task.id === id ? updated : task));
    persist();
    return updated;
  }

  /**
   * Alterna entre completada y pendiente.
   * @returns {object | null}
   */
  function toggleTask(id) {
    const current = getTask(id);
    if (!current) return null;

    const updated = { ...current, completed: !current.completed };
    tasks = tasks.map((task) => (task.id === id ? updated : task));
    persist();
    return updated;
  }

  /**
   * Elimina una tarea por id.
   * @returns {boolean} true si existía y se eliminó.
   */
  function deleteTask(id) {
    const nextTasks = tasks.filter((task) => task.id !== id);
    if (nextTasks.length === tasks.length) return false;

    tasks = nextTasks;
    persist();
    return true;
  }

  /**
   * Devuelve una copia del array para que nadie modifique el estado
   * "por accidente" desde fuera del store.
   */
  function getTasks() {
    return [...tasks];
  }

  function getTask(id) {
    return tasks.find((task) => task.id === id) ?? null;
  }

  /**
   * Calcula los contadores y el porcentaje de progreso en un solo lugar.
   */
  function getStats() {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;

    return {
      total,
      completed,
      pending: total - completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }

  // Ampliaciones posibles: añadir dueDate/tags, ordenar por prioridad o
  // exponer un método reload() para sincronizar varias pestañas.

  return {
    addTask,
    updateTask,
    toggleTask,
    deleteTask,
    getTasks,
    getTask,
    getStats,
  };
}

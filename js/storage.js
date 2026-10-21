/**
 * Capa de persistencia.
 *
 * Es la única parte de la app que conoce localStorage. Si en el futuro
 * quisiéramos usar IndexedDB, una API o sincronización en la nube, bastaría
 * con sustituir este archivo manteniendo la misma interfaz pública.
 */
import {
  DEFAULT_PRIORITY,
  MAX_TITLE_LENGTH,
  PRIORITIES,
  STORAGE_KEY,
} from './constants.js';

/**
 * Convierte un dato desconocido en una tarea válida.
 *
 * localStorage es manipulable por el usuario, así que nunca debemos confiar
 * en la forma de lo que hay guardado. Si un registro no es recuperable,
 * devolvemos null y lo descartamos al cargar.
 *
 * @param {unknown} value
 * @returns {object | null}
 */
function normalizeStoredTask(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.id !== 'string' || value.id.trim() === '') return null;
  if (typeof value.title !== 'string' || value.title.trim() === '') return null;

  const priority = PRIORITIES.includes(value.priority)
    ? value.priority
    : DEFAULT_PRIORITY;

  const createdAt = new Date(value.createdAt);

  return {
    id: value.id,
    title: value.title.trim().slice(0, MAX_TITLE_LENGTH),
    priority,
    completed: value.completed === true,
    createdAt: Number.isNaN(createdAt.getTime())
      ? new Date().toISOString()
      : createdAt.toISOString(),
  };
}

/**
 * Lee las tareas guardadas. Nunca lanza una excepción: si algo falla,
 * devuelve una lista vacía para que la aplicación siga funcionando.
 *
 * @param {{ onError?: (error: unknown) => void }} [options]
 * @returns {Array<object>}
 */
export function loadTasks({ onError } = {}) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeStoredTask).filter(Boolean);
  } catch (error) {
    // JSON corrupto o almacenamiento bloqueado. Preferimos empezar limpio
    // antes que romper toda la interfaz, pero avisamos a quien escuche.
    console.warn('Lista Personal: no se pudieron leer las tareas guardadas.', error);
    onError?.(error);
    return [];
  }
}

/**
 * Guarda el array completo de tareas como JSON.
 *
 * @param {Array<object>} tasks
 * @returns {boolean} true si se guardó correctamente.
 */
export function saveTasks(tasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (error) {
    // Ocurre en modo privado, con cookies bloqueadas o al superar la cuota.
    console.error('Lista Personal: no se pudieron guardar las tareas.', error);
    return false;
  }
}

/**
 * Comprobación ligera al arrancar para avisar al usuario si el navegador
 * no permite persistencia. Escribir una clave temporal es la forma más
 * fiable de detectarlo (no basta con comprobar que localStorage existe).
 *
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const testKey = 'lista-personal.storage-test';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

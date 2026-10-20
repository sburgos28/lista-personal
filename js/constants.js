/**
 * Constantes compartidas por la aplicación.
 *
 * Centralizarlas evita "números mágicos" y errores de escritura cuando
 * varios módulos necesitan los mismos valores.
 */

// La versión en la clave permite migrar el formato en el futuro sin pisar
// datos antiguos: lista-personal.tasks.v2, por ejemplo.
export const STORAGE_KEY = 'lista-personal.tasks.v1';

// Preferencia visual. IMPORTANTE: esta clave también se usa en el script
// inline de index.html para aplicar el tema antes de pintar la página.
export const THEME_STORAGE_KEY = 'lista-personal.theme';

export const MAX_TITLE_LENGTH = 120;
export const DEFAULT_PRIORITY = 'media';

// Deben coincidir con los value del <select> del formulario y del HTML.
export const PRIORITIES = ['alta', 'media', 'baja'];

export const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

// El filtro es estado de la interfaz, no un dato de la tarea.
export const FILTERS = ['all', 'pending', 'completed'];

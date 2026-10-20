/**
 * Gestión del tema visual.
 *
 * El modo oscuro es el predeterminado. El modo claro es opcional y la
 * preferencia se guarda en localStorage. El color inicial se aplica antes
 * del CSS desde un pequeño script inline en index.html para evitar el
 * "flash" de tema claro al recargar.
 */
import { THEME_STORAGE_KEY } from './constants.js';

const DEFAULT_THEME = 'dark';

const THEME_META_COLORS = {
  dark: '#0b0e15',
  light: '#f3f5fb',
};

function normalizeTheme(value) {
  return value === 'light' ? 'light' : DEFAULT_THEME;
}

function readStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Si localStorage está bloqueado, el tema oscuro sigue funcionando.
    return DEFAULT_THEME;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // La preferencia no se conservará, pero la app no debe romperse.
  }
}

/**
 * Aplica el tema al documento, actualiza el botón y el color del navegador.
 * @param {'dark' | 'light'} theme
 */
function applyTheme(theme) {
  const nextTheme = normalizeTheme(theme);

  document.documentElement.dataset.theme = nextTheme;

  const toggleButton = document.querySelector('#theme-toggle');
  if (toggleButton) {
    const label = nextTheme === 'dark'
      ? 'Cambiar a modo claro'
      : 'Cambiar a modo oscuro';

    toggleButton.setAttribute('aria-label', label);
    toggleButton.title = label;
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  themeColorMeta?.setAttribute('content', THEME_META_COLORS[nextTheme]);

  return nextTheme;
}

/**
 * Inicializa el tema persistido y conecta el botón de cambio.
 */
export function initTheme() {
  let currentTheme = applyTheme(readStoredTheme());
  const toggleButton = document.querySelector('#theme-toggle');

  toggleButton?.addEventListener('click', () => {
    currentTheme = applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    saveTheme(currentTheme);
  });
}

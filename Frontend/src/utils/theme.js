const LANGUAGE_PREFERENCES_KEY = 'bizpilot-language-preferences'

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'Dark' ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'Dark' ? '#19231e' : '#f6f1e7',
  )
}

export function initializeTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(LANGUAGE_PREFERENCES_KEY) || '{}')
    applyTheme(saved.theme)
  } catch (error) {
    console.error('Unable to read theme preference from local storage.', error)
    applyTheme('Light')
  }
}

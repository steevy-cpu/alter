// Small presentation helpers shared across the UI.

// Clamp a number into the [min, max] range.
export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

// Format an ISO timestamp into a short, human-friendly time.
export function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

// Map a 0-100 stat to a status color from the design system.
export function statColor(value) {
  if (value >= 66) return 'var(--color-success)'
  if (value >= 33) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

// Title-case a label.
export function titleCase(text = '') {
  return text.replace(/\b\w/g, (c) => c.toUpperCase())
}

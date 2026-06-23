export const ISO = {
  tileWidth: 99,
  tileHeight: 85,
  stepX: 49.5,
  stepY: 42.5,
  gridSize: 6,
  originX: 400,
  originY: 120,
}

export function gridToScreen(col, row) {
  const x = ISO.originX + (col - row) * ISO.stepX
  const y = ISO.originY + (col + row) * ISO.stepY
  return { x, y }
}

export const LOCATIONS = {
  bed:     { col: 0, row: 0, label: 'Sleeping' },
  desk:    { col: 5, row: 0, label: 'Working' },
  kitchen: { col: 0, row: 5, label: 'Kitchen' },
  door:    { col: 5, row: 5, label: 'Out' },
  center:  { col: 3, row: 3, label: 'Home' },
  window:  { col: 3, row: 0, label: 'Thinking' },
}

export function activityToLocation(eventText) {
  if (!eventText) return 'center'
  const t = eventText.toLowerCase()
  if (t.includes('sleep') || t.includes('wake') || t.includes('bed') || t.includes('morning')) return 'bed'
  if (t.includes('work') || t.includes('cod') || t.includes('study') || t.includes('desk') || t.includes('laptop')) return 'desk'
  if (t.includes('coffee') || t.includes('eat') || t.includes('kitchen') || t.includes('cook')) return 'kitchen'
  if (t.includes('out') || t.includes('shift') || t.includes('store') || t.includes('walk') || t.includes('leave')) return 'door'
  if (t.includes('think') || t.includes('reflect') || t.includes('window') || t.includes('wonder')) return 'window'
  return 'center'
}

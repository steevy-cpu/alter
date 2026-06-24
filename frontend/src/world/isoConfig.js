// Room render is 1600x1600. These pixel coords come from Blender's
// camera projection of each furniture floor point.
export const ROOM = {
  imageWidth: 1600,
  imageHeight: 1600,
  imageUrl: '/world/room.png',
}

// Exact pixel positions of each location in the room render.
export const LOCATIONS = {
  bed:        { x: 676,  y: 649,  label: 'Sleeping' },
  desk:       { x: 449,  y: 694,  label: 'Working' },
  nightstand: { x: 930,  y: 651,  label: 'Resting' },
  bookshelf:  { x: 1179, y: 748,  label: 'Reading' },
  couch:      { x: 953,  y: 917,  label: 'Relaxing' },
  window:     { x: 381,  y: 728,  label: 'Thinking' },
  plant:      { x: 732,  y: 547,  label: 'Daydreaming' },
  center:     { x: 857,  y: 796,  label: 'Home' },
  door:       { x: 857,  y: 1050, label: 'Out' },
}

// Map an event's text to a location key.
export function activityToLocation(eventText) {
  if (!eventText) return 'center'
  const t = eventText.toLowerCase()
  if (t.includes('sleep') || t.includes('wake') || t.includes('bed') || t.includes('morning') || t.includes('rest')) return 'bed'
  if (t.includes('work') || t.includes('cod') || t.includes('study') || t.includes('desk') || t.includes('laptop') || t.includes('module') || t.includes('project')) return 'desk'
  if (t.includes('read') || t.includes('book')) return 'bookshelf'
  if (t.includes('coffee') || t.includes('relax') || t.includes('couch') || t.includes('sit') || t.includes('text') || t.includes('call')) return 'couch'
  if (t.includes('think') || t.includes('reflect') || t.includes('window') || t.includes('wonder') || t.includes('doubt')) return 'window'
  if (t.includes('out') || t.includes('shift') || t.includes('store') || t.includes('leave') || t.includes('walk') || t.includes('grocery')) return 'door'
  if (t.includes('daydream') || t.includes('spac')) return 'plant'
  return 'center'
}

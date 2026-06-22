import { useEffect, useRef, memo } from 'react'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const MIAMI_CENTER = [-80.1918, 25.7617]

const MIAMI_LOCATIONS = {
  brickell: [-80.1936, 25.7617],
  wynwood: [-80.1995, 25.8003],
  downtown: [-80.1918, 25.7751],
  'miami beach': [-80.13, 25.7907],
  'little havana': [-80.227, 25.768],
  'coconut grove': [-80.2387, 25.7281],
  'coral gables': [-80.2684, 25.7215],
  midtown: [-80.1934, 25.8064],
  default: [-80.1918, 25.7617],
}

function getLocationCoords(locationText) {
  if (!locationText) return MIAMI_LOCATIONS.default
  const lower = locationText.toLowerCase()
  for (const [key, coords] of Object.entries(MIAMI_LOCATIONS)) {
    if (lower.includes(key)) return coords
  }
  return [
    MIAMI_CENTER[0] + (Math.random() - 0.5) * 0.02,
    MIAMI_CENTER[1] + (Math.random() - 0.5) * 0.02,
  ]
}

const WorldMap = memo(function WorldMap({ agents, currentLocation }) {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markers = useRef([])

  useEffect(() => {
    if (!MAPBOX_TOKEN || map.current) return

    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = MAPBOX_TOKEN

      map.current = new mapboxgl.default.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: MIAMI_CENTER,
        zoom: 11,
        pitch: 30,
        bearing: -10,
        attributionControl: false,
      })

      map.current.on('load', () => {
        map.current.setFog({
          color: 'rgb(10, 10, 15)',
          'high-color': 'rgb(18, 18, 26)',
          'horizon-blend': 0.1,
        })
      })
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!map.current || !agents || agents.length === 0) return

    import('mapbox-gl').then((mapboxgl) => {
      markers.current.forEach((m) => m.remove())
      markers.current = []

      agents.forEach((agent, idx) => {
        const coords = getLocationCoords(currentLocation)
        const offset = idx * 0.003
        const agentCoords = [coords[0] + offset, coords[1] + offset]
        const accentColor = idx === 0 ? '#7C6FE0' : '#4ECDC4'
        const glowColor =
          idx === 0 ? 'rgba(124,111,224,0.6)' : 'rgba(78,205,196,0.6)'

        const el = document.createElement('div')
        el.style.cssText = `
          width:40px;height:40px;border-radius:50%;
          border:2px solid ${accentColor};
          box-shadow:0 0 16px ${glowColor};
          overflow:hidden;cursor:pointer;background:#12121A;position:relative;
        `

        const img = document.createElement('img')
        img.src = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(agent.name)}&backgroundColor=12121A&radius=50`
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
        img.loading = 'lazy'
        el.appendChild(img)

        const pulse = document.createElement('div')
        pulse.style.cssText = `
          position:absolute;inset:-4px;border-radius:50%;
          border:2px solid ${accentColor};
          animation:pulse 2s ease-in-out infinite;opacity:0.5;
        `
        el.appendChild(pulse)

        const marker = new mapboxgl.default.Marker({ element: el })
          .setLngLat(agentCoords)
          .setPopup(
            new mapboxgl.default.Popup({ offset: 25 }).setHTML(`
              <div style="background:#12121A;color:#F0EFF8;padding:8px 12px;
                border-radius:8px;font-size:13px;font-family:-apple-system,sans-serif;">
                <strong>${agent.name}</strong><br/>
                <span style="color:#9B99B5">${agent.occupation || ''}</span>
              </div>
            `)
          )
          .addTo(map.current)

        markers.current.push(marker)
      })
    })
  }, [agents, currentLocation])

  if (!MAPBOX_TOKEN) {
    return (
      <div
        style={{
          height: 200,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.85rem',
        }}
      >
        Map unavailable — add VITE_MAPBOX_TOKEN
      </div>
    )
  }

  return (
    <div
      ref={mapContainer}
      className="map-container"
      style={{ height: 220, width: '100%' }}
    />
  )
})

export default WorldMap

import { memo } from 'react'

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x/adventurer/svg'

function getAvatarUrl(name, options = {}) {
  if (!name) return null
  const seed = encodeURIComponent(name)
  const bg = options.backgroundColor || '12121A'
  return `${DICEBEAR_BASE}?seed=${seed}&backgroundColor=${bg}&radius=50`
}

const AgentAvatar = memo(function AgentAvatar({
  name,
  size = 64,
  showRing = true,
  glowColor = 'primary',
}) {
  const url = getAvatarUrl(name)
  const ringStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
    border: `2px solid var(--color-${glowColor})`,
    boxShadow: `var(--glow-${glowColor})`,
  }

  if (!url) {
    return (
      <div
        style={{
          ...ringStyle,
          background: 'var(--color-surface-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.4,
          color: 'var(--color-text-secondary)',
          fontWeight: 500,
        }}
      >
        {name?.[0]?.toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <div style={showRing ? ringStyle : { width: size, height: size }}>
      <img
        src={url}
        alt={`${name}'s avatar`}
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
    </div>
  )
})

export default AgentAvatar

import { memo } from 'react'

const LifeTimeline = memo(function LifeTimeline({ memories }) {
  if (!memories || memories.length === 0) {
    return (
      <div
        style={{
          color: 'var(--color-text-muted)',
          fontSize: '0.82rem',
          fontStyle: 'italic',
          padding: 'var(--space-2) 0',
        }}
      >
        Memories will appear here as your Alter lives.
      </div>
    )
  }

  return (
    <div
      className="timeline-track"
      style={{
        maxHeight: 280,
        overflowY: 'auto',
        paddingRight: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {memories.map((memory, i) => {
        const isEncounter =
          memory.memory_type === 'cross_player' ||
          memory.content?.toLowerCase().includes('encounter')
        const dotColor = isEncounter
          ? 'var(--color-encounter)'
          : i % 2 === 0
            ? 'var(--color-primary)'
            : 'var(--color-secondary)'

        return (
          <div key={memory.id || i} style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: -28,
                top: 4,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotColor,
                boxShadow: `0 0 8px ${dotColor}`,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 'var(--space-1)',
              }}
            >
              Day {memory.game_day}
            </div>
            <p
              style={{
                fontSize: '0.82rem',
                color: isEncounter
                  ? 'var(--color-encounter)'
                  : 'var(--color-text-secondary)',
                lineHeight: 1.5,
                margin: 0,
                fontStyle: isEncounter ? 'normal' : 'italic',
              }}
            >
              {memory.content?.length > 100
                ? memory.content.slice(0, 100) + '…'
                : memory.content}
            </p>
          </div>
        )
      })}
    </div>
  )
})

export default LifeTimeline

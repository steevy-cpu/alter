import { useEffect, useRef, memo } from 'react'
import { activityToLocation } from './isoConfig.js'

const IsometricWorld = memo(function IsometricWorld({
  agentName,
  avatarUrl,
  currentActivity,
}) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)

  // Mount Phaser once
  useEffect(() => {
    let destroyed = false

    import('phaser').then((PhaserModule) => {
      if (destroyed) return
      const Phaser = PhaserModule.default

      import('./RoomScene.js').then(({ RoomScene }) => {
        if (destroyed || !containerRef.current) return

        const config = {
          type: Phaser.AUTO,
          width: 800,
          height: 600,
          transparent: true,
          parent: containerRef.current,
          scene: RoomScene,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          render: {
            antialias: true,
            pixelArt: false,
          },
        }

        gameRef.current = new Phaser.Game(config)
        gameRef.current.scene.start('RoomScene', { agentName, avatarUrl })
      })
    })

    return () => {
      destroyed = true
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [agentName, avatarUrl])

  // Move agent when activity changes
  useEffect(() => {
    if (!currentActivity) return
    const game = gameRef.current
    if (!game) return
    const scene = game.scene?.getScene('RoomScene')
    if (scene?.moveToLocation) {
      scene.moveToLocation(activityToLocation(currentActivity))
    }
  }, [currentActivity])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  )
})

export default IsometricWorld

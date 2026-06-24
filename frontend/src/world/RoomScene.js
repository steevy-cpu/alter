import Phaser from 'phaser'
import { ROOM, LOCATIONS } from './isoConfig.js'

export class RoomScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RoomScene' })
    this.agentToken = null
    this.tokenBg = null
    this.tokenRing = null
    this.locationLabel = null
    this.currentLocation = 'center'
  }

  init(data) {
    this.agentName = data.agentName || 'Steeve'
    this.avatarUrl = data.avatarUrl || null
  }

  preload() {
    this.load.image('room', ROOM.imageUrl)
    if (this.avatarUrl) {
      this.load.image('avatar', this.avatarUrl)
    }
  }

  create() {
    // Place the room image covering the full scene
    this.room = this.add.image(0, 0, 'room')
    this.room.setOrigin(0, 0)
    this.room.setDisplaySize(ROOM.imageWidth, ROOM.imageHeight)
    this.room.setDepth(0)

    // Starting position
    const start = LOCATIONS.center

    // Token background circle
    this.tokenBg = this.add.circle(start.x, start.y, 30, 0x1a1a26)
    this.tokenBg.setStrokeStyle(4, 0x7c6fe0)
    this.tokenBg.setDepth(999)

    // Avatar image or fallback
    if (this.textures.exists('avatar')) {
      this.agentToken = this.add.image(start.x, start.y, 'avatar')
      this.agentToken.setDisplaySize(52, 52)
      this.agentToken.setDepth(1000)
    } else {
      this.agentToken = this.add.circle(start.x, start.y, 26, 0x7c6fe0)
      this.agentToken.setDepth(1000)
    }

    // Teal glow ring
    this.tokenRing = this.add.circle(start.x, start.y, 34)
    this.tokenRing.setStrokeStyle(3, 0x4ecdc4, 0.9)
    this.tokenRing.setDepth(1001)

    // Location label
    this.locationLabel = this.add.text(start.x, start.y - 50, 'Home', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '20px',
      color: '#f0eff8',
      backgroundColor: '#12121acc',
      padding: { x: 10, y: 5 },
    })
    this.locationLabel.setOrigin(0.5, 0.5)
    this.locationLabel.setDepth(1002)

    // Floating idle animation
    this.floatTween = this.tweens.add({
      targets: [this.agentToken, this.tokenBg, this.tokenRing],
      y: '-=8',
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  moveToLocation(locationKey) {
    const loc = LOCATIONS[locationKey]
    if (!loc || !this.agentToken) return
    if (locationKey === this.currentLocation) return

    if (this.floatTween) this.floatTween.stop()

    const targets = [this.agentToken, this.tokenBg, this.tokenRing]
    this.tweens.add({
      targets,
      x: loc.x,
      y: loc.y,
      duration: 1400,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.floatTween = this.tweens.add({
          targets,
          y: '-=8',
          duration: 1600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      },
    })

    this.tweens.add({
      targets: this.locationLabel,
      x: loc.x,
      y: loc.y - 50,
      duration: 1400,
      ease: 'Cubic.easeInOut',
      onComplete: () => this.locationLabel.setText(loc.label),
    })

    this.currentLocation = locationKey
  }
}

import Phaser from 'phaser'
import { ISO, gridToScreen, LOCATIONS } from './isoConfig.js'

export class RoomScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RoomScene' })
    this.agentToken = null
    this.agentName = null
    this.currentLocation = 'center'
    this.locationLabel = null
    this.tokenRing = null
    this.tokenBg = null
  }

  init(data) {
    this.agentName = data.agentName || 'Alter'
    this.avatarUrl = data.avatarUrl || null
  }

  preload() {
    this.load.image('floor', '/tiles/floor.png')
    this.load.image('wall_left', '/tiles/wall_left.png')
    this.load.image('wall_right', '/tiles/wall_right.png')
    if (this.avatarUrl) {
      this.load.image('avatar', this.avatarUrl)
    }
  }

  create() {
    // Floor grid — back to front for correct isometric overlap
    for (let row = 0; row < ISO.gridSize; row++) {
      for (let col = 0; col < ISO.gridSize; col++) {
        const { x, y } = gridToScreen(col, row)
        const floor = this.add.image(x, y, 'floor')
        floor.setOrigin(0.5, 0.5)
        floor.setDepth(col + row)
      }
    }

    // Back walls along row=-1 (left wall) and col=-1 (right wall)
    for (let i = 0; i < ISO.gridSize; i++) {
      const posL = gridToScreen(i, -1)
      const wallL = this.add.image(posL.x, posL.y, 'wall_left')
      wallL.setOrigin(0.5, 0.5)
      wallL.setDepth(-1)

      const posR = gridToScreen(-1, i)
      const wallR = this.add.image(posR.x, posR.y, 'wall_right')
      wallR.setOrigin(0.5, 0.5)
      wallR.setDepth(-1)
    }

    // Create the agent token
    const center = gridToScreen(LOCATIONS.center.col, LOCATIONS.center.row)
    const tokenY = center.y - 20

    // Background circle — always renders, gives the token a solid base
    this.tokenBg = this.add.circle(center.x, tokenY, 26, 0x1a1a26)
    this.tokenBg.setStrokeStyle(3, 0x7c6fe0)
    this.tokenBg.setDepth(999)

    // Avatar image on top, sized to fit inside the circle
    if (this.textures.exists('avatar')) {
      this.agentToken = this.add.image(center.x, tokenY, 'avatar')
      this.agentToken.setDisplaySize(44, 44)
      this.agentToken.setDepth(1000)
    } else {
      this.agentToken = this.add.circle(center.x, tokenY, 22, 0x7c6fe0)
      this.agentToken.setDepth(1000)
    }

    // Teal glow ring
    this.tokenRing = this.add.circle(center.x, tokenY, 30)
    this.tokenRing.setStrokeStyle(2, 0x4ecdc4, 0.9)
    this.tokenRing.setDepth(1001)

    // Location label
    this.locationLabel = this.add.text(center.x, tokenY - 44, 'Home', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#f0eff8',
      backgroundColor: '#1a1a26cc',
      padding: { x: 8, y: 4 },
    })
    this.locationLabel.setOrigin(0.5, 0.5)
    this.locationLabel.setDepth(1002)

    // Floating idle animation
    this.tweens.add({
      targets: [this.agentToken, this.tokenRing, this.tokenBg],
      y: `-=6`,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  moveToLocation(locationKey) {
    const loc = LOCATIONS[locationKey]
    if (!loc || !this.agentToken) return
    if (locationKey === this.currentLocation) return

    const { x, y } = gridToScreen(loc.col, loc.row)
    const targetY = y - 20

    // Stop the floating tween before moving
    this.tweens.killTweensOf([this.agentToken, this.tokenRing, this.tokenBg])

    this.tweens.add({
      targets: [this.agentToken, this.tokenRing, this.tokenBg],
      x,
      y: targetY,
      duration: 1200,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        // Resume floating after arriving
        this.tweens.add({
          targets: [this.agentToken, this.tokenRing, this.tokenBg],
          y: `-=6`,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      },
    })

    this.tweens.add({
      targets: this.locationLabel,
      x,
      y: targetY - 44,
      duration: 1200,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.locationLabel.setText(loc.label)
      },
    })

    this.currentLocation = locationKey
  }
}

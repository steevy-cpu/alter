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
    this.tokenMask = null
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

    // Agent token
    const center = gridToScreen(LOCATIONS.center.col, LOCATIONS.center.row)
    const tokenX = center.x
    const tokenY = center.y - 20

    if (this.textures.exists('avatar')) {
      this.agentToken = this.add.image(tokenX, tokenY, 'avatar')
      this.agentToken.setDisplaySize(48, 48)
      this.agentToken.setOrigin(0.5, 0.5)

      this.tokenMask = this.make.graphics({ add: false })
      this.tokenMask.fillStyle(0xffffff)
      this.tokenMask.fillCircle(tokenX, tokenY, 24)
      this.agentToken.setMask(this.tokenMask.createGeometryMask())
    } else {
      this.agentToken = this.add.circle(tokenX, tokenY, 24, 0x7c6fe0)
      this.agentToken.setStrokeStyle(3, 0x4ecdc4)
    }
    this.agentToken.setDepth(1000)

    // Teal ring around token
    this.tokenRing = this.add.circle(tokenX, tokenY, 28)
    this.tokenRing.setStrokeStyle(2, 0x4ecdc4, 0.8)
    this.tokenRing.setDepth(999)

    // Location label
    this.locationLabel = this.add.text(tokenX, tokenY - 44, 'Home', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '13px',
      color: '#f0eff8',
      backgroundColor: '#1a1a26cc',
      padding: { x: 8, y: 4 },
    })
    this.locationLabel.setOrigin(0.5, 0.5)
    this.locationLabel.setDepth(1001)

    // Floating idle animation
    this.tweens.add({
      targets: [this.agentToken, this.tokenRing],
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
    this.tweens.killTweensOf([this.agentToken, this.tokenRing])

    this.tweens.add({
      targets: [this.agentToken, this.tokenRing],
      x,
      y: targetY,
      duration: 1200,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        // Resume floating after arriving
        this.tweens.add({
          targets: [this.agentToken, this.tokenRing],
          y: `-=6`,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
        // Update geometry mask position
        if (this.tokenMask) {
          this.tokenMask.clear()
          this.tokenMask.fillStyle(0xffffff)
          this.tokenMask.fillCircle(this.agentToken.x, this.agentToken.y, 24)
        }
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

import { useEffect, useRef, memo } from 'react'

const WorldCanvas = memo(function WorldCanvas({ emotionalState, hasEncounter }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (prefersReduced) return

    let animFrameId
    let renderer, scene, camera
    let particles, particlePositions, particleVelocities
    let encounterFlash = 0
    let isDestroyed = false

    import('three').then((THREE) => {
      if (isDestroyed) return

      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: false,
        alpha: true,
      })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setClearColor(0x000000, 0)

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2(0x0a0a0f, 0.035)

      camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      )
      camera.position.set(0, 8, 40)
      camera.lookAt(0, 4, 0)

      // Miami skyline silhouette
      const buildingData = [
        { x: -45, w: 6,  h: 18, d: 4 },
        { x: -36, w: 8,  h: 28, d: 4 },
        { x: -26, w: 5,  h: 14, d: 4 },
        { x: -19, w: 10, h: 35, d: 5 },
        { x: -8,  w: 7,  h: 22, d: 4 },
        { x: 0,   w: 12, h: 42, d: 6 },
        { x: 13,  w: 8,  h: 30, d: 4 },
        { x: 22,  w: 6,  h: 18, d: 4 },
        { x: 30,  w: 9,  h: 25, d: 5 },
        { x: 40,  w: 7,  h: 16, d: 4 },
        { x: 48,  w: 5,  h: 20, d: 4 },
      ]

      buildingData.forEach((b) => {
        const geo = new THREE.BoxGeometry(b.w, b.h, b.d)
        const mat = new THREE.MeshBasicMaterial({
          color: 0x0d0d18,
          transparent: true,
          opacity: 0.9,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(b.x, b.h / 2 - 10, -20)
        scene.add(mesh)

        // Window lights
        const windowCount = Math.floor(b.h * b.w * 0.08)
        for (let i = 0; i < windowCount; i++) {
          const isLit = Math.random() > 0.35
          if (!isLit) continue
          const wGeo = new THREE.PlaneGeometry(0.4, 0.6)
          const wMat = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.7 ? 0xffd580 : 0xc8d8ff,
            transparent: true,
            opacity: 0.6 + Math.random() * 0.4,
          })
          const wMesh = new THREE.Mesh(wGeo, wMat)
          wMesh.position.set(
            b.x + (Math.random() - 0.5) * (b.w - 1),
            (Math.random() - 0.5) * (b.h - 2) + b.h / 2 - 10,
            -20 + b.d / 2 + 0.01
          )
          scene.add(wMesh)
        }
      })

      // Ground grid
      const gridHelper = new THREE.GridHelper(100, 30, 0x1a1a2e, 0x1a1a2e)
      gridHelper.position.y = -10
      gridHelper.material.transparent = true
      gridHelper.material.opacity = 0.4
      scene.add(gridHelper)

      // Particle system
      const PARTICLE_COUNT = 800
      const pGeo = new THREE.BufferGeometry()
      particlePositions = new Float32Array(PARTICLE_COUNT * 3)
      particleVelocities = []

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particlePositions[i * 3]     = (Math.random() - 0.5) * 120
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 60
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 60
        particleVelocities.push({
          x: (Math.random() - 0.5) * 0.02,
          y: (Math.random() - 0.5) * 0.01,
          z: (Math.random() - 0.5) * 0.02,
        })
      }

      pGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))

      const pMat = new THREE.PointsMaterial({
        color: 0x7c6fe0,
        size: 0.25,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      })

      particles = new THREE.Points(pGeo, pMat)
      scene.add(particles)

      scene.add(new THREE.AmbientLight(0x1a1a3e, 0.5))

      sceneRef.current = { THREE, renderer, scene, camera, particles, pGeo, pMat }

      let frame = 0
      const animate = () => {
        if (isDestroyed) return
        animFrameId = requestAnimationFrame(animate)
        frame++

        if (frame % 2 !== 0) return

        const canvas = canvasRef.current
        if (!canvas) return
        const energy     = parseFloat(canvas.dataset.energy     || '70') / 100
        const loneliness = parseFloat(canvas.dataset.loneliness || '40') / 100
        const stress     = parseFloat(canvas.dataset.stress     || '30') / 100
        const encounter  = canvas.dataset.encounter === 'true'

        // Color responds to dominant emotional state
        if (stress > 0.6) {
          pMat.color.setHex(0xe07070)
        } else if (energy > 0.7) {
          pMat.color.setHex(0x4ecdc4)
        } else if (loneliness > 0.6) {
          pMat.color.setHex(0x4455aa)
        } else {
          pMat.color.setHex(0x7c6fe0)
        }

        const speedMult = 0.5 + energy * 1.5

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particlePositions[i * 3]     += particleVelocities[i].x * speedMult
          particlePositions[i * 3 + 1] += particleVelocities[i].y * speedMult
          particlePositions[i * 3 + 2] += particleVelocities[i].z * speedMult

          if (Math.abs(particlePositions[i * 3])     > 60) particlePositions[i * 3]     *= -0.9
          if (Math.abs(particlePositions[i * 3 + 1]) > 30) particlePositions[i * 3 + 1] *= -0.9
          if (Math.abs(particlePositions[i * 3 + 2]) > 30) particlePositions[i * 3 + 2] *= -0.9
        }
        pGeo.attributes.position.needsUpdate = true

        // Slow cinematic camera drift
        camera.position.x = Math.sin(frame * 0.0003) * 3
        camera.position.y = 8 + Math.sin(frame * 0.0002) * 1.5
        camera.lookAt(0, 4, 0)

        // Encounter amber flash
        if (encounter && encounterFlash === 0) {
          encounterFlash = 60
        }
        if (encounterFlash > 0) {
          encounterFlash--
          const intensity = encounterFlash / 60
          pMat.color.setHex(0xf9cb42)
          pMat.opacity = 0.4 + intensity * 0.6
          pMat.size = 0.25 + intensity * 0.4
        } else {
          pMat.opacity = 0.3 + energy * 0.4
          pMat.size = 0.2 + energy * 0.15
        }

        // Subtle window flicker every ~3s
        if (frame % 180 === 0) {
          scene.children.forEach((child) => {
            if (child.isMesh && child.geometry?.type === 'PlaneGeometry') {
              if (Math.random() > 0.85) {
                child.material.opacity = Math.random() > 0.5
                  ? 0.6 + Math.random() * 0.4
                  : 0
              }
            }
          })
        }

        renderer.render(scene, camera)
      }
      animate()

      const onResize = () => {
        if (isDestroyed) return
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', onResize)
      sceneRef.current.cleanup = () => window.removeEventListener('resize', onResize)
    })

    return () => {
      isDestroyed = true
      cancelAnimationFrame(animFrameId)
      if (sceneRef.current?.cleanup) sceneRef.current.cleanup()
      if (sceneRef.current?.renderer) sceneRef.current.renderer.dispose()
    }
  }, [])

  // Sync emotional state via dataset — avoids re-running the Three.js setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !emotionalState) return
    canvas.dataset.energy     = emotionalState.energy     ?? 70
    canvas.dataset.loneliness = emotionalState.loneliness ?? 40
    canvas.dataset.stress     = emotionalState.stress     ?? 30
  }, [emotionalState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.dataset.encounter = hasEncounter ? 'true' : 'false'
    if (hasEncounter) {
      const t = setTimeout(() => { canvas.dataset.encounter = 'false' }, 5000)
      return () => clearTimeout(t)
    }
  }, [hasEncounter])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
})

export default WorldCanvas

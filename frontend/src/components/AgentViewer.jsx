import React, { useEffect, useRef, memo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations, ContactShadows } from '@react-three/drei'

const ANIM = {
  IDLE: 1,
  HAPPY: 2,
  SAD: 3,
  THINKING: 4,
}

function getAnimation(emotionalState) {
  if (!emotionalState) return ANIM.IDLE
  const { happiness, stress, motivation, loneliness } = emotionalState
  if (happiness > 75) return ANIM.HAPPY
  if (stress > 65 || loneliness > 65) return ANIM.SAD
  if (motivation > 80) return ANIM.THINKING
  return ANIM.IDLE
}

function Character({ emotionalState }) {
  const group = useRef()
  const { scene, animations } = useGLTF('/models/agent.glb')
  const { actions } = useAnimations(animations, group)
  const currentAnim = useRef(ANIM.IDLE)

  console.log('GLB loaded - scene:', scene)
  console.log('Animations found:', animations.length, animations.map(a => a.name))
  console.log('Actions available:', Object.keys(actions || {}))

  // Play initial idle on mount
  useEffect(() => {
    if (!actions || animations.length < 2) return
    const action = actions[animations[ANIM.IDLE]?.name]
    if (action) action.reset().fadeIn(0.3).play()
  }, [actions, animations])

  // Switch animation when emotional state changes
  useEffect(() => {
    if (!actions || animations.length < 2) return
    const targetAnim = getAnimation(emotionalState)
    if (targetAnim === currentAnim.current) return

    const prevName = animations[currentAnim.current]?.name
    const nextName = animations[targetAnim]?.name

    if (!nextName) return

    const prevAction = prevName ? actions[prevName] : null
    if (prevAction) prevAction.fadeOut(0.5)

    const nextAction = actions[nextName]
    if (nextAction) nextAction.reset().fadeIn(0.5).play()

    currentAnim.current = targetAnim
  }, [emotionalState, actions, animations])

  // Subtle idle rotation
  useFrame((state) => {
    if (!group.current) return
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
  })

  return (
    <>
      {/* Test sphere — always visible if Canvas is working */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#7c6fe0" />
      </mesh>
      <group ref={group} dispose={null}>
        <primitive
          object={scene}
          scale={0.018}
          position={[0, -1.2, 0]}
          rotation={[0, 0, 0]}
        />
      </group>
    </>
  )
}

function GLBFallback() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshBasicMaterial color="#e07070" wireframe />
    </mesh>
  )
}

class R3FErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error: error.message }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          width: '100%',
          height: 200,
          background: '#0d0d1a',
          border: '1px solid #2a2a3a',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#5c5a75',
          fontSize: '0.75rem',
          padding: '16px',
          textAlign: 'center',
        }}>
          3D viewer: {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

useGLTF.preload('/models/agent.glb')

const AgentViewer = memo(function AgentViewer({ emotionalState }) {
  return (
    <R3FErrorBoundary>
      <div
        style={{
          width: '100%',
          height: 200,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0d0d1a 0%, #0a0a0f 100%)',
          border: '1px solid var(--color-border)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <Canvas
          camera={{ position: [0, 0.5, 3], fov: 45 }}
          gl={{ antialias: false, alpha: true }}
          dpr={Math.min(window.devicePixelRatio, 1.5)}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[2, 4, 2]} intensity={1.2} color="#b8b0ff" />
          <pointLight position={[-2, 2, -2]} intensity={0.6} color="#4ecdc4" />
          <Suspense fallback={<GLBFallback />}>
            <Character emotionalState={emotionalState} />
          </Suspense>
          <ContactShadows
            position={[0, -1.2, 0]}
            opacity={0.4}
            scale={3}
            blur={2}
          />
        </Canvas>
      </div>
    </R3FErrorBoundary>
  )
})

export default AgentViewer

import { useEffect, useRef, memo } from 'react'
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

    // Bounds check — fall back to IDLE if clip index is missing
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
    <group ref={group} dispose={null}>
      <primitive
        object={scene}
        scale={0.018}
        position={[0, -1.2, 0]}
        rotation={[0, 0, 0]}
      />
    </group>
  )
}

useGLTF.preload('/models/agent.glb')

const AgentViewer = memo(function AgentViewer({ emotionalState }) {
  return (
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
        <Character emotionalState={emotionalState} />
        <ContactShadows
          position={[0, -1.2, 0]}
          opacity={0.4}
          scale={3}
          blur={2}
        />
      </Canvas>
    </div>
  )
})

export default AgentViewer

// WorldScene.jsx
// Renders the Alter city and Steeve, driven by live state from the backend.
//
// Deps (add to frontend):  npm i three @react-three/fiber @react-three/drei
//
// Assets: copy the two exported .glb files into  frontend/public/models/
//   public/models/alter_city.glb
//   public/models/steeve_avatar.glb
//
// The avatar .glb carries three animation clips: "Idle", "Walk", "Sit".
// The backend streams an `anim` field naming which clip to play, plus a target
// (x, z) the body walks toward. We smoothly lerp position so motion looks good
// even though the AI only decides occasionally.

import React, { useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrthographicCamera, Environment } from "@react-three/drei";
import * as THREE from "three";
import { useWorldSocket } from "./useWorldSocket";

function City() {
  const { scene } = useGLTF("/models/alter_city.glb");
  // The city was authored in metres; drop it at the origin.
  return <primitive object={scene} />;
}

function Steeve({ alter }) {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/steeve_avatar.glb");
  // Clone so the skeleton is unique to this instance (needed if you add more Alters).
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const { actions } = useAnimations(animations, group);
  const current = useRef(null);

  // Crossfade to whichever clip the backend asked for.
  useEffect(() => {
    if (!alter || !actions) return;
    const name = alter.anim in actions ? alter.anim : "Idle";
    if (current.current === name) return;
    const next = actions[name];
    if (!next) return;
    Object.values(actions).forEach((a) => a !== next && a?.fadeOut(0.3));
    next.reset().fadeIn(0.3).play();
    if (name === "Sit") next.clampWhenFinished = true;
    current.current = name;
  }, [alter?.anim, actions]);

  // Smoothly move/turn toward the streamed position each frame.
  useFrame((_, dt) => {
    if (!group.current || !alter) return;
    const g = group.current;
    const tx = alter.x ?? 0;
    const tz = alter.z ?? 0;
    g.position.x = THREE.MathUtils.damp(g.position.x, tx, 6, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, tz, 6, dt);
    if (typeof alter.facing === "number") {
      const cur = g.rotation.y;
      let diff = alter.facing - cur;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      g.rotation.y = cur + diff * Math.min(1, dt * 8);
    }
  });

  return <primitive ref={group} object={cloned} />;
}

export default function WorldScene() {
  const { alter, connected } = useWorldSocket();

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <Canvas shadows dpr={[1, 2]}>
        {/* Isometric-style orthographic camera matching the Blender hero angle */}
        <OrthographicCamera
          makeDefault
          position={[120, 120, 120]}
          zoom={6}
          near={-1000}
          far={2000}
        />
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, 120, 60]} intensity={2.2} castShadow />
        <Environment preset="city" />

        <React.Suspense fallback={null}>
          <City />
          {alter && <Steeve alter={alter} />}
        </React.Suspense>
      </Canvas>

      <div
        style={{
          position: "absolute", top: 12, left: 12, padding: "8px 12px",
          background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 8,
          font: "13px/1.4 system-ui", maxWidth: 260,
        }}
      >
        <div>{connected ? "● live" : "○ connecting…"}</div>
        {alter && (
          <>
            <div><b>{alter.name}</b> — {alter.action}{alter.target ? ` → ${alter.target}` : ""}</div>
            {alter.reason && <div style={{ opacity: 0.8 }}>“{alter.reason}”</div>}
          </>
        )}
      </div>
    </div>
  );
}

useGLTF.preload("/models/alter_city.glb");
useGLTF.preload("/models/steeve_avatar.glb");

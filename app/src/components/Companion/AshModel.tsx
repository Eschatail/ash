"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sparkles } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useMood, useQualityTier, useApp } from "../../lib/store";

const MODEL_URL = "/ash.glb";

type AshModelProps = {
  /** When true, ASH turns slightly toward the global cursor. */
  cursorTracking?: boolean;
  /** Multiplier on the procedural scale. */
  baseScale?: number;
  /** When true, ASH drifts around the canvas and occasionally jumps. */
  wander?: boolean;
};

/**
 * The real ASH — a hot-pink fluffy fox-spirit loaded from ash.glb.
 * The procedural layer (breathe / wander / jump / cursor-face / talk-jiggle)
 * is applied to the wrapper group so the authored model keeps its detail
 * while still feeling alive on the desktop.
 */
export function AshModel({
  cursorTracking = true,
  baseScale = 1,
  wander = true,
}: AshModelProps) {
  const group = useRef<THREE.Group>(null);
  const { mouse } = useThree();
  const tier = useQualityTier();
  const mood = useMood();
  const { scene } = useGLTF(MODEL_URL);

  // Clone + orient + fit the authored model into a ~1-unit, centered rig so the
  // wrapper group's scale/position math is predictable. (mirrors the proven
  // eschatail setup: face front, then box-fit + recenter.)
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.rotation.y = -Math.PI / 2; // eyes to the front
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const sc = 1.7 / maxDim;
    root.scale.setScalar(sc);
    root.position.set(-center.x * sc, -center.y * sc, -center.z * sc);
    root.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    return root;
  }, [scene]);

  // Wander / jump state (refs so we don't churn React re-renders)
  const wanderXRef = useRef(0);
  const wanderYRef = useRef(0);
  const jumpVelRef = useRef(0);
  const jumpYRef = useRef(0);
  const nextJumpAtRef = useRef<number>(2 + Math.random() * 3);
  const squashRef = useRef(1);
  const facingRef = useRef(0);
  const yawRef = useRef(0);
  const bornRef = useRef(0); // 0..1 entrance

  useFrame((state, delta) => {
    const w = window as unknown as { __ASH_VISIBLE__?: boolean };
    if (w.__ASH_VISIBLE__ === false) return;
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    // Entrance: assemble up from nothing the first ~0.7s (or while "assembling").
    const target = mood === "dissolving" ? 0 : 1;
    bornRef.current = THREE.MathUtils.lerp(bornRef.current, target, 0.08);
    const born = bornRef.current;

    const thinking = mood === "thinking";
    const breath = 1 + Math.sin(t * (thinking ? 1.4 : 0.8)) * 0.022;

    if (wander && mood !== "dissolving") {
      const driftX = Math.sin(t * 0.25) * 0.5 + Math.sin(t * 0.41) * 0.2;
      const driftY = Math.sin(t * 0.32) * 0.18 + Math.cos(t * 0.17) * 0.1;
      wanderXRef.current = THREE.MathUtils.lerp(wanderXRef.current, driftX, 0.04);
      wanderYRef.current = THREE.MathUtils.lerp(wanderYRef.current, driftY, 0.04);

      const dx = driftX - facingRef.current;
      facingRef.current = THREE.MathUtils.lerp(facingRef.current, driftX, 0.04);
      yawRef.current = THREE.MathUtils.clamp(dx * 0.6, -0.35, 0.35);

      if (t > nextJumpAtRef.current) {
        if (mood === "idle" || mood === "speaking") {
          jumpVelRef.current = 1.6 + Math.random() * 0.8;
          squashRef.current = 0.86;
        }
        nextJumpAtRef.current = t + 3.5 + Math.random() * 3.5;
      }
      const gravity = 8.5;
      jumpVelRef.current -= gravity * delta;
      jumpYRef.current += jumpVelRef.current * delta;
      if (jumpYRef.current < 0) {
        jumpYRef.current = 0;
        if (jumpVelRef.current < -0.2) {
          jumpVelRef.current = -jumpVelRef.current * 0.18;
          squashRef.current = 0.9;
        } else jumpVelRef.current = 0;
      }
      const targetStretch =
        jumpVelRef.current > 0.3 ? 1.06 : jumpYRef.current > 0.01 ? 1.02 : 1.0;
      squashRef.current = THREE.MathUtils.lerp(squashRef.current, targetStretch, 0.15);
    } else {
      wanderXRef.current = THREE.MathUtils.lerp(wanderXRef.current, 0, 0.1);
      wanderYRef.current = THREE.MathUtils.lerp(wanderYRef.current, 0, 0.1);
      jumpYRef.current = 0;
      jumpVelRef.current = 0;
      squashRef.current = THREE.MathUtils.lerp(squashRef.current, 1, 0.1);
    }

    // Talk jiggle from voice amplitude.
    const level = useApp.getState().audioLevel;
    const talk = level > 0 ? Math.sin(t * 30) * level * 0.05 : 0;

    const bob = Math.sin(t * 1.2) * 0.04;
    g.position.x = wanderXRef.current;
    g.position.y = bob + wanderYRef.current + jumpYRef.current;

    // Cursor-face: turn the whole body slightly toward the pointer.
    let yaw = yawRef.current;
    if (cursorTracking) {
      const want = THREE.MathUtils.clamp(mouse.x * 0.5, -0.5, 0.5);
      yaw += want;
    }
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, yaw, 0.08);
    g.rotation.z =
      mood === "waving"
        ? Math.sin(t * 6) * 0.18
        : THREE.MathUtils.lerp(g.rotation.z, Math.sin(t * 0.5) * 0.02, 0.1);

    const s = breath * baseScale * born;
    g.scale.x = (s / squashRef.current) * (1 + talk);
    g.scale.y = s * squashRef.current;
    g.scale.z = (s / squashRef.current) * (1 + talk);
  });

  const lowTier = tier === "low";
  const sparkleCount = tier === "ultra" ? 50 : tier === "high" ? 34 : 20;

  return (
    <group ref={group} scale={0.0001}>
      {/* Warm ember motes drifting around ASH — brand gold/ember, not green. */}
      {!lowTier && (
        <Sparkles
          count={sparkleCount}
          scale={[2.0, 2.2, 1.6]}
          size={2.2}
          speed={0.3}
          color={"#FFD27F"}
          opacity={0.7}
          noise={0.5}
        />
      )}
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);

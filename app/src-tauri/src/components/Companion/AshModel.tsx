"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useMood, useQualityTier } from "@/lib/companionStore";

type AshModelProps = {
  /** When true, the model tracks the global cursor; off for the chat dock mini-ash. */
  cursorTracking?: boolean;
  /** Multiplier on the procedural scale. */
  baseScale?: number;
};

export function AshModel({
  cursorTracking = true,
  baseScale = 1,
}: AshModelProps) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const pupilL = useRef<THREE.Mesh>(null);
  const pupilR = useRef<THREE.Mesh>(null);
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const antennaGroup = useRef<THREE.Group>(null);
  const antennaTip = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const { viewport, mouse } = useThree();
  const tier = useQualityTier();
  const mood = useMood();

  // Blink scheduler
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = 3000 + Math.random() * 4000;
      timer = setTimeout(() => {
        if (cancelled) return;
        const twice = Math.random() < 0.2;
        blinkOnce();
        if (twice) {
          setTimeout(blinkOnce, 220);
        }
        schedule();
      }, delay);
    };

    const blinkOnce = () => {
      if (!eyeL.current || !eyeR.current) return;
      eyeL.current.scale.y = 0.05;
      eyeR.current.scale.y = 0.05;
      setTimeout(() => {
        if (eyeL.current) eyeL.current.scale.y = 1;
        if (eyeR.current) eyeR.current.scale.y = 1;
      }, 110);
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // A more pronounced smile curve than the previous version.
  const mouthShape = useMemo(() => {
    const s = new THREE.Shape();
    const width = 0.18;
    const depth = 0.08;
    s.moveTo(-width, 0);
    s.quadraticCurveTo(0, -depth, width, 0);
    // Closing back with a slight lip so the curve has area
    s.quadraticCurveTo(0, -depth + 0.012, -width, 0);
    return s;
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (group.current && mood !== "dissolving" && mood !== "assembling") {
      const bob = Math.sin(t * 1.2) * 0.04;
      const breath = 1 + Math.sin(t * 0.8) * 0.018;
      group.current.position.y = bob;
      group.current.scale.setScalar(breath * baseScale);
    } else if (group.current) {
      group.current.scale.setScalar(baseScale);
    }

    if (cursorTracking && pupilL.current && pupilR.current) {
      const maxOffset = 0.028;
      const targetX = THREE.MathUtils.clamp(
        mouse.x * viewport.width * 0.04,
        -maxOffset,
        maxOffset,
      );
      const targetY = THREE.MathUtils.clamp(
        mouse.y * viewport.height * 0.04,
        -maxOffset * 0.8,
        maxOffset * 0.8,
      );
      const lerp = 0.12;
      pupilL.current.position.x = THREE.MathUtils.lerp(
        pupilL.current.position.x,
        -0.2 + targetX,
        lerp,
      );
      pupilL.current.position.y = THREE.MathUtils.lerp(
        pupilL.current.position.y,
        0.08 + targetY,
        lerp,
      );
      pupilR.current.position.x = THREE.MathUtils.lerp(
        pupilR.current.position.x,
        0.2 + targetX,
        lerp,
      );
      pupilR.current.position.y = THREE.MathUtils.lerp(
        pupilR.current.position.y,
        0.08 + targetY,
        lerp,
      );
    }

    if (antennaGroup.current) {
      if (mood === "waving") {
        antennaGroup.current.rotation.z = Math.sin(t * 5) * 0.4;
      } else {
        antennaGroup.current.rotation.z = Math.sin(t * 0.4) * 0.02;
      }
    }

    if (antennaTip.current) {
      const mat = antennaTip.current.material as THREE.MeshPhysicalMaterial;
      // Always slightly pulsing for life — extra strong when thinking
      const base = mood === "thinking" ? 1.1 : 0.85;
      const amp = mood === "thinking" ? 0.35 : 0.15;
      mat.emissiveIntensity = base + Math.sin(t * (mood === "thinking" ? 3 : 1.6)) * amp;
    }
  });

  const lowTier = tier === "low";
  const sparkleCount = tier === "ultra" ? 60 : tier === "high" ? 40 : 24;

  return (
    <group ref={group} scale={baseScale}>
      {/* Internal nebula — sparkles inside the body that show through the glass */}
      {!lowTier && (
        <Sparkles
          count={sparkleCount}
          scale={[0.95, 1.0, 0.85]}
          size={2.4}
          speed={0.35}
          color={"#A5FFD9"}
          opacity={0.85}
          noise={0.4}
        />
      )}

      {/* Inner caustic glow — soft mint core visible through the glass */}
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshBasicMaterial color="#00D97E" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0.05, 0.05, 0.05]}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <meshBasicMaterial color="#A5FFD9" transparent opacity={0.55} />
      </mesh>

      {/* Body — glass tadpole */}
      <mesh ref={body} scale={[1, 1.12, 0.95]}>
        <sphereGeometry args={[0.62, 96, 96]} />
        {lowTier ? (
          <meshPhysicalMaterial
            color="#00D97E"
            roughness={0.35}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
            transparent
            opacity={0.85}
            sheen={0.4}
            sheenColor="#A0FFD0"
          />
        ) : (
          <MeshTransmissionMaterial
            backside
            samples={tier === "ultra" ? 12 : tier === "high" ? 8 : 4}
            resolution={tier === "ultra" ? 1024 : 512}
            transmission={1}
            roughness={0.05}
            thickness={0.55}
            ior={1.45}
            chromaticAberration={0.08}
            anisotropy={0.3}
            distortion={0.12}
            distortionScale={0.35}
            temporalDistortion={0.06}
            clearcoat={1}
            attenuationDistance={2.5}
            attenuationColor="#A5FFD9"
            color="#00D97E"
          />
        )}
      </mesh>

      {/* Antenna */}
      <group ref={antennaGroup} position={[0, 0.6, 0]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.012, 0.018, 0.28, 8]} />
          <meshStandardMaterial color="#00D97E" transparent opacity={0.55} />
        </mesh>
        <mesh ref={antennaTip} position={[0, 0.32, 0]}>
          <sphereGeometry args={[0.07, 24, 24]} />
          <meshPhysicalMaterial
            color="#A5FFD9"
            emissive="#00D97E"
            emissiveIntensity={1.0}
            roughness={0.12}
            clearcoat={1}
          />
        </mesh>
      </group>

      {/* Eye whites */}
      <mesh ref={eyeL} position={[-0.2, 0.08, 0.55]}>
        <sphereGeometry args={[0.115, 28, 28]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh ref={eyeR} position={[0.2, 0.08, 0.55]}>
        <sphereGeometry args={[0.115, 28, 28]} />
        <meshBasicMaterial color="white" />
      </mesh>

      {/* Pupils — large + dark for the mockup look */}
      <mesh ref={pupilL} position={[-0.2, 0.08, 0.67]}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshBasicMaterial color="#0A0410" />
      </mesh>
      <mesh ref={pupilR} position={[0.2, 0.08, 0.67]}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshBasicMaterial color="#0A0410" />
      </mesh>

      {/* Eye highlights (tiny white sparkle on upper-right of each pupil) */}
      <mesh position={[-0.17, 0.12, 0.71]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0.23, 0.12, 0.71]}>
        <sphereGeometry args={[0.022, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>

      {/* Smile — more pronounced curve */}
      <mesh ref={mouth} position={[0, -0.1, 0.52]}>
        <shapeGeometry args={[mouthShape]} />
        <meshBasicMaterial color="#0A0410" side={THREE.DoubleSide} />
      </mesh>

      {/* Cheek blushes — bigger and warmer */}
      <mesh position={[-0.4, -0.08, 0.4]} rotation={[0, -0.4, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#FF6B35" transparent opacity={0.48} />
      </mesh>
      <mesh position={[0.4, -0.08, 0.4]} rotation={[0, 0.4, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#FF6B35" transparent opacity={0.48} />
      </mesh>
    </group>
  );
}

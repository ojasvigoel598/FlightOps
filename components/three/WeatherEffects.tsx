// 3D Weather effects for fun mode missions.
// Rain, wind particles, storm clouds, and icing visuals.
// Uses instanced meshes for performance.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Rain
// ---------------------------------------------------------------------------

interface RainProps {
  /** Number of rain drops (0 = no rain) */
  count: number;
  /** Intensity 0-1 affects drop speed and density */
  intensity: number;
  /** Area around origin where rain falls */
  area?: number;
}

export function Rain({ count, intensity, area = 60 }: RainProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const drops = useRef(
    Array.from({ length: 300 }).map(() => ({
      x: (Math.random() - 0.5) * area,
      y: Math.random() * 50 + 10,
      z: (Math.random() - 0.5) * area,
      speed: 15 + Math.random() * 20,
      length: 0.3 + Math.random() * 0.5,
    })),
  );

  useFrame((_, delta) => {
    if (!meshRef.current || count <= 0) return;
    const matrix = new THREE.Matrix4();
    const maxDrops = Math.min(count, 300);

    for (let i = 0; i < maxDrops; i++) {
      const d = drops.current[i];
      d.y -= d.speed * intensity * delta * 3;
      d.x += intensity * 2 * delta; // wind effect

      if (d.y < -2) {
        d.y = 40 + Math.random() * 20;
        d.x = (Math.random() - 0.5) * area;
        d.z = (Math.random() - 0.5) * area;
      }

      matrix.makeScale(0.02, d.length * intensity, 0.02);
      matrix.setPosition(d.x, d.y, d.z);
      meshRef.current.setMatrixAt(i, matrix);
    }

    // Hide unused drops
    for (let i = maxDrops; i < 300; i++) {
      matrix.makeScale(0, 0, 0);
      meshRef.current.setMatrixAt(i, matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (count <= 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 300]}>
      <cylinderGeometry args={[1, 1, 1, 4]} />
      <meshBasicMaterial color="#9AB8D4" transparent opacity={0.4} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Wind streaks (visible wind lines flowing past)
// ---------------------------------------------------------------------------

interface WindStreaksProps {
  /** Wind speed in m/s — controls particle speed */
  windMs: number;
  /** Wind direction in degrees */
  windDirDeg: number;
  /** Whether active */
  active: boolean;
}

export function WindStreaks({ windMs, windDirDeg, active }: WindStreaksProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 80;

  const dirRad = (windDirDeg * Math.PI) / 180;
  const velX = Math.sin(dirRad) * windMs * 0.5;
  const velZ = Math.cos(dirRad) * windMs * 0.5;

  const streaks = useRef(
    Array.from({ length: count }).map(() => ({
      x: (Math.random() - 0.5) * 80,
      y: Math.random() * 30 + 2,
      z: (Math.random() - 0.5) * 80,
      life: Math.random(),
    })),
  );

  useFrame((_, delta) => {
    if (!meshRef.current || !active) return;
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      const s = streaks.current[i];
      s.x += velX * delta * 3;
      s.z += velZ * delta * 3;
      s.life -= delta * 0.5;

      if (s.life <= 0 || Math.abs(s.x) > 50 || Math.abs(s.z) > 50) {
        s.x = (Math.random() - 0.5) * 80;
        s.y = Math.random() * 30 + 2;
        s.z = (Math.random() - 0.5) * 80;
        s.life = 0.8 + Math.random() * 0.5;
      }

      const alpha = s.life;
      const len = 0.5 + windMs * 0.1;
      matrix.makeScale(0.02, 0.02, len * alpha);
      matrix.setPosition(s.x, s.y, s.z);
      meshRef.current.setMatrixAt(i, matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active || windMs < 3) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#FFFFFF" transparent opacity={0.15} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Storm clouds (dark, ominous cloud layer)
// ---------------------------------------------------------------------------

interface StormCloudsProps {
  /** Visibility 0-1 (lower = darker clouds) */
  visibility: number;
  /** Position offset */
  positionY?: number;
}

export function StormClouds({ visibility, positionY = 35 }: StormCloudsProps) {
  const opacity = useMemo(() => Math.max(0, 1 - visibility), [visibility]);
  if (opacity < 0.1) return null;

  const clouds = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      x: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 100,
      scaleX: 8 + Math.random() * 15,
      scaleZ: 6 + Math.random() * 10,
      scaleY: 2 + Math.random() * 3,
      y: positionY + (Math.random() - 0.5) * 8,
    }));
  }, [positionY]);

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]}>
          <boxGeometry args={[c.scaleX, c.scaleY, c.scaleZ]} />
          <meshStandardMaterial
            color={`rgb(${40 + Math.floor(visibility * 40)}, ${40 + Math.floor(visibility * 40)}, ${50 + Math.floor(visibility * 40)})`}
            transparent
            opacity={opacity * 0.7}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Icing overlay — translucent blue shell on the aircraft
// ---------------------------------------------------------------------------

interface IcingOverlayProps {
  /** Whether icing is active */
  active: boolean;
  /** Severity 0-5 */
  severity: number;
}

export function IcingOverlay({ active, severity }: IcingOverlayProps) {
  if (!active || severity <= 0) return null;

  const opacity = 0.1 + severity * 0.08;
  const scale = 1 + severity * 0.02;

  return (
    <group scale={[scale, scale, scale]}>
      {/* Wing ice */}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[12, 0.08, 1.8]} />
        <meshStandardMaterial
          color="#B8D4E8"
          transparent
          opacity={opacity}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
      {/* Tail ice */}
      <mesh position={[0, 0.3, -3]}>
        <boxGeometry args={[3, 0.06, 0.8]} />
        <meshStandardMaterial
          color="#B8D4E8"
          transparent
          opacity={opacity}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}

// Particle effects for the flight game.
// Engine exhaust smoke and wingtip contrails.
// Uses simple billboard sprites for cross-platform compatibility.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_PARTICLES = 60;

// ---------------------------------------------------------------------------
// Engine exhaust smoke
// ---------------------------------------------------------------------------

interface ExhaustProps {
  /** World position of the engine exhaust nozzle */
  position: [number, number, number];
  /** 0 = off, 1 = full throttle */
  throttle: number;
  /** Direction the smoke travels (normalized) */
  direction?: [number, number, number];
}

export function EngineExhaust({ position, throttle, direction = [0, 0.1, -1] }: ExhaustProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef(
    Array.from({ length: MAX_PARTICLES }).map(() => ({
      life: 0,
      maxLife: 1,
      offset: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      size: 0.3,
    })),
  );
  const nextSpawn = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || throttle < 0.05) return;

    const time = clock.getElapsedTime();
    const dir = new THREE.Vector3(direction[0], direction[1], direction[2]);
    const spawnRate = 0.03 / Math.max(0.1, throttle);

    // Spawn new particles
    nextSpawn.current -= delta;
    if (nextSpawn.current <= 0) {
      nextSpawn.current = spawnRate;
      for (const p of particles.current) {
        if (p.life <= 0) {
          p.life = p.maxLife;
          p.maxLife = 0.8 + Math.random() * 0.6;
          p.offset.set(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
          );
          p.velocity.copy(dir).multiplyScalar(3 + throttle * 5);
          p.velocity.x += (Math.random() - 0.5) * 1.5;
          p.velocity.y += Math.random() * 0.5;
          p.size = 0.2 + Math.random() * 0.3;
          break;
        }
      }
    }

    // Update particles
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      if (p.life <= 0) {
        matrix.makeScale(0, 0, 0);
        meshRef.current.setMatrixAt(i, matrix);
        continue;
      }

      p.life -= delta;
      const t = 1 - p.life / p.maxLife; // 0 = just born, 1 = dead

      // Move particle
      p.offset.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.y += delta * 0.5; // slight upward drift

      const pos = new THREE.Vector3(
        position[0] + p.offset.x,
        position[1] + p.offset.y,
        position[2] + p.offset.z,
      );

      const scale = p.size * (0.3 + t * 0.7); // grow then shrink
      const fade = 1 - t * t; // quadratic fade

      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(pos);
      meshRef.current.setMatrixAt(i, matrix);

      // Color: white → grey → transparent
      color.setRGB(0.8 + t * 0.2, 0.8 + t * 0.2, 0.82 + t * 0.18);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (throttle < 0.05) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial color="#CCCCDD" transparent opacity={0.4} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------
// Wingtip contrails
// ---------------------------------------------------------------------------

interface ContrailProps {
  /** World position of the wingtip */
  position: [number, number, number];
  /** Whether the contrail is active (high altitude + high speed) */
  active: boolean;
  /** Speed affects trail length */
  speed: number;
}

export function WingtipContrail({ position, active, speed }: ContrailProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particles = useRef(
    Array.from({ length: MAX_PARTICLES }).map(() => ({
      life: 0,
      maxLife: 2,
      offset: new THREE.Vector3(),
      size: 0.15,
    })),
  );
  const nextSpawn = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current || !active) return;

    nextSpawn.current -= delta;
    if (nextSpawn.current <= 0) {
      nextSpawn.current = 0.02;
      for (const p of particles.current) {
        if (p.life <= 0) {
          p.life = p.maxLife;
          p.maxLife = 1.5 + Math.random() * 1;
          p.offset.set(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
          );
          p.size = 0.1 + Math.random() * 0.1;
          break;
        }
      }
    }

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      if (p.life <= 0) {
        matrix.makeScale(0, 0, 0);
        meshRef.current.setMatrixAt(i, matrix);
        continue;
      }

      p.life -= delta;
      const t = 1 - p.life / p.maxLife;

      // Trail grows behind
      p.offset.z += speed * delta * 0.3;

      const pos = new THREE.Vector3(
        position[0] + p.offset.x,
        position[1] + p.offset.y,
        position[2] + p.offset.z,
      );

      const scale = p.size * (0.5 + t * 2); // grow over time
      const fade = 1 - t;

      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(pos);
      meshRef.current.setMatrixAt(i, matrix);

      color.setRGB(0.95, 0.95, 1.0);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
      <sphereGeometry args={[1, 4, 3]} />
      <meshBasicMaterial color="#FFFFFF" transparent opacity={0.3} />
    </instancedMesh>
  );
}

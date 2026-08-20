// 3D world environment — runway, terrain, sky, clouds, mountains, hangar.
// Designed for the Fun Mode aircraft-design game.
// All geometry is lightweight (basic Three.js primitives).

import { useMemo } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Runway
// ---------------------------------------------------------------------------

export function Runway({ length = 200, width = 20 }: { length?: number; width?: number }) {
  const dashes = useMemo(() => {
    const items: { z: number }[] = [];
    const dashLen = 4;
    const gap = 6;
    for (let z = -length / 2 + 10; z < length / 2 - 10; z += dashLen + gap) {
      items.push({ z });
    }
    return items;
  }, [length]);

  return (
    <group>
      {/* Asphalt surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#3A3A3A" roughness={0.9} />
      </mesh>

      {/* Centre line dashes */}
      {dashes.map((d, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, d.z]}>
          <planeGeometry args={[0.3, 4]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      ))}

      {/* Edge lines */}
      {[-width / 2 + 0.5, width / 2 - 0.5].map((x, i) => (
        <mesh key={`edge-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 0]}>
          <planeGeometry args={[0.2, length]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      ))}

      {/* Threshold markings */}
      {[-1, 1].map((side) =>
        Array.from({ length: 4 }).map((_, i) => (
          <mesh
            key={`th-${side}-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[
              side * (2 + i * 2),
              0.02,
              (length / 2 - 8) * (side > 0 ? 1 : -1),
            ]}
          >
            <planeGeometry args={[1.2, 8]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        )),
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Terrain — flat ground with grass colour
// ---------------------------------------------------------------------------

export function Terrain({ size = 500 }: { size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#4A7C59" roughness={1} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Sky — gradient hemisphere with sun
// ---------------------------------------------------------------------------

export function Sky() {
  return (
    <>
      {/* Sky dome */}
      <mesh>
        <sphereGeometry args={[400, 32, 16]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
      </mesh>

      {/* Sun light */}
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.5}
        color="#FFF8E1"
        castShadow
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.5} color="#B0C4DE" />

      {/* Ground bounce */}
      <hemisphereLight args={['#87CEEB', '#4A7C59', 0.3]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Clouds — soft sphere clusters
// ---------------------------------------------------------------------------

export function Clouds({ count = 12 }: { count?: number }) {
  const clouds = useMemo(() => {
    // Use seeded positions for deterministic layout
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 7 + 13) % 100;
      return {
        x: ((seed * 3.7) % 300) - 150,
        y: 40 + (seed * 1.1) % 30,
        z: ((seed * 5.3) % 300) - 150,
        scale: 3 + (seed * 0.7) % 5,
        puffs: 3 + (seed % 3),
      };
    });
  }, [count]);

  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {Array.from({ length: c.puffs }).map((_, j) => (
            <mesh
              key={j}
              position={[
                (j - c.puffs / 2) * c.scale * 0.5,
                Math.sin(j * 1.2) * c.scale * 0.2,
                Math.cos(j * 0.8) * c.scale * 0.2,
              ]}
            >
              <sphereGeometry args={[c.scale * 0.7, 8, 6]} />
              <meshStandardMaterial
                color="#FFFFFF"
                transparent
                opacity={0.85}
                roughness={1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Mountains — snow-capped cones
// ---------------------------------------------------------------------------

export function Mountains({ count = 8 }: { count?: number }) {
  const peaks = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 11 + 7) % 100;
      return {
        x: ((seed * 4.1) % 400) - 200,
        z: -150 - (seed * 1.7) % 100,
        height: 20 + (seed * 1.3) % 40,
        radius: 15 + (seed * 0.9) % 20,
      };
    });
  }, [count]);

  return (
    <>
      {peaks.map((p, i) => (
        <group key={i}>
          {/* Mountain body */}
          <mesh position={[p.x, p.height / 2 - 5, p.z]}>
            <coneGeometry args={[p.radius, p.height, 6]} />
            <meshStandardMaterial color="#6B8E7B" roughness={0.9} />
          </mesh>
          {/* Snow cap */}
          <mesh position={[p.x, p.height - 6, p.z]}>
            <coneGeometry args={[p.radius * 0.3, p.height * 0.3, 6]} />
            <meshStandardMaterial color="#F0F8FF" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Hangar — box building with arched roof
// ---------------------------------------------------------------------------

export function Hangar({ position = [25, 0, 10] as [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main building body */}
      <mesh position={[0, 4, 0]}>
        <boxGeometry args={[14, 8, 10]} />
        <meshStandardMaterial color="#4A5568" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 8.5, 0]}>
        <boxGeometry args={[15, 1, 11]} />
        <meshStandardMaterial color="#2D3748" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Door opening (dark rectangle) */}
      <mesh position={[0, 3, 5.01]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#1A1A2E" />
      </mesh>
      {/* Door frame */}
      <mesh position={[0, 3, 5.02]}>
        <ringGeometry args={[2.8, 3.2, 16, 1, 0, Math.PI]} />
        <meshStandardMaterial color="#718096" />
      </mesh>
      {/* Windows */}
      {[-5, 5].map((x, i) => (
        <mesh key={i} position={[x, 6, 5.01]}>
          <planeGeometry args={[2, 1.5]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trees — simple cone + cylinder combos
// ---------------------------------------------------------------------------

export function Trees({ count = 20 }: { count?: number }) {
  const trees = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 17 + 3) % 100;
      return {
        x: ((seed * 5.7) % 120) - 60,
        z: ((seed * 3.3) % 100) - 50,
        height: 3 + (seed * 0.4) % 4,
        radius: 1.5 + (seed * 0.3) % 2,
      };
    });
  }, [count]);

  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          {/* Trunk */}
          <mesh position={[0, t.height * 0.3, 0]}>
            <cylinderGeometry args={[0.15, 0.2, t.height * 0.5, 6]} />
            <meshStandardMaterial color="#5D4037" roughness={0.9} />
          </mesh>
          {/* Canopy */}
          <mesh position={[0, t.height * 0.7, 0]}>
            <coneGeometry args={[t.radius, t.height * 0.6, 6]} />
            <meshStandardMaterial color="#2E7D32" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Water — reflective plane
// ---------------------------------------------------------------------------

export function Water({ position = [80, 0.05, -30] as [number, number, number], size = 60 }: {
  position?: [number, number, number];
  size?: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color="#2196F3"
        transparent
        opacity={0.7}
        metalness={0.8}
        roughness={0.1}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Wind indicators — animated arrows showing wind direction
// ---------------------------------------------------------------------------

export function WindIndicator({ windMs = 0, direction = 0 }: { windMs?: number; direction?: number }) {
  if (windMs < 1) return null;

  return (
    <group position={[15, 3, 0]} rotation={[0, (direction * Math.PI) / 180, 0]}>
      {/* Pole */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Wind sock / arrow */}
      <mesh position={[0, 2.8, windMs * 0.1]} rotation={[0, 0, -Math.PI / 4]}>
        <coneGeometry args={[0.2, windMs * 0.3, 8]} />
        <meshStandardMaterial color="#FF6B35" />
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[0.08, 0.08, windMs * 0.3]} />
        <meshStandardMaterial color="#FF6B35" />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Runway lights — edge lights for the game feel
// ---------------------------------------------------------------------------

export function RunwayLights({ length = 200, width = 20 }: { length?: number; width?: number }) {
  const lights = useMemo(() => {
    const items: { x: number; z: number }[] = [];
    const step = 10;
    for (let z = -length / 2 + 5; z <= length / 2 - 5; z += step) {
      items.push({ x: -width / 2 + 1, z });
      items.push({ x: width / 2 - 1, z });
    }
    return items;
  }, [length, width]);

  return (
    <>
      {lights.map((l, i) => (
        <group key={i} position={[l.x, 0.1, l.z]}>
          <mesh>
            <sphereGeometry args={[0.15, 6, 4]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#FFD700' : '#00FF88'}
              emissive={i % 2 === 0 ? '#FFD700' : '#00FF88'}
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

// 3D world environment — runway, terrain, sky, clouds.
// Designed for the aircraft-design learning game (Model B).

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
// Sky — gradient hemisphere
// ---------------------------------------------------------------------------

export function Sky() {
  const topColor = useMemo(() => new THREE.Color('#1E3A5F'), []);
  const bottomColor = useMemo(() => new THREE.Color('#87CEEB'), []);

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
      <hemisphereLight
        args={['#87CEEB', '#4A7C59', 0.3]}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Clouds — simple sphere clusters
// ---------------------------------------------------------------------------

export function Clouds({ count = 12 }: { count?: number }) {
  const clouds = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      x: (Math.random() - 0.5) * 300,
      y: 40 + Math.random() * 30,
      z: (Math.random() - 0.5) * 300,
      scale: 3 + Math.random() * 5,
      puffs: 3 + Math.floor(Math.random() * 3),
    }));
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
              <sphereGeometry args={[c.scale * (0.6 + Math.random() * 0.4), 8, 6]} />
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
// Mountains — distant background
// ---------------------------------------------------------------------------

export function Mountains({ count = 8 }: { count?: number }) {
  const peaks = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      x: (Math.random() - 0.5) * 400,
      z: -150 - Math.random() * 100,
      height: 20 + Math.random() * 40,
      radius: 15 + Math.random() * 20,
    }));
  }, [count]);

  return (
    <>
      {peaks.map((p, i) => (
        <mesh key={i} position={[p.x, p.height / 2 - 5, p.z]}>
          <coneGeometry args={[p.radius, p.height, 6]} />
          <meshStandardMaterial color="#6B8E7B" roughness={0.9} />
        </mesh>
      ))}
    </>
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

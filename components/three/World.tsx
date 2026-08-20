// 3D world environment — upgraded for game-quality visuals.
// Animated ocean water with reflections, atmospheric fog, sun disc,
// better mountains, and full airfield infrastructure.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
// Animated Ocean — large water plane with vertex animation
// ---------------------------------------------------------------------------

export function Ocean({ size = 2000 }: { size?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.PlaneGeometry>(null);

  // Create the ocean geometry with enough subdivisions for wave animation
  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(size, size, 64, 64);
  }, [size]);

  // Animate waves
  useFrame(({ clock }) => {
    if (!geoRef.current) return;
    const geo = geoRef.current;
    const positions = geo.attributes.position;
    const time = clock.getElapsedTime();

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);

      // Multiple wave frequencies for realistic ocean
      const wave1 = Math.sin(x * 0.02 + time * 0.8) * 0.6;
      const wave2 = Math.sin(y * 0.015 + time * 1.2) * 0.4;
      const wave3 = Math.sin((x + y) * 0.01 + time * 0.5) * 0.3;
      const wave4 = Math.cos(x * 0.03 - time * 0.6) * 0.2;

      positions.setZ(i, wave1 + wave2 + wave3 + wave4);
    }

    positions.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
      receiveShadow
    >
      <planeGeometry ref={geoRef} args={[size, size, 64, 64]} />
      <meshStandardMaterial
        color="#1565C0"
        metalness={0.9}
        roughness={0.1}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Terrain — grass with subtle height variation
// ---------------------------------------------------------------------------

export function Terrain({ size = 500 }: { size?: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, 32, 32);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      // Gentle rolling hills
      const h = Math.sin(x * 0.01) * 1.5 + Math.cos(y * 0.015) * 1.0;
      positions.setZ(i, h);
    }
    geo.computeVertexNormals();
    return geo;
  }, [size]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial color="#4A7C59" roughness={1} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Sky — atmospheric dome with gradient + sun disc
// ---------------------------------------------------------------------------

export function Sky() {
  return (
    <>
      {/* Sky dome — warm gradient */}
      <mesh>
        <sphereGeometry args={[400, 32, 16]} />
        <meshBasicMaterial color="#6CB4EE" side={THREE.BackSide} />
      </mesh>

      {/* Sun disc */}
      <mesh position={[200, 120, -200]}>
        <sphereGeometry args={[15, 16, 8]} />
        <meshBasicMaterial color="#FFF8DC" />
      </mesh>

      {/* Sun glow */}
      <mesh position={[200, 120, -200]}>
        <sphereGeometry args={[25, 16, 8]} />
        <meshBasicMaterial color="#FFF8E1" transparent opacity={0.3} />
      </mesh>

      {/* Directional sun light */}
      <directionalLight
        position={[200, 120, -200]}
        intensity={2.0}
        color="#FFF8E1"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.4} color="#B0C4DE" />

      {/* Ground bounce light */}
      <hemisphereLight args={['#87CEEB', '#4A7C59', 0.35]} />

      {/* Fog for depth */}
      <fog attach="fog" args={['#B8D4E8', 100, 500]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Clouds — puffy cumulus with better shape
// ---------------------------------------------------------------------------

export function Clouds({ count = 15 }: { count?: number }) {
  const clouds = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 7 + 13) % 100;
      return {
        x: ((seed * 3.7) % 400) - 200,
        y: 50 + (seed * 1.1) % 40,
        z: ((seed * 5.3) % 400) - 200,
        scale: 4 + (seed * 0.7) % 6,
        puffs: 4 + (seed % 4),
      };
    });
  }, [count]);

  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {Array.from({ length: c.puffs }).map((_, j) => {
            const seed2 = (i * 100 + j * 7) % 100;
            return (
              <mesh
                key={j}
                position={[
                  (j - c.puffs / 2) * c.scale * 0.45,
                  Math.sin(j * 1.2) * c.scale * 0.15,
                  Math.cos(j * 0.8) * c.scale * 0.15,
                ]}
              >
                <sphereGeometry args={[c.scale * (0.5 + (seed2 % 30) / 100), 8, 6]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  transparent
                  opacity={0.88}
                  roughness={1}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Mountains — varied, with snow caps and rock faces
// ---------------------------------------------------------------------------

export function Mountains({ count = 12 }: { count?: number }) {
  const peaks = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 11 + 7) % 100;
      return {
        x: ((seed * 4.1) % 500) - 250,
        z: -100 - (seed * 2.1) % 150,
        height: 25 + (seed * 1.3) % 50,
        radius: 12 + (seed * 0.9) % 25,
        rotation: (seed * 0.3) % (Math.PI * 2),
      };
    });
  }, [count]);

  return (
    <>
      {peaks.map((p, i) => (
        <group key={i} rotation={[0, p.rotation, 0]}>
          {/* Mountain body */}
          <mesh position={[p.x, p.height / 2 - 5, p.z]} castShadow>
            <coneGeometry args={[p.radius, p.height, 7]} />
            <meshStandardMaterial color="#5A7A5B" roughness={0.9} />
          </mesh>
          {/* Snow cap */}
          <mesh position={[p.x, p.height - 7, p.z]}>
            <coneGeometry args={[p.radius * 0.25, p.height * 0.25, 7]} />
            <meshStandardMaterial color="#F0F8FF" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Hangar — detailed airfield building
// ---------------------------------------------------------------------------

export function Hangar({ position = [25, 0, 10] as [number, number, number] }) {
  return (
    <group position={position}>
      {/* Main body */}
      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[14, 8, 10]} />
        <meshStandardMaterial color="#4A5568" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 8.5, 0]} castShadow>
        <boxGeometry args={[15, 1, 11]} />
        <meshStandardMaterial color="#2D3748" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Door */}
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
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Trees — pine forest scattered around
// ---------------------------------------------------------------------------

export function Trees({ count = 30 }: { count?: number }) {
  const trees = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 17 + 3) % 100;
      return {
        x: ((seed * 5.7) % 140) - 70,
        z: ((seed * 3.3) % 120) - 60,
        height: 2.5 + (seed * 0.4) % 4,
        radius: 1.2 + (seed * 0.3) % 1.5,
      };
    });
  }, [count]);

  return (
    <>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.height * 0.3, 0]}>
            <cylinderGeometry args={[0.12, 0.18, t.height * 0.5, 6]} />
            <meshStandardMaterial color="#5D4037" roughness={0.9} />
          </mesh>
          <mesh position={[0, t.height * 0.7, 0]} castShadow>
            <coneGeometry args={[t.radius, t.height * 0.6, 7]} />
            <meshStandardMaterial color="#2E7D32" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Wind indicators
// ---------------------------------------------------------------------------

export function WindIndicator({ windMs = 0, direction = 0 }: { windMs?: number; direction?: number }) {
  if (windMs < 1) return null;

  return (
    <group position={[15, 3, 0]} rotation={[0, (direction * Math.PI) / 180, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#888" />
      </mesh>
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
// Runway edge lights — glowing
// ---------------------------------------------------------------------------

export function RunwayLights({ length = 200, width = 20 }: { length?: number; width?: number }) {
  const lights = useMemo(() => {
    const items: { x: number; z: number; color: string }[] = [];
    const step = 10;
    for (let z = -length / 2 + 5; z <= length / 2 - 5; z += step) {
      items.push({ x: -width / 2 + 1, z, color: '#FFD700' });
      items.push({ x: width / 2 - 1, z, color: '#00FF88' });
    }
    return items;
  }, [length, width]);

  return (
    <>
      {lights.map((l, i) => (
        <group key={i} position={[l.x, 0.15, l.z]}>
          <mesh>
            <sphereGeometry args={[0.12, 6, 4]} />
            <meshStandardMaterial
              color={l.color}
              emissive={l.color}
              emissiveIntensity={1.2}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Control tower — small tower near the hangar
// ---------------------------------------------------------------------------

export function ControlTower({ position = [-20, 0, 15] as [number, number, number] }) {
  return (
    <group position={position}>
      {/* Tower shaft */}
      <mesh position={[0, 6, 0]}>
        <cylinderGeometry args={[1.2, 1.5, 12, 8]} />
        <meshStandardMaterial color="#607D8B" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Cab */}
      <mesh position={[0, 12.5, 0]}>
        <cylinderGeometry args={[2.5, 2, 2, 8]} />
        <meshStandardMaterial color="#37474F" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Windows ring */}
      <mesh position={[0, 13, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 0.8, 8, 1, true]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} metalness={0.8} />
      </mesh>
    </group>
  );
}

// Parametric 3D aircraft model built from basic Three.js geometries.
// Changes shape in real time when the player modifies design choices.
// Uses React Three Fiber declarative components so it works on web + native.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Design parameters fed to the model
// ---------------------------------------------------------------------------

export interface AircraftDesignParams {
  /** Wing span in metres (mapped from player choice) */
  spanM: number;
  /** Wing area in m² (affects chord) */
  areaM2: number;
  /** 'piston' | 'turboprop' | 'turbofan' | 'electric' */
  engineType: string;
  /** Number of engines */
  engineCount: number;
  /** Tail configuration */
  tailType: 'conventional' | 't-tail' | 'v-tail' | 'canard' | 'none';
  /** Airfoil thickness ratio (0-1) — affects wing cross-section */
  thicknessRatio: number;
  /** Sweep angle in degrees */
  sweepDeg: number;
  /** 0-1 flight animation speed multiplier (0 = parked, 1 = cruise) */
  flightSpeed: number;
  /** Pitch angle in radians */
  pitch: number;
  /** Bank angle in radians */
  bank: number;
}

// ---------------------------------------------------------------------------
// Wing presets from player option IDs
// ---------------------------------------------------------------------------

const WING_PARAMS: Record<string, Partial<AircraftDesignParams>> = {
  short: { spanM: 8, areaM2: 12, sweepDeg: 25 },
  medium: { spanM: 10, areaM2: 16, sweepDeg: 5 },
  long: { spanM: 14, areaM2: 18, sweepDeg: 2 },
  wide: { spanM: 12, areaM2: 24, sweepDeg: 5 },
};

const TAIL_PARAMS: Record<string, AircraftDesignParams['tailType']> = {
  conventional: 'conventional',
  't-tail': 't-tail',
  'v-tail': 'v-tail',
  canard: 'canard',
  none: 'none',
};

const AIRFOIL_THICKNESS: Record<string, number> = {
  naca0012: 0.12,
  naca2412: 0.12,
  naca4412: 0.12,
  naca0018: 0.18,
};

export function buildDesignParams(opts: {
  wingId: string;
  tailId: string;
  airfoilId: string;
  engineId: string;
  engineCount: number;
  flightSpeed?: number;
  pitch?: number;
  bank?: number;
}): AircraftDesignParams {
  const wp = WING_PARAMS[opts.wingId] ?? WING_PARAMS.medium;
  const engineType = opts.engineId === 'powerful' ? 'turbofan' : opts.engineId === 'efficient' ? 'piston' : 'turboprop';
  return {
    spanM: wp.spanM ?? 10,
    areaM2: wp.areaM2 ?? 16,
    engineType,
    engineCount: opts.engineCount,
    tailType: TAIL_PARAMS[opts.tailId] ?? 'conventional',
    thicknessRatio: AIRFOIL_THICKNESS[opts.airfoilId] ?? 0.12,
    sweepDeg: wp.sweepDeg ?? 5,
    flightSpeed: opts.flightSpeed ?? 0,
    pitch: opts.pitch ?? 0,
    bank: opts.bank ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Internal: fuselage geometry
// ---------------------------------------------------------------------------

function Fuselage({ length, radius }: { length: number; radius: number }) {
  return (
    <group>
      {/* Main body */}
      <mesh>
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshStandardMaterial color="#C8D0DC" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Nose cone */}
      <mesh position={[0, 0, length / 2]}>
        <coneGeometry args={[radius, radius * 2.5, 16]} />
        <meshStandardMaterial color="#B8C4D4" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Tail taper */}
      <mesh position={[0, 0, -length / 2]}>
        <coneGeometry args={[radius * 0.6, radius * 2, 16]} />
        <meshStandardMaterial color="#B8C4D4" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Internal: single wing half
// ---------------------------------------------------------------------------

function WingHalf({
  span,
  rootChord,
  tipChord,
  sweep,
  thickness,
  side, // 1 = right, -1 = left
}: {
  span: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  thickness: number;
  side: number;
}) {
  const halfSpan = span / 2;
  const sweepOffset = Math.tan((sweep * Math.PI) / 180) * halfSpan;

  // Build a tapered wing shape with sweep using Shape + ExtrudeGeometry
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const ht = (rootChord * thickness) / 2;
    // Leading edge at origin, trailing edge at rootChord
    s.moveTo(0, -rootChord / 2);
    s.lineTo(ht, 0);
    s.lineTo(0, rootChord / 2);
    s.lineTo(-ht, 0);
    s.closePath();
    return s;
  }, [rootChord, thickness]);

  const geometry = useMemo(() => {
    const extrudeSettings = {
      depth: halfSpan,
      bevelEnabled: false,
    };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so span goes along X axis
    geo.rotateY(Math.PI / 2);
    geo.rotateZ(-Math.PI / 2);
    return geo;
  }, [shape, halfSpan]);

  return (
    <mesh
      geometry={geometry}
      position={[side * rootChord * 0.05, 0, sweepOffset / 2]}
      rotation={[0, 0, 0]}
    >
      <meshStandardMaterial color="#A0B0C4" metalness={0.5} roughness={0.4} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Internal: engine nacelle
// ---------------------------------------------------------------------------

function Engine({ type, position }: { type: string; position: [number, number, number] }) {
  const color = type === 'turbofan' ? '#708090' : type === 'electric' ? '#40C080' : '#8898A8';
  const radius = type === 'turbofan' ? 0.45 : type === 'electric' ? 0.2 : 0.3;
  const length = type === 'turbofan' ? 2.2 : type === 'electric' ? 1.2 : 1.5;
  return (
    <group position={position}>
      {/* Nacelle */}
      <mesh>
        <cylinderGeometry args={[radius, radius * 0.9, length, 12]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Inlet */}
      <mesh position={[0, 0, length / 2]}>
        <ringGeometry args={[radius * 0.3, radius * 0.9, 12]} />
        <meshStandardMaterial color="#404858" metalness={0.8} roughness={0.2} />
      </mesh>
      {type === 'piston' || type === 'turboprop' ? (
        /* Propeller disc */
        <mesh position={[0, 0, length / 2 + 0.1]} rotation={[0, 0, 0]}>
          <ringGeometry args={[0.05, radius * 1.8, 6]} />
          <meshStandardMaterial color="#334" metalness={0.4} roughness={0.5} transparent opacity={0.6} />
        </mesh>
      ) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Internal: tail surfaces
// ---------------------------------------------------------------------------

function ConventionalTail({ arm, hSize, vSize }: { arm: number; hSize: number; vSize: number }) {
  return (
    <group position={[0, 0, -arm]}>
      {/* Vertical fin */}
      <mesh position={[0, vSize / 2, 0]}>
        <boxGeometry args={[0.08, vSize, vSize * 0.5]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Horizontal stabiliser */}
      <mesh>
        <boxGeometry args={[hSize * 2, 0.06, hSize * 0.5]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function TTail({ arm, hSize, vSize }: { arm: number; hSize: number; vSize: number }) {
  return (
    <group position={[0, 0, -arm]}>
      {/* Tall vertical fin */}
      <mesh position={[0, vSize * 0.7, 0]}>
        <boxGeometry args={[0.08, vSize * 1.4, vSize * 0.4]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Horizontal stabiliser at the TOP of the fin */}
      <mesh position={[0, vSize * 1.3, 0]}>
        <boxGeometry args={[hSize * 2, 0.06, hSize * 0.5]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function VTail({ arm, hSize, vSize }: { arm: number; hSize: number; vSize: number }) {
  const angle = Math.PI / 6; // 30° dihedral
  return (
    <group position={[0, 0, -arm]}>
      {/* Left V surface */}
      <mesh position={[-hSize * 0.4, vSize * 0.3, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.06, hSize, hSize * 0.4]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Right V surface */}
      <mesh position={[hSize * 0.4, vSize * 0.3, 0]} rotation={[0, 0, -angle]}>
        <boxGeometry args={[0.06, hSize, hSize * 0.4]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Canard({ position, size }: { position: [number, number, number]; size: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size * 2, 0.05, size * 0.4]} />
      <meshStandardMaterial color="#A0B8C8" metalness={0.5} roughness={0.4} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AircraftModel({ design }: { design: AircraftDesignParams }) {
  const groupRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Group>(null);

  const fuselageLength = 6;
  const fuselageRadius = 0.45;
  const tailArm = fuselageLength * 0.45;

  // Wing geometry
  const wingSpan = design.spanM;
  const rootChord = design.areaM2 / wingSpan * 1.8; // Scale for visual
  const tipChord = rootChord * 0.55;
  const sweep = design.sweepDeg;

  // Tail sizing
  const hTailSize = wingSpan * 0.18;
  const vTailSize = wingSpan * 0.22;

  // Engine placement
  const engines = useMemo(() => {
    const spacing = wingSpan * 0.25;
    const positions: Array<[number, number, number]> = [];
    if (design.engineCount === 1) {
      positions.push([0, -fuselageRadius - 0.1, 0.5]);
    } else if (design.engineCount === 2) {
      positions.push([-spacing, -0.15, 0]);
      positions.push([spacing, -0.15, 0]);
    } else {
      positions.push([-spacing, -0.15, 0]);
      positions.push([spacing, -0.15, 0]);
      positions.push([-spacing * 0.5, -fuselageRadius - 0.1, 0]);
      positions.push([spacing * 0.5, -fuselageRadius - 0.1, 0]);
    }
    return positions;
  }, [design.engineCount, wingSpan]);

  // Animation: propeller spin
  useFrame((_, delta) => {
    if (propRef.current) {
      propRef.current.rotation.z += delta * design.flightSpeed * 40;
    }
  });

  // Canard position (in front of main wing)
  const canardZ = fuselageLength * 0.15;
  const canardSize = wingSpan * 0.08;

  return (
    <group ref={groupRef} rotation={[design.pitch, 0, design.bank]}>
      {/* Fuselage — along Z axis */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <Fuselage length={fuselageLength} radius={fuselageRadius} />
      </group>

      {/* Main wings */}
      <WingHalf
        span={wingSpan}
        rootChord={rootChord}
        tipChord={tipChord}
        sweep={sweep}
        thickness={design.thicknessRatio}
        side={1}
      />
      <WingHalf
        span={wingSpan}
        rootChord={rootChord}
        tipChord={tipChord}
        sweep={sweep}
        thickness={design.thicknessRatio}
        side={-1}
      />

      {/* Tail surfaces */}
      {design.tailType === 'conventional' && (
        <ConventionalTail arm={tailArm} hSize={hTailSize} vSize={vTailSize} />
      )}
      {design.tailType === 't-tail' && (
        <TTail arm={tailArm} hSize={hTailSize} vSize={vTailSize} />
      )}
      {design.tailType === 'v-tail' && (
        <VTail arm={tailArm} hSize={hTailSize} vSize={vTailSize} />
      )}
      {design.tailType === 'canard' && (
        <>
          <ConventionalTail arm={tailArm * 0.8} hSize={hTailSize * 0.8} vSize={vTailSize * 0.8} />
          <Canard position={[0, 0, canardZ]} size={canardSize} />
        </>
      )}
      {design.tailType === 'none' && null}

      {/* Engines */}
      {engines.map((pos, i) => (
        <group key={i}>
          <Engine type={design.engineType} position={pos} />
          {/* Spinning propeller visual for piston/turboprop */}
          {(design.engineType === 'piston' || design.engineType === 'turboprop') && (
            <group ref={i === 0 ? propRef : undefined} position={[pos[0], pos[1], pos[2] + 1]} rotation={[0, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.06, wingSpan * 0.14, 0.02]} />
                <meshStandardMaterial color="#333" metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.06, wingSpan * 0.14, 0.02]} />
                <meshStandardMaterial color="#333" metalness={0.3} roughness={0.5} />
              </mesh>
            </group>
          )}
        </group>
      ))}

      {/* Cockpit canopy */}
      <mesh position={[0, fuselageRadius * 0.8, fuselageLength * 0.2]}>
        <sphereGeometry args={[fuselageRadius * 0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#88BBE8" transparent opacity={0.5} metalness={0.8} roughness={0.1} />
      </mesh>
    </group>
  );
}

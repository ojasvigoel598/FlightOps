// Parametric 3D aircraft model built from basic Three.js geometries.
// Changes shape in real time when the player modifies design choices.
// Uses React Three Fiber declarative components so it works on web + native.
//
// V2: Added animated landing gear, flaps, control surfaces, engine state,
//     and configuration transition support.

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
  // --- V2 additions ---
  /** Landing gear position: 0 = fully retracted, 1 = fully extended */
  gearPosition?: number;
  /** Flap deflection in degrees (0-30) */
  flapDeg?: number;
  /** Elevator deflection in degrees (-20 to +20) */
  elevatorDeg?: number;
  /** Aileron deflection in degrees (-20 to +20, positive = right up) */
  aileronDeg?: number;
  /** Rudder deflection in degrees (-25 to +25) */
  rudderDeg?: number;
  /** Which engine has failed (0 = none, 1 = left, 2 = right) */
  failedEngine?: number;
  /** Engine running state per engine */
  enginesRunning?: boolean[];
  /** Icing accumulation (0 = none, 1 = full ice) */
  icingLevel?: number;
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
  gearPosition?: number;
  flapDeg?: number;
  elevatorDeg?: number;
  aileronDeg?: number;
  rudderDeg?: number;
  failedEngine?: number;
  enginesRunning?: boolean[];
  icingLevel?: number;
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
    gearPosition: opts.gearPosition ?? 1,
    flapDeg: opts.flapDeg ?? 0,
    elevatorDeg: opts.elevatorDeg ?? 0,
    aileronDeg: opts.aileronDeg ?? 0,
    rudderDeg: opts.rudderDeg ?? 0,
    failedEngine: opts.failedEngine ?? 0,
    enginesRunning: opts.enginesRunning,
    icingLevel: opts.icingLevel ?? 0,
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
// Internal: single wing half (with flap + aileron)
// ---------------------------------------------------------------------------

function WingHalf({
  span,
  rootChord,
  tipChord,
  sweep,
  thickness,
  side,
  flapDeg = 0,
  aileronDeg = 0,
}: {
  span: number;
  rootChord: number;
  tipChord: number;
  sweep: number;
  thickness: number;
  side: number;
  flapDeg?: number;
  aileronDeg?: number;
}) {
  const halfSpan = span / 2;
  const sweepOffset = Math.tan((sweep * Math.PI) / 180) * halfSpan;

  // Build a tapered wing shape with sweep using Shape + ExtrudeGeometry
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const ht = (rootChord * thickness) / 2;
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
    geo.rotateY(Math.PI / 2);
    geo.rotateZ(-Math.PI / 2);
    return geo;
  }, [shape, halfSpan]);

  // Flap: trailing edge surface that rotates down
  const flapSpan = halfSpan * 0.45;
  const flapChord = rootChord * 0.25;
  const flapAngle = (flapDeg * Math.PI) / 180;

  // Aileron: outer trailing edge surface
  const aileronSpan = halfSpan * 0.25;
  const aileronChord = tipChord * 0.4;
  const aileronAngle = (aileronDeg * Math.PI) / 180 * side;

  return (
    <group>
      {/* Main wing */}
      <mesh
        geometry={geometry}
        position={[side * rootChord * 0.05, 0, sweepOffset / 2]}
      >
        <meshStandardMaterial color="#A0B0C4" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Flap (inner trailing edge) */}
      <group
        position={[
          side * (rootChord * 0.05 + rootChord * 0.3),
          -flapChord * Math.sin(flapAngle) * 0.3,
          sweepOffset / 2 + halfSpan * 0.2,
        ]}
        rotation={[flapAngle, 0, 0]}
      >
        <mesh>
          <boxGeometry args={[flapChord, 0.03, flapSpan]} />
          <meshStandardMaterial color="#90A0B4" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Aileron (outer trailing edge) */}
      <group
        position={[
          side * (rootChord * 0.05 + tipChord * 0.3),
          -aileronChord * Math.sin(aileronAngle) * 0.3,
          sweepOffset / 2 + halfSpan * 0.75,
        ]}
        rotation={[aileronAngle, 0, 0]}
      >
        <mesh>
          <boxGeometry args={[aileronChord, 0.03, aileronSpan]} />
          <meshStandardMaterial color="#8898A8" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Internal: engine nacelle (with state visualization)
// ---------------------------------------------------------------------------

function Engine({ type, position, running = true, failed = false }: {
  type: string;
  position: [number, number, number];
  running?: boolean;
  failed?: boolean;
}) {
  const color = failed ? '#CC4444' : type === 'turbofan' ? '#708090' : type === 'electric' ? '#40C080' : '#8898A8';
  const radius = type === 'turbofan' ? 0.45 : type === 'electric' ? 0.2 : 0.3;
  const length = type === 'turbofan' ? 2.2 : type === 'electric' ? 1.2 : 1.5;

  return (
    <group position={position}>
      {/* Nacelle */}
      <mesh>
        <cylinderGeometry args={[radius, radius * 0.9, length, 12]} />
        <meshStandardMaterial
          color={color}
          metalness={0.7}
          roughness={0.25}
          emissive={failed ? '#440000' : '#000000'}
          emissiveIntensity={failed ? 0.3 : 0}
        />
      </mesh>
      {/* Inlet */}
      <mesh position={[0, 0, length / 2]}>
        <ringGeometry args={[radius * 0.3, radius * 0.9, 12]} />
        <meshStandardMaterial color={failed ? '#330000' : '#404858'} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Exhaust glow when running */}
      {running && !failed && type === 'turbofan' && (
        <mesh position={[0, 0, -length / 2 - 0.2]}>
          <sphereGeometry args={[radius * 0.5, 8, 8]} />
          <meshStandardMaterial
            color="#FF6622"
            transparent
            opacity={0.4}
            emissive="#FF4400"
            emissiveIntensity={0.8}
          />
        </mesh>
      )}
      {/* Propeller for piston/turboprop */}
      {(type === 'piston' || type === 'turboprop') && (
        <mesh position={[0, 0, length / 2 + 0.1]}>
          <ringGeometry args={[0.05, radius * 1.8, 6]} />
          <meshStandardMaterial
            color={failed ? '#330000' : '#334'}
            metalness={0.4}
            roughness={0.5}
            transparent
            opacity={running && !failed ? 0.6 : 0.3}
          />
        </mesh>
      )}
      {/* Smoke trail when failed */}
      {failed && (
        <mesh position={[0, 0, -length / 2 - 1]}>
          <sphereGeometry args={[0.3, 6, 6]} />
          <meshStandardMaterial color="#444" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Internal: landing gear
// ---------------------------------------------------------------------------

function LandingGear({ position, size = 1, wheelRadius = 0.15 }: {
  position: [number, number, number];
  size?: number;
  wheelRadius?: number;
}) {
  const strutLength = 0.6 * size;
  return (
    <group position={position}>
      {/* Strut */}
      <mesh position={[0, -strutLength / 2, 0]}>
        <cylinderGeometry args={[0.03 * size, 0.03 * size, strutLength, 6]} />
        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Wheel */}
      <mesh position={[0, -strutLength, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[wheelRadius, wheelRadius * 0.35, 8, 12]} />
        <meshStandardMaterial color="#222" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Axle */}
      <mesh position={[0, -strutLength, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, wheelRadius * 2.5, 6]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Internal: tail surfaces (with elevator and rudder)
// ---------------------------------------------------------------------------

function ConventionalTail({ arm, hSize, vSize, elevatorDeg = 0, rudderDeg = 0 }: {
  arm: number;
  hSize: number;
  vSize: number;
  elevatorDeg?: number;
  rudderDeg?: number;
}) {
  const elevAngle = (elevatorDeg * Math.PI) / 180;
  const rudAngle = (rudderDeg * Math.PI) / 180;

  return (
    <group position={[0, 0, -arm]}>
      {/* Vertical fin */}
      <mesh position={[0, vSize / 2, 0]}>
        <boxGeometry args={[0.08, vSize, vSize * 0.5]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Rudder (rear portion of vertical fin) */}
      <group position={[0, vSize / 2, -vSize * 0.15]} rotation={[rudAngle, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.06, vSize * 0.8, vSize * 0.2]} />
          <meshStandardMaterial color="#7080A0" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      {/* Horizontal stabiliser */}
      <mesh>
        <boxGeometry args={[hSize * 2, 0.06, hSize * 0.5]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Elevator (rear portion of horizontal stab) */}
      <group position={[0, 0, -hSize * 0.15]} rotation={[elevAngle, 0, 0]}>
        <mesh>
          <boxGeometry args={[hSize * 1.8, 0.05, hSize * 0.2]} />
          <meshStandardMaterial color="#7080A0" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function TTail({ arm, hSize, vSize, elevatorDeg = 0, rudderDeg = 0 }: {
  arm: number;
  hSize: number;
  vSize: number;
  elevatorDeg?: number;
  rudderDeg?: number;
}) {
  const elevAngle = (elevatorDeg * Math.PI) / 180;
  const rudAngle = (rudderDeg * Math.PI) / 180;

  return (
    <group position={[0, 0, -arm]}>
      {/* Tall vertical fin */}
      <mesh position={[0, vSize * 0.7, 0]}>
        <boxGeometry args={[0.08, vSize * 1.4, vSize * 0.4]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Rudder */}
      <group position={[0, vSize * 0.7, -vSize * 0.1]} rotation={[rudAngle, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.06, vSize * 1.2, vSize * 0.15]} />
          <meshStandardMaterial color="#7080A0" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      {/* Horizontal stabiliser at the TOP of the fin */}
      <mesh position={[0, vSize * 1.3, 0]}>
        <boxGeometry args={[hSize * 2, 0.06, hSize * 0.5]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Elevator */}
      <group position={[0, vSize * 1.3, -hSize * 0.15]} rotation={[elevAngle, 0, 0]}>
        <mesh>
          <boxGeometry args={[hSize * 1.8, 0.05, hSize * 0.2]} />
          <meshStandardMaterial color="#7080A0" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function VTail({ arm, hSize, vSize }: { arm: number; hSize: number; vSize: number }) {
  const angle = Math.PI / 6;
  return (
    <group position={[0, 0, -arm]}>
      <mesh position={[-hSize * 0.4, vSize * 0.3, 0]} rotation={[0, 0, angle]}>
        <boxGeometry args={[0.06, hSize, hSize * 0.4]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[hSize * 0.4, vSize * 0.3, 0]} rotation={[0, 0, -angle]}>
        <boxGeometry args={[0.06, hSize, hSize * 0.4]} />
        <meshStandardMaterial color="#8090A8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Canard({ position, size, elevatorDeg = 0 }: {
  position: [number, number, number];
  size: number;
  elevatorDeg?: number;
}) {
  const elevAngle = (elevatorDeg * Math.PI) / 180;
  return (
    <group position={position} rotation={[elevAngle, 0, 0]}>
      <mesh>
        <boxGeometry args={[size * 2, 0.05, size * 0.4]} />
        <meshStandardMaterial color="#A0B8C8" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Internal: icing overlay
// ---------------------------------------------------------------------------

function IcingOverlay({ span, chord, level }: { span: number; chord: number; level: number }) {
  if (level <= 0) return null;
  return (
    <group>
      {/* Ice on leading edge of wings */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[span * 0.9, 0.05 + level * 0.03, chord * 0.15]} />
        <meshStandardMaterial
          color="#C8E0F0"
          transparent
          opacity={0.3 + level * 0.3}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>
      {/* Ice on tail */}
      <mesh position={[0, 0.04, -span * 0.3]}>
        <boxGeometry args={[span * 0.4, 0.03 + level * 0.02, chord * 0.1]} />
        <meshStandardMaterial
          color="#D0E8F8"
          transparent
          opacity={0.2 + level * 0.3}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>
    </group>
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
  const rootChord = design.areaM2 / wingSpan * 1.8;
  const tipChord = rootChord * 0.55;
  const sweep = design.sweepDeg;

  // Tail sizing
  const hTailSize = wingSpan * 0.18;
  const vTailSize = wingSpan * 0.22;

  // Gear position (0 = retracted, 1 = extended)
  const gearPos = design.gearPosition ?? 1;

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

  // Canard position
  const canardZ = fuselageLength * 0.15;
  const canardSize = wingSpan * 0.08;

  // Engine running states
  const engRunning = design.enginesRunning ?? engines.map((_, i) =>
    design.failedEngine !== (i + 1)
  );

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
        flapDeg={design.flapDeg}
        aileronDeg={design.aileronDeg}
      />
      <WingHalf
        span={wingSpan}
        rootChord={rootChord}
        tipChord={tipChord}
        sweep={sweep}
        thickness={design.thicknessRatio}
        side={-1}
        flapDeg={design.flapDeg}
        aileronDeg={-(design.aileronDeg ?? 0)}
      />

      {/* Tail surfaces */}
      {design.tailType === 'conventional' && (
        <ConventionalTail
          arm={tailArm} hSize={hTailSize} vSize={vTailSize}
          elevatorDeg={design.elevatorDeg} rudderDeg={design.rudderDeg}
        />
      )}
      {design.tailType === 't-tail' && (
        <TTail
          arm={tailArm} hSize={hTailSize} vSize={vTailSize}
          elevatorDeg={design.elevatorDeg} rudderDeg={design.rudderDeg}
        />
      )}
      {design.tailType === 'v-tail' && (
        <VTail arm={tailArm} hSize={hTailSize} vSize={vTailSize} />
      )}
      {design.tailType === 'canard' && (
        <>
          <ConventionalTail
            arm={tailArm * 0.8} hSize={hTailSize * 0.8} vSize={vTailSize * 0.8}
            elevatorDeg={design.elevatorDeg} rudderDeg={design.rudderDeg}
          />
          <Canard position={[0, 0, canardZ]} size={canardSize} elevatorDeg={design.elevatorDeg} />
        </>
      )}
      {design.tailType === 'none' && null}

      {/* Engines */}
      {engines.map((pos, i) => (
        <group key={i}>
          <Engine
            type={design.engineType}
            position={pos}
            running={engRunning[i]}
            failed={design.failedEngine === (i + 1)}
          />
          {/* Spinning propeller visual for piston/turboprop */}
          {(design.engineType === 'piston' || design.engineType === 'turboprop') && engRunning[i] && (
            <group ref={i === 0 ? propRef : undefined} position={[pos[0], pos[1], pos[2] + 1]}>
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

      {/* Landing gear (3 points: nose + 2 main) */}
      <group position={[0, -fuselageRadius, 0]} scale={[1, gearPos, 1]}>
        {/* Nose gear */}
        <LandingGear position={[0, 0, fuselageLength * 0.3]} size={0.8} wheelRadius={0.12} />
        {/* Left main gear */}
        <LandingGear position={[-wingSpan * 0.12, 0, -0.3]} size={1} wheelRadius={0.18} />
        {/* Right main gear */}
        <LandingGear position={[wingSpan * 0.12, 0, -0.3]} size={1} wheelRadius={0.18} />
      </group>

      {/* Icing overlay */}
      <IcingOverlay span={wingSpan} chord={rootChord} level={design.icingLevel ?? 0} />

      {/* Cockpit canopy */}
      <mesh position={[0, fuselageRadius * 0.8, fuselageLength * 0.2]}>
        <sphereGeometry args={[fuselageRadius * 0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#88BBE8" transparent opacity={0.5} metalness={0.8} roughness={0.1} />
      </mesh>
    </group>
  );
}

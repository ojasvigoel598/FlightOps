// 3D Force vector arrows displayed on the aircraft.
// Shows lift, drag, thrust, and weight as coloured arrows.
// Used in Engineering Mode (B20) for visual teaching.

import { useMemo } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Force arrow component — a coloured cylinder + cone tip
// ---------------------------------------------------------------------------

function ForceArrow({
  origin,
  direction,
  magnitude,
  color,
  label,
  visible = true,
}: {
  origin: [number, number, number];
  direction: [number, number, number];
  magnitude: number;
  color: string;
  label: string;
  visible?: boolean;
}) {
  if (!visible || magnitude < 0.01) return null;

  const arrowLength = Math.min(magnitude * 0.015, 8); // scale for visibility
  const shaftRadius = 0.04;
  const tipRadius = 0.1;
  const tipLength = 0.4;

  const dir = new THREE.Vector3(...direction).normalize();

  // Shaft center is halfway along the arrow
  const shaftCenter = new THREE.Vector3(...origin).add(dir.clone().multiplyScalar(arrowLength / 2));

  // Tip position
  const tipPos = new THREE.Vector3(...origin).add(dir.clone().multiplyScalar(arrowLength));

  // Rotation to align with direction
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  const euler = new THREE.Euler().setFromQuaternion(quat);

  return (
    <group>
      {/* Shaft */}
      <mesh position={[shaftCenter.x, shaftCenter.y, shaftCenter.z]} rotation={euler}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, arrowLength - tipLength, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Tip cone */}
      <mesh position={[tipPos.x, tipPos.y, tipPos.z]} rotation={euler}>
        <coneGeometry args={[tipRadius, tipLength, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// All four forces displayed together
// ---------------------------------------------------------------------------

export interface ForceVectorsProps {
  /** Aircraft position in world space */
  position: [number, number, number];
  /** Lift force in N */
  liftN: number;
  /** Drag force in N */
  dragN: number;
  /** Thrust force in N */
  thrustN: number;
  /** Weight force in N */
  weightN: number;
  /** Whether to show vectors */
  visible?: boolean;
  /** Scale factor for arrow lengths */
  scale?: number;
}

export default function ForceVectors({
  position,
  liftN,
  dragN,
  thrustN,
  weightN,
  visible = true,
  scale = 1,
}: ForceVectorsProps) {
  const s = scale;
  return (
    <group position={position}>
      {/* Lift — blue, upward */}
      <ForceArrow
        origin={[0, 0, 0]}
        direction={[0, 1, 0]}
        magnitude={liftN * s * 0.01}
        color="#3B82F6"
        label="L"
        visible={visible}
      />

      {/* Drag — red, backward (-Z) */}
      <ForceArrow
        origin={[0, 0, 0]}
        direction={[0, 0, -1]}
        magnitude={dragN * s * 0.01}
        color="#EF4444"
        label="D"
        visible={visible}
      />

      {/* Thrust — green, forward (+Z) */}
      <ForceArrow
        origin={[0, -0.5, 0.5]}
        direction={[0, 0, 1]}
        magnitude={thrustN * s * 0.01}
        color="#22C55E"
        label="T"
        visible={visible}
      />

      {/* Weight — orange, downward */}
      <ForceArrow
        origin={[0, 0, 0]}
        direction={[0, -1, 0]}
        magnitude={weightN * s * 0.01}
        color="#F59E0B"
        label="W"
        visible={visible}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Combined L/D ratio indicator (visual bar between lift and drag)
// ---------------------------------------------------------------------------

export function LDIndicator({
  position,
  ld,
  visible = true,
}: {
  position: [number, number, number];
  ld: number;
  visible?: boolean;
}) {
  if (!visible) return null;
  const barWidth = Math.min(ld * 0.15, 4);
  return (
    <group position={position}>
      <mesh position={[2.5, 0.3, 0]}>
        <boxGeometry args={[barWidth, 0.08, 0.08]} />
        <meshBasicMaterial color={ld > 10 ? '#4ADE80' : ld > 6 ? '#FBBF24' : '#EF4444'} />
      </mesh>
    </group>
  );
}

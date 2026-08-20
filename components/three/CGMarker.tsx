// CG (Centre of Gravity) and Neutral Point visual markers on the 3D aircraft.
// Shows the CG position, neutral point, and the static margin between them.
// Used in Engineering Mode (B24) for teaching stability concepts.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// CG Marker — a red/green diamond at the CG position
// ---------------------------------------------------------------------------

interface CGMarkerProps {
  /** CG position from nose as fraction of fuselage length (0-1) */
  cgFraction: number;
  /** Neutral point position from nose as fraction (0-1) */
  neutralPointFraction: number;
  /** Fuselage length for scaling */
  fuselageLength: number;
  /** Whether currently visible */
  visible?: boolean;
}

export default function CGMarker({
  cgFraction,
  neutralPointFraction,
  fuselageLength,
  visible = true,
}: CGMarkerProps) {
  if (!visible) return null;

  // Convert fractions to Z positions (nose = +fuselageLength/2)
  const noseZ = fuselageLength / 2;
  const cgZ = noseZ - cgFraction * fuselageLength;
  const npZ = noseZ - neutralPointFraction * fuselageLength;

  const isStable = cgFraction < neutralPointFraction;

  return (
    <group>
      {/* CG marker — red diamond */}
      <group position={[0, 0.6, cgZ]}>
        {/* Diamond shape using octahedron */}
        <mesh>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial
            color={isStable ? '#22C55E' : '#EF4444'}
            emissive={isStable ? '#22C55E' : '#EF4444'}
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* CG label ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.35, 16]} />
          <meshBasicMaterial color={isStable ? '#22C55E' : '#EF4444'} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Neutral point marker — blue sphere */}
      <group position={[0, 0.6, npZ]}>
        <mesh>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshStandardMaterial
            color="#3B82F6"
            emissive="#3B82F6"
            emissiveIntensity={0.3}
          />
        </mesh>
        {/* NP ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.3, 16]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Static margin line — connecting CG to NP */}
      <StaticMarginLine
        from={[0, 0.6, cgZ]}
        to={[0, 0.6, npZ]}
        isStable={isStable}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Line connecting CG to NP showing static margin
// ---------------------------------------------------------------------------

function StaticMarginLine({
  from,
  to,
  isStable,
}: {
  from: [number, number, number];
  to: [number, number, number];
  isStable: boolean;
}) {
  const meshRef = useRef<THREE.Line>(null);

  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [from, to]);

  const LineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: isStable ? '#4ADE80' : '#F87171' });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
    ]);
    const line = new THREE.Line(geo, mat);
    return line;
  }, [from, to, isStable]);

  return <primitive object={LineObj} />;
}

// ---------------------------------------------------------------------------
// Pitch trim indicator — shows pitching moment direction
// ---------------------------------------------------------------------------

export function PitchIndicator({
  position,
  cm,
  visible = true,
}: {
  position: [number, number, number];
  cm: number; // positive = nose-up
  visible?: boolean;
}) {
  if (!visible || Math.abs(cm) < 0.001) return null;

  const arrowDir: [number, number, number] = cm > 0 ? [0, 1, 0] : [0, -1, 0];
  const colour = cm > 0 ? '#F59E0B' : '#3B82F6';
  const length = Math.abs(cm) * 30; // scaled for visibility

  return (
    <group position={position}>
      {/* Curved arrow hint */}
      <mesh position={[0, cm > 0 ? length / 2 + 0.3 : -length / 2 - 0.3, 0]}>
        <cylinderGeometry args={[0.04, 0.04, length, 6]} />
        <meshBasicMaterial color={colour} />
      </mesh>
      {/* Arrow tip */}
      <mesh
        position={[0, cm > 0 ? length + 0.3 : -length - 0.3, 0]}
        rotation={[0, 0, cm > 0 ? 0 : Math.PI]}
      >
        <coneGeometry args={[0.1, 0.3, 6]} />
        <meshBasicMaterial color={colour} />
      </mesh>
    </group>
  );
}

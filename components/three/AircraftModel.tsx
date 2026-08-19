// Parametric 3D aircraft model — responds to aircraft-config changes.
// Wing span, sweep, taper, tail type, and fuselage dimensions drive the geometry.
// All dimensions are in metres, centred at origin.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Types (mirrors services/aircraft-config.ts without circular deps)
// ---------------------------------------------------------------------------

export interface AircraftGeoParams {
  wingSpanM: number;
  wingAreaM2: number;
  taperRatio: number;
  sweepDeg: number;
  dihedralDeg: number;
  fuselageLengthM: number;
  fuselageDiameterM: number;
  tailType: 'conventional' | 't-tail' | 'v-tail' | 'canard' | 'none';
  htAreaM2: number;
  vtAreaM2: number;
  tailArmM: number;
  engineCount: number;
  engineType: 'piston' | 'turboprop' | 'turbojet' | 'turbofan' | 'electric';
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function createWingShape(span: number, rootChord: number, tipChord: number, sweep: number): THREE.Shape {
  const halfSpan = span / 2;
  const shape = new THREE.Shape();
  // Root leading edge at origin, trailing edge at rootChord
  shape.moveTo(0, 0);
  shape.lineTo(rootChord, 0);
  // Tip: swept back by `sweep` metres over halfSpan
  shape.lineTo(sweep + tipChord, halfSpan);
  shape.lineTo(sweep, halfSpan);
  shape.closePath();
  return shape;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  params: AircraftGeoParams;
  color?: string;
}

export default function AircraftModel({ params, color = '#E8E8E8' }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  const {
    wingSpanM, wingAreaM2, taperRatio, sweepDeg, dihedralDeg,
    fuselageLengthM, fuselageDiameterM,
    tailType, htAreaM2, vtAreaM2, tailArmM,
    engineCount, engineType,
  } = params;

  // Derived
  const meanChord = wingAreaM2 / wingSpanM;
  const rootChord = (2 * meanChord) / (1 + taperRatio);
  const tipChord = rootChord * taperRatio;
  const sweepM = Math.tan((sweepDeg * Math.PI) / 180) * (wingSpanM / 2);

  // Fuselage dimensions
  const fLen = fuselageLengthM;
  const fRad = fuselageDiameterM / 2;
  const noseLen = fLen * 0.25;
  const tailLen = fLen * 0.2;

  // Tail dimensions
  const htSpan = Math.sqrt(htAreaM2 * 2.2);
  const htChord = htAreaM2 / htSpan;
  const vtSpan = Math.sqrt(vtAreaM2 * 3);
  const vtChord = vtAreaM2 / vtSpan;

  // Engine nacelle
  const nacelleLen = engineType === 'turbofan' ? fLen * 0.3 : fLen * 0.15;
  const nacelleRad = engineType === 'turbofan' ? fRad * 0.55 : fRad * 0.4;

  const geo = useMemo(() => {
    const wingShape = createWingShape(wingSpanM, rootChord, tipChord, sweepM);
    const extrudeSettings = { depth: 0.06, bevelEnabled: false };

    return {
      wingExtrude: new THREE.ExtrudeGeometry(wingShape, extrudeSettings),
      fuselage: new THREE.CylinderGeometry(fRad, fRad * 0.7, fLen, 16).rotateX(Math.PI / 2),
      nose: new THREE.ConeGeometry(fRad, noseLen, 16).rotateX(-Math.PI / 2),
      tailCone: new THREE.ConeGeometry(fRad * 0.7, tailLen, 12).rotateX(Math.PI / 2),
      htTail: new THREE.BoxGeometry(htSpan, 0.04, htChord),
      vtTail: new THREE.BoxGeometry(0.04, vtSpan, vtChord),
      nacelle: new THREE.CylinderGeometry(nacelleRad, nacelleRad * 0.9, nacelleLen, 12).rotateX(Math.PI / 2),
      propDisk: new THREE.CircleGeometry(nacelleRad * 1.3, 24),
    };
  }, [wingSpanM, rootChord, tipChord, sweepM, fLen, fRad, noseLen, tailLen, htSpan, htChord, vtSpan, vtChord, nacelleLen, nacelleRad]);

  const wingColor = '#C8D0D8';
  const tailColor = '#B8C0C8';
  const engineColor = '#555';

  return (
    <group ref={groupRef}>
      {/* Fuselage */}
      <mesh geometry={geo.fuselage} position={[0, 0, 0]}>
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Nose cone */}
      <mesh geometry={geo.nose} position={[0, 0, fLen / 2]}>
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Tail cone */}
      <mesh geometry={geo.tailCone} position={[0, 0, -fLen / 2]}>
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
      </mesh>

      {/* Main wing — centred on fuselage, with dihedral */}
      <group
        position={[0, -fRad * 0.1, fLen * 0.05]}
        rotation={[0, 0, (dihedralDeg * Math.PI) / 180]}
      >
        <mesh geometry={geo.wingExtrude} position={[0, 0, -0.03]}>
          <meshStandardMaterial color={wingColor} metalness={0.2} roughness={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Tail surfaces */}
      {tailType !== 'none' && (
        <group position={[0, 0, -fLen / 2 + tailLen * 0.4]}>
          {/* Horizontal tail */}
          {tailType !== 'v-tail' && (
            <mesh
              geometry={geo.htTail}
              position={[0, tailType === 't-tail' ? vtSpan * 0.5 : fRad * 0.8, 0]}
            >
              <meshStandardMaterial color={tailColor} metalness={0.2} roughness={0.7} />
            </mesh>
          )}

          {/* Vertical tail */}
          {tailType !== 'v-tail' && (
            <mesh geometry={geo.vtTail} position={[0, fRad * 0.8 + vtSpan * 0.5, 0]}>
              <meshStandardMaterial color={tailColor} metalness={0.2} roughness={0.7} />
            </mesh>
          )}

          {/* V-tail */}
          {tailType === 'v-tail' && (
            <>
              <mesh
                geometry={geo.htTail}
                position={[0, fRad + vtSpan * 0.3, 0]}
                rotation={[0, 0, Math.PI / 6]}
              >
                <meshStandardMaterial color={tailColor} metalness={0.2} roughness={0.7} />
              </mesh>
              <mesh
                geometry={geo.htTail}
                position={[0, fRad + vtSpan * 0.3, 0]}
                rotation={[0, 0, -Math.PI / 6]}
              >
                <meshStandardMaterial color={tailColor} metalness={0.2} roughness={0.7} />
              </mesh>
            </>
          )}
        </group>
      )}

      {/* Canard (front wing) */}
      {tailType === 'canard' && (
        <mesh
          geometry={geo.htTail}
          position={[0, fRad * 0.3, fLen * 0.35]}
        >
          <meshStandardMaterial color={wingColor} metalness={0.2} roughness={0.7} />
        </mesh>
      )}

      {/* Engine nacelles */}
      {Array.from({ length: engineCount }).map((_, i) => {
        const offset = engineCount === 1 ? 0 : (i === 0 ? -1 : 1) * (wingSpanM * 0.25);
        const xPos = engineCount === 1 ? 0 : offset;
        return (
          <group key={i} position={[xPos, -fRad * 0.3, fLen * 0.05]}>
            <mesh geometry={geo.nacelle}>
              <meshStandardMaterial color={engineColor} metalness={0.5} roughness={0.4} />
            </mesh>
            {/* Propeller disk for prop-driven engines */}
            {engineType !== 'turbofan' && engineType !== 'turbojet' && (
              <mesh
                geometry={geo.propDisk}
                position={[0, 0, nacelleLen / 2 + 0.05]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <meshStandardMaterial color="#333" transparent opacity={0.4} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// 3D Hangar Scene — displays the aircraft in a hangar environment
// with inspection cameras, configuration visualization, and lighting.
//
// Camera modes: orbit (default), front, side, top, cockpit, close-up.
// The aircraft is large and visually dominant in the scene.

import { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

import AircraftModel, { type AircraftDesignParams } from './AircraftModel';

// ---------------------------------------------------------------------------
// Camera presets
// ---------------------------------------------------------------------------

export type HangarCameraMode = 'orbit' | 'front' | 'side' | 'top' | 'cockpit' | 'close_wing' | 'close_engine' | 'close_gear';

const CAMERA_PRESETS: Record<HangarCameraMode, { position: [number, number, number]; target: [number, number, number] }> = {
  orbit: { position: [8, 5, 12], target: [0, 0, 0] },
  front: { position: [0, 2, 14], target: [0, 1, 0] },
  side: { position: [14, 3, 0], target: [0, 1, 0] },
  top: { position: [0, 16, 0.1], target: [0, 0, 0] },
  cockpit: { position: [0, 1.8, 2.5], target: [0, 1.5, -2] },
  close_wing: { position: [5, 1, 2], target: [3, 0.5, 0] },
  close_engine: { position: [3, 0.5, 1], target: [2, 0, 0] },
  close_gear: { position: [1.5, -0.5, 2], target: [0, -0.8, 0] },
};

// ---------------------------------------------------------------------------
// Animated camera controller
// ---------------------------------------------------------------------------

function CameraController({ mode }: { mode: HangarCameraMode }) {
  const { camera } = useThree();
  const preset = CAMERA_PRESETS[mode];
  const targetRef = useRef(new THREE.Vector3(...preset.position));
  const lookAtRef = useRef(new THREE.Vector3(...preset.target));

  useFrame(() => {
    targetRef.current.set(...preset.position);
    lookAtRef.current.set(...preset.target);
    camera.position.lerp(targetRef.current, 0.05);
    const currentLookAt = new THREE.Vector3();
    camera.getWorldDirection(currentLookAt);
    camera.lookAt(
      camera.position.x + (lookAtRef.current.x - camera.position.x) * 0.05,
      camera.position.y + (lookAtRef.current.y - camera.position.y) * 0.05,
      camera.position.z + (lookAtRef.current.z - camera.position.z) * 0.05,
    );
  });

  return null;
}

// ---------------------------------------------------------------------------
// Hangar environment
// ---------------------------------------------------------------------------

function HangarEnvironment() {
  return (
    <group>
      {/* Hangar floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#2A2E34" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Floor grid lines */}
      {Array.from({ length: 15 }, (_, i) => {
        const pos = -14 + i * 2;
        return (
          <group key={`grid-${i}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos, -0.94, 0]}>
              <planeGeometry args={[0.02, 28]} />
              <meshStandardMaterial color="#3A3E44" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.94, pos]}>
              <planeGeometry args={[28, 0.02]} />
              <meshStandardMaterial color="#3A3E44" />
            </mesh>
          </group>
        );
      })}

      {/* Back wall */}
      <mesh position={[0, 5, -15]}>
        <planeGeometry args={[30, 12]} />
        <meshStandardMaterial color="#1A1E24" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-15, 5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[30, 12]} />
        <meshStandardMaterial color="#1A1E24" metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh position={[15, 5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[30, 12]} />
        <meshStandardMaterial color="#1A1E24" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 11, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0D1117" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Hangar doors (back) */}
      <mesh position={[0, 3.5, -14.9]}>
        <boxGeometry args={[12, 7, 0.2]} />
        <meshStandardMaterial color="#3A3E44" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Support columns */}
      {[-12, -6, 6, 12].map((x) => (
        <mesh key={`col-${x}`} position={[x, 5, -14]}>
          <cylinderGeometry args={[0.15, 0.15, 10, 8]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Overhead lights */}
      {[-8, 0, 8].map((x) => (
        <group key={`light-${x}`}>
          <mesh position={[x, 10.5, 0]}>
            <boxGeometry args={[0.3, 0.1, 4]} />
            <meshStandardMaterial color="#FFF" emissive="#FFFFFF" emissiveIntensity={0.5} />
          </mesh>
          <pointLight position={[x, 10, 0]} intensity={80} distance={20} color="#FFF5E6" />
        </group>
      ))}

      {/* Workbench */}
      <group position={[10, -0.5, -8]}>
        <mesh>
          <boxGeometry args={[3, 0.1, 1]} />
          <meshStandardMaterial color="#8B7355" />
        </mesh>
        <mesh position={[-1.3, -0.45, 0]}>
          <boxGeometry args={[0.1, 0.8, 0.8]} />
          <meshStandardMaterial color="#666" metalness={0.6} />
        </mesh>
        <mesh position={[1.3, -0.45, 0]}>
          <boxGeometry args={[0.1, 0.8, 0.8]} />
          <meshStandardMaterial color="#666" metalness={0.6} />
        </mesh>
      </group>

      {/* Tool cabinet */}
      <group position={[-10, -0.3, -10]}>
        <mesh>
          <boxGeometry args={[1.5, 1.5, 0.8]} />
          <meshStandardMaterial color="#CC3333" metalness={0.4} roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Hangar3D component
// ---------------------------------------------------------------------------

export interface Hangar3DProps {
  design: AircraftDesignParams;
  cameraMode?: HangarCameraMode;
  showShadows?: boolean;
}

export default function Hangar3D({ design, cameraMode = 'orbit', showShadows = true }: Hangar3DProps) {
  return (
    <Canvas
      camera={{ position: [8, 5, 12], fov: 45 }}
      shadows={showShadows}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0D1117');
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.2;
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 8, 0]} intensity={50} distance={25} color="#FFF5E6" />
      <spotLight position={[-5, 8, 5]} angle={0.4} penumbra={0.5} intensity={30} color="#E8F0FF" />

      {/* Environment */}
      <HangarEnvironment />
      <ContactShadows position={[0, -0.94, 0]} opacity={0.4} scale={20} blur={2} />

      {/* Aircraft */}
      <group position={[0, 0, 0]}>
        <AircraftModel design={design} />
      </group>

      {/* Camera */}
      <CameraController mode={cameraMode} />
      {cameraMode === 'orbit' && (
        <OrbitControls
          target={[0, 0, 0]}
          minDistance={3}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2 + 0.1}
          enableDamping
          dampingFactor={0.05}
        />
      )}
    </Canvas>
  );
}

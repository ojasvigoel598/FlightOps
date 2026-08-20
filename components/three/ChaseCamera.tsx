// Chase camera that smoothly follows the aircraft.
// Provides orbiting, trailing, and cockpit perspectives.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ChaseCameraProps {
  /** World position of the target */
  target: [number, number, number];
  /** Pitch of the target in radians */
  pitch: number;
  /** Bank of the target in radians */
  bank: number;
  /** Whether the aircraft is flying */
  flying: boolean;
  /** Camera mode: 'chase' = behind, 'orbit' = cinematic, 'side' = flyby, 'cockpit' = pilot view */
  mode?: 'chase' | 'orbit' | 'side' | 'cockpit';
}

export default function ChaseCamera({
  target,
  pitch,
  bank,
  flying,
  mode = 'chase',
}: ChaseCameraProps) {
  const { camera } = useThree();
  const smoothPos = useRef(new THREE.Vector3(target[0], target[1] + 8, target[2] + 20));
  const smoothLookAt = useRef(new THREE.Vector3(target[0], target[1], target[2]));
  const orbitAngle = useRef(0);

  useFrame((_, delta) => {
    const t = new THREE.Vector3(target[0], target[1], target[2]);

    let desiredPos: THREE.Vector3;
    let desiredLookAt: THREE.Vector3;

    if (!flying) {
      // Parked — orbit slowly around the aircraft
      orbitAngle.current += delta * 0.15;
      const radius = 18;
      const height = 8;
      desiredPos = new THREE.Vector3(
        t.x + Math.cos(orbitAngle.current) * radius,
        t.y + height,
        t.z + Math.sin(orbitAngle.current) * radius,
      );
      desiredLookAt = t.clone().add(new THREE.Vector3(0, 1, 0));
    } else if (mode === 'chase') {
      // Chase — behind and above
      const behindDist = 22;
      const aboveDist = 6;
      // Camera offset rotates with aircraft yaw (simplified: use pitch and bank)
      const yawComponent = Math.sin(bank) * 5;

      desiredPos = new THREE.Vector3(
        t.x + yawComponent,
        t.y + aboveDist,
        t.z + behindDist,
      );
      desiredLookAt = t.clone().add(new THREE.Vector3(0, 1, 0));
    } else if (mode === 'cockpit') {
      // Cockpit — first-person pilot view
      desiredPos = new THREE.Vector3(
        t.x,
        t.y + 0.6,
        t.z + 2.5,
      );
      desiredLookAt = new THREE.Vector3(
        t.x,
        t.y + 0.3,
        t.z - 20,
      );
    } else if (mode === 'side') {
      // Side flyby — dramatic cinematic angle
      desiredPos = new THREE.Vector3(
        t.x + 25,
        t.y + 4,
        t.z + 5,
      );
      desiredLookAt = t.clone();
    } else {
      // Orbit — smooth circular motion during flight
      orbitAngle.current += delta * 0.3;
      const radius = 30;
      const height = 10 + Math.sin(orbitAngle.current * 0.5) * 5;
      desiredPos = new THREE.Vector3(
        t.x + Math.cos(orbitAngle.current) * radius,
        t.y + height,
        t.z + Math.sin(orbitAngle.current) * radius,
      );
      desiredLookAt = t.clone().add(new THREE.Vector3(0, 2, 0));
    }

    // Smooth interpolation (lerp)
    const smoothing = flying ? 2.0 : 1.5;
    smoothPos.current.lerp(desiredPos, smoothing * delta);
    smoothLookAt.current.lerp(desiredLookAt, smoothing * delta);

    // Apply to camera
    camera.position.copy(smoothPos.current);
    camera.lookAt(smoothLookAt.current);
  });

  return null;
}

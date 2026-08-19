// Global type declarations for @react-three/fiber JSX elements.
// This extends the JSX namespace to include Three.js intrinsic elements
// used by React Three Fiber.

import '@react-three/fiber';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      boxGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      planeGeometry: any;
      circleGeometry: any;
      extrudeGeometry: any;
      directionallight: any;
      ambientlight: any;
      hemispherelight: any;
    }
  }
}

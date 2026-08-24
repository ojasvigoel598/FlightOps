// Engineering Analysis Module — Features 6–12, 15
//
// Implements the core aerospace engineering analysis tools that distinguish
// FlightOps as a real engineering application rather than an educational demo.
//
// References:
//   Raymer, D. "Aircraft Design: A Conceptual Approach" (6th ed., 2023)
//   Anderson, J.D. "Modern Compressible Flow" (3rd ed., 2003)
//   Anderson, J.D. "Introduction to Flight" (8th ed., 2016)
//   McCormick, B.W. "Aerodynamics, Aeronautics, and Flight Mechanics" (1995)

const PI = Math.PI;

// ---------------------------------------------------------------------------
// Feature 6 — Component Buildup Drag (Raymer Method)
// ---------------------------------------------------------------------------

export interface ComponentWettedArea {
  name: string;
  wettedAreaM2: number;
  /** Skin friction coefficient (Cf) */
  cf: number;
  /** Form factor (FF) — accounts for pressure drag */
  formFactor: number;
  /** Interference factor (Q) */
  interferenceFactor: number;
  /** Component parasite drag: CD0_comp = Cf × FF × Q × Swet / Sref */
  cd0Component: number;
}

export interface ComponentBuildupResult {
  components: ComponentWettedArea[];
  /** Total parasite drag coefficient */
  cd0Total: number;
  /** Component breakdown for visualization */
  breakdown: Array<{ name: string; fraction: number }>;
}

/**
 * Raymer component buildup method for parasite drag estimation.
 * CD0 = Σ(Cf × FF × Q × Swet) / Sref
 *
 * Each component (wing, fuselage, tail, nacelle, landing gear, etc.)
 * contributes independently, then an interference factor accounts for
 * component interactions.
 *
 * Reference: Raymer Ch. 12, "Accurate" method.
 */
export function componentBuildupDrag(
  /** Reference wing area (m²) */
  sRefM2: number,
  /** Components to analyze */
  components: Array<{
    name: string;
    /** Wetted area (m²) */
    swetM2: number;
    /** Reynolds number based on component length */
    reynolds: number;
    /** Mach number */
    mach: number;
    /** Form factor (typically 1.1-1.5 depending on fineness ratio) */
    formFactor: number;
    /** Interference factor (typically 1.0-1.5) */
    interferenceFactor: number;
    /** Whether flow is laminar (reduces Cf) */
    laminar?: boolean;
  }>,
): ComponentBuildupResult {
  const results: ComponentWettedArea[] = [];
  let cd0Total = 0;

  for (const comp of components) {
    // Turbulent flat-plate skin friction: Cf = 0.455 / (log10(Re))^2.58
    // Laminar: Cf = 1.328 / sqrt(Re)
    let cf: number;
    if (comp.laminar && comp.reynolds < 5e5) {
      cf = 1.328 / Math.sqrt(comp.reynolds);
    } else {
      cf = 0.455 / Math.pow(Math.log10(Math.max(comp.reynolds, 1e3)), 2.58);
    }

    // Compressibility correction (turbulent): Cfc = Cf × (1 - 0.1 × M²)
    if (comp.mach > 0.1) {
      cf *= 1 - 0.1 * comp.mach * comp.mach;
    }

    const cd0Comp = (cf * comp.formFactor * comp.interferenceFactor * comp.swetM2) / sRefM2;

    results.push({
      name: comp.name,
      wettedAreaM2: comp.swetM2,
      cf,
      formFactor: comp.formFactor,
      interferenceFactor: comp.interferenceFactor,
      cd0Component: cd0Comp,
    });
    cd0Total += cd0Comp;
  }

  const breakdown = results.map(r => ({
    name: r.name,
    fraction: cd0Total > 0 ? r.cd0Component / cd0Total : 0,
  }));

  return { components: results, cd0Total, breakdown };
}

// ---------------------------------------------------------------------------

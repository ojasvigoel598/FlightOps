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
// Feature 7 — BEM Prandtl Tip Loss (Corrected at All Stations)
// ---------------------------------------------------------------------------

/**
 * Prandtl tip-loss factor F at radial station r/R for B-bladed propeller.
 * F = (2/π) × arccos(exp(-f))
 * where f = (B/2) × (R-r) / (r × sin(φ))
 *
 * Applied at EVERY station, not just the tip.
 * Reference: McCormick Ch. 3, Anderson Intro to Flight §6.4.
 */
export function prandtlTipLossFactor(
  nBlades: number,
  rOverR: number,
  phiRad: number,
): number {
  if (rOverR >= 0.99) return 0;  // exactly at tip → zero loading
  if (rOverR <= 0.01 || Math.abs(phiRad) < 0.001) return 1;  // hub → no loss

  const rRatio = rOverR;
  const f = (nBlades / 2) * (1 - rRatio) / (rRatio * Math.max(Math.sin(phiRad), 0.01));
  if (f > 20) return 0;
  return (2 / PI) * Math.acos(Math.exp(-f));
}

// ---------------------------------------------------------------------------
// Feature 8 — Historical Aircraft Comparison Database
// ---------------------------------------------------------------------------

export interface HistoricalAircraft {
  name: string;
  manufacturer: string;
  year: number;
  type: string;  // 'GA' | 'Airliner' | 'Fighter' | 'Glider' | 'UAV'
  wingAreaM2: number;
  wingSpanM: number;
  massKg: number;
  maxThrustN: number;
  maxSpeedMs: number;
  rangeKm: number;
  clMax: number;
  aspectRatio: number;
  /** Max L/D */
  maxLd: number;
  /** Stall speed m/s */
  stallSpeedMs: number;
}

export const HISTORICAL_AIRCRAFT: HistoricalAircraft[] = [
  {
    name: 'Cessna 172 Skyhawk',
    manufacturer: 'Cessna',
    year: 1956,
    type: 'GA',
    wingAreaM2: 16.17,
    wingSpanM: 11.0,
    massKg: 1043,
    maxThrustN: 5000,
    maxSpeedMs: 72,
    rangeKm: 1289,
    clMax: 1.65,
    aspectRatio: 7.48,
    maxLd: 12,
    stallSpeedMs: 25,
  },
  {
    name: 'Piper PA-28 Cherokee',
    manufacturer: 'Piper',
    year: 1961,
    type: 'GA',
    wingAreaM2: 15.79,
    wingSpanM: 10.8,
    massKg: 919,
    maxThrustN: 4500,
    maxSpeedMs: 65,
    rangeKm: 1100,
    clMax: 1.60,
    aspectRatio: 7.40,
    maxLd: 11,
    stallSpeedMs: 24,
  },
  {
    name: 'Boeing 737-800',
    manufacturer: 'Boeing',
    year: 1997,
    type: 'Airliner',
    wingAreaM2: 124.6,
    wingSpanM: 35.8,
    massKg: 70000,
    maxThrustN: 220000,
    maxSpeedMs: 250,
    rangeKm: 5400,
    clMax: 2.2,
    aspectRatio: 10.2,
    maxLd: 17,
    stallSpeedMs: 68,
  },
  {
    name: 'Airbus A320',
    manufacturer: 'Airbus',
    year: 1988,
    type: 'Airliner',
    wingAreaM2: 122.6,
    wingSpanM: 35.8,
    massKg: 68000,
    maxThrustN: 210000,
    maxSpeedMs: 240,
    rangeKm: 5700,
    clMax: 2.1,
    aspectRatio: 10.4,
    maxLd: 17,
    stallSpeedMs: 65,
  },
  {
    name: 'F-16C Fighting Falcon',
    manufacturer: 'General Dynamics / Lockheed Martin',
    year: 1978,
    type: 'Fighter',
    wingAreaM2: 27.87,
    wingSpanM: 9.96,
    massKg: 8570,
    maxThrustN: 130000,
    maxSpeedMs: 650,
    rangeKm: 3200,
    clMax: 1.2,
    aspectRatio: 3.56,
    maxLd: 9,
    stallSpeedMs: 60,
  },
  {
    name: 'Schleicher ASK 21',
    manufacturer: 'Schleicher',
    year: 1979,
    type: 'Glider',
    wingAreaM2: 17.5,
    wingSpanM: 17.0,
    massKg: 514,
    maxThrustN: 0,
    maxSpeedMs: 70,
    rangeKm: 800,
    clMax: 1.55,
    aspectRatio: 16.5,
    maxLd: 34,
    stallSpeedMs: 22,
  },
  {
    name: 'Boeing 747-400',
    manufacturer: 'Boeing',
    year: 1989,
    type: 'Airliner',
    wingAreaM2: 541.2,
    wingSpanM: 64.4,
    massKg: 180000,
    maxThrustN: 900000,
    maxSpeedMs: 290,
    rangeKm: 13450,
    clMax: 2.0,
    aspectRatio: 7.66,
    maxLd: 17,
    stallSpeedMs: 78,
  },
  {
    name: 'P-51D Mustang',
    manufacturer: 'North American Aviation',
    year: 1944,
    type: 'Fighter',
    wingAreaM2: 23.3,
    wingSpanM: 11.3,
    massKg: 3600,
    maxThrustN: 38000,
    maxSpeedMs: 190,
    rangeKm: 2650,
    clMax: 1.4,
    aspectRatio: 5.49,
    maxLd: 14,
    stallSpeedMs: 45,
  },
  {
    name: 'General Atomics MQ-9 Reaper',
    manufacturer: 'General Atomics',
    year: 2001,
    type: 'UAV',
    wingAreaM2: 23.2,
    wingSpanM: 20.0,
    massKg: 4760,
    maxThrustN: 11000,
    maxSpeedMs: 80,
    rangeKm: 1850,
    clMax: 1.6,
    aspectRatio: 17.2,
    maxLd: 25,
    stallSpeedMs: 28,
  },
];

/**
 * Compare a user-designed aircraft against historical data.
 * Returns percentile rankings for key metrics.
 */
export function compareAgainstHistorical(
  userLd: number,
  userStallSpeed: number,
  userWingLoading: number,
): Array<{
  name: string;
  type: string;
  ld: number;
  stallSpeed: number;
  wingLoading: number;
  ldPercentile: number;
}> {
  const sorted = [...HISTORICAL_AIRCRAFT].sort((a, b) => a.maxLd - b.maxLd);
  return HISTORICAL_AIRCRAFT.map(ac => ({
    name: ac.name,
    type: ac.type,
    ld: ac.maxLd,
    stallSpeed: ac.stallSpeedMs,
    wingLoading: (ac.massKg * 9.80665) / ac.wingAreaM2,
    ldPercentile: (sorted.filter(s => s.maxLd <= ac.maxLd).length / sorted.length) * 100,
  }));
}

// ---------------------------------------------------------------------------
// Feature 9 — Mission Profile Builder (Breguet Range)
// ---------------------------------------------------------------------------

export interface MissionSegment {
  name: string;
  /** Segment type */
  type: 'taxi' | 'takeoff' | 'climb' | 'cruise' | 'descent' | 'approach' | 'landing' | 'loiter';
  /** Duration (s) or distance (m) depending on type */
  durationOrDistance: number;
  /** Throttle setting (0-1) */
  throttle: number;
  /** Altitude at start of segment (m) */
  altitudeStartM: number;
  /** Altitude at end of segment (m) */
  altitudeEndM: number;
  /** Fuel flow rate (kg/s) — computed */
  fuelFlowKgs: number;
  /** Fuel burned in segment (kg) */
  fuelBurnKg: number;
}

export interface MissionProfile {
  name: string;
  segments: MissionSegment[];
  totalFuelKg: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  /** Breguet range estimate (km) */
  breguetRangeKm: number;
}

/**
 * Breguet range equation for propeller-driven aircraft:
 *   R = (V/SFC) × (L/D) × ln(W_initial/W_final)
 *
 * For jet aircraft:
 *   R = (V×a/c_t) × (L/D) × ln(W_initial/W_final)
 *
 * Reference: Anderson "Introduction to Flight" Ch. 6.
 */
export function breguetRange(
  velocityMs: number,
  lOverD: number,
  sfc: number,
  initialWeightN: number,
  finalWeightN: number,
  engineType: 'jet' | 'prop' = 'prop',
): number {
  if (finalWeightN <= 0 || initialWeightN <= finalWeightN) return 0;

  if (engineType === 'prop') {
    // R = (V/SFC) × (L/D) × ln(W_i/W_f)  — SFC in 1/s
    return (velocityMs / sfc) * lOverD * Math.log(initialWeightN / finalWeightN);
  } else {
    // R = (V/c_t) × (L/D) × ln(W_i/W_f)  — c_t in 1/s (thrust SFC)
    return (velocityMs / sfc) * lOverD * Math.log(initialWeightN / finalWeightN);
  }
}

// ---------------------------------------------------------------------------
// Feature 10 — Weight Buildup (Raymer Component Weights)
// ---------------------------------------------------------------------------

export interface WeightBuildup {
  /** Wing weight (kg) */
  wingKg: number;
  /** Fuselage weight (kg) */
  fuselageKg: number;
  /** Horizontal tail weight (kg) */
  htailKg: number;
  /** Vertical tail weight (kg) */
  vtailKg: number;
  /** Landing gear weight (kg) */
  landingGearKg: number;
  /** Engine/propulsion weight (kg) */
  propulsionKg: number;
  /** Fixed equipment (avionics, electrical, etc.) */
  fixedEquipmentKg: number;
  /** Empty weight (kg) */
  emptyWeightKg: number;
  /** Maximum fuel weight (kg) */
  maxFuelKg: number;
  /** Payload (kg) */
  payloadKg: number;
  /** Maximum takeoff weight (kg) */
  mtowKg: number;
  /** Empty weight fraction */
  emptyWeightFraction: number;
  /** Weight breakdown for visualization */
  breakdown: Array<{ name: string; weightKg: number; fraction: number }>;
}

/**
 * Raymer statistical weight estimation (Ch. 8).
 * These are simplified regression equations for preliminary design.
 *
 * Reference: Raymer, "Aircraft Design: A Conceptual Approach", Table 8.1
 */
export function raymerWeightBuildup(inputs: {
  /** Wing area (m²) */
  wingAreaM2: number;
  /** Wing span (m) */
  wingSpanM: number;
  /** Design fuel weight (kg) */
  fuelKg: number;
  /** Payload weight (kg) */
  payloadKg: number;
  /** Number of engines */
  nEngines: number;
  /** Engine type */
  engineType: 'piston' | 'turboprop' | 'turbojet' | 'turbofan' | 'electric';
  /** Thrust per engine (N) — for jets */
  thrustPerEngineN: number;
  /** Power per engine (W) — for props */
  powerPerEngineW: number;
  /** Fuselage length (m) */
  fuselageLengthM: number;
  /** Fuselage diameter (m) */
  fuselageDiameterM: number;
  /** Pressurized? */
  pressurized: boolean;
}): WeightBuildup {
  const { wingAreaM2, wingSpanM, fuelKg, payloadKg, nEngines, engineType,
    thrustPerEngineN, powerPerEngineW, fuselageLengthM, fuselageDiameterM, pressurized } = inputs;

  // Initial MTOW estimate (iterative, but one pass is sufficient for preliminary)
  const MTOW_est = 1500 + fuelKg + payloadKg + nEngines * 200;

  // Raymer wing weight (metal, conventional)
  const wingWeight = 0.052 * Math.pow(MTOW_est, 0.884) *
    Math.pow(fuselageLengthM, 0.413) * Math.pow(wingSpanM, 0.266) /
    Math.pow(wingAreaM2, 0.395);

  // Raymer fuselage weight
  const fuselageLengthFt = fuselageLengthM * 3.281;
  const fuselageWeight = 0.0228 * Math.pow(MTOW_est, 0.921) *
    Math.pow(fuselageLengthFt, 0.473) *
    Math.pow(pressurized ? 1 : 0.523, 0.703);

  // Tail weights (simple area-based)
  const htailWeight = wingAreaM2 * 0.04 * 15;  // ~15 kg/m² for tail
  const vtailWeight = wingAreaM2 * 0.03 * 15;

  // Landing gear
  const gearWeight = 0.043 * Math.pow(MTOW_est, 0.768) *
    Math.pow(fuselageLengthM, 0.408);

  // Propulsion weight
  let engineWeight: number;
  if (engineType === 'turbofan' || engineType === 'turbojet') {
    engineWeight = nEngines * (0.17 * thrustPerEngineN / 9.81 + 30);  // Raymer thrust-based
  } else {
    engineWeight = nEngines * (0.006 * powerPerEngineW / 1000 + 40);  // power-based
  }
  const propWeight = engineType === 'piston' || engineType === 'turboprop' || engineType === 'electric'
    ? nEngines * 15 : 0;  // propeller weight
  const propulsionWeight = engineWeight + propWeight;

  // Fixed equipment: ~0.17 × empty weight (Raymer average)
  const emptyWeight = wingWeight + fuselageWeight + htailWeight + vtailWeight +
    gearWeight + propulsionWeight;
  const fixedEquipmentWeight = emptyWeight * 0.17 / (1 - 0.17);  // back out from fraction

  const totalEmpty = emptyWeight + fixedEquipmentWeight;
  const mtow = totalEmpty + fuelKg + payloadKg;
  const emptyFraction = totalEmpty / mtow;

  return {
    wingKg: Math.round(wingWeight),
    fuselageKg: Math.round(fuselageWeight),
    htailKg: Math.round(htailWeight),
    vtailKg: Math.round(vtailWeight),
    landingGearKg: Math.round(gearWeight),
    propulsionKg: Math.round(propulsionWeight),
    fixedEquipmentKg: Math.round(fixedEquipmentWeight),
    emptyWeightKg: Math.round(totalEmpty),
    maxFuelKg: fuelKg,
    payloadKg,
    mtowKg: Math.round(mtow),
    emptyWeightFraction: emptyFraction,
    breakdown: [
      { name: 'Wing', weightKg: Math.round(wingWeight), fraction: wingWeight / mtow },
      { name: 'Fuselage', weightKg: Math.round(fuselageWeight), fraction: fuselageWeight / mtow },
      { name: 'H-Tail', weightKg: Math.round(htailWeight), fraction: htailWeight / mtow },
      { name: 'V-Tail', weightKg: Math.round(vtailWeight), fraction: vtailWeight / mtow },
      { name: 'Landing Gear', weightKg: Math.round(gearWeight), fraction: gearWeight / mtow },
      { name: 'Propulsion', weightKg: Math.round(propulsionWeight), fraction: propulsionWeight / mtow },
      { name: 'Fixed Equipment', weightKg: Math.round(fixedEquipmentWeight), fraction: fixedEquipmentWeight / mtow },
      { name: 'Fuel', weightKg: fuelKg, fraction: fuelKg / mtow },
      { name: 'Payload', weightKg: payloadKg, fraction: payloadKg / mtow },
    ],
  };
}

// ---------------------------------------------------------------------------
// Feature 11 — Normal/Oblique Shock Calculator
// ---------------------------------------------------------------------------

export interface ShockResult {
  /** Upstream Mach number */
  m1: number;
  /** Downstream Mach number */
  m2: number;
  /** Static pressure ratio: p2/p1 */
  pressureRatio: number;
  /** Temperature ratio: T2/T1 */
  temperatureRatio: number;
  /** Density ratio: ρ2/ρ1 */
  densityRatio: number;
  /** Total pressure ratio: p02/p01 */
  totalPressureRatio: number;
  /** Deflection angle (degrees) — for oblique shock */
  deflectionDeg: number;
  /** Wave angle (degrees) — for oblique shock */
  waveAngleDeg: number;
  /** Shock type */
  type: 'normal' | 'oblique' | 'attached' | 'detached';
  /** Whether a solution exists */
  valid: boolean;
}

/**
 * Normal shock relations (Anderson "Modern Compressible Flow" Ch. 8).
 *
 * Given upstream Mach M1, compute all downstream properties.
 * γ = 1.4 for air.
 */
export function normalShockRelations(m1: number): ShockResult {
  if (m1 < 1.0) {
    return {
      m1, m2: m1, pressureRatio: 1, temperatureRatio: 1,
      densityRatio: 1, totalPressureRatio: 1,
      deflectionDeg: 0, waveAngleDeg: 90,
      type: 'normal', valid: false,
    };
  }

  const g = 1.4;
  const g1 = g + 1;
  const gm1 = g - 1;

  const m2sq = (m1 * m1 * gm1 + 2) / (2 * g * m1 * m1 - gm1);
  const m2 = Math.sqrt(m2sq);

  const pr = 1 + (2 * g / g1) * (m1 * m1 - 1);
  const tr = pr * (2 + gm1 * m1 * m1) / (g1 * m1 * m1);
  const dr = g1 * m1 * m1 / (2 + gm1 * m1 * m1);

  // Total pressure ratio (Rayleigh pitot formula)
  const p0ratio = Math.pow(
    ((g1 * m1 * m1) / (2 + gm1 * m1 * m1)) * (g1 / (2 * g * m1 * m1 - gm1)),
    g / gm1,
  );

  return {
    m1,
    m2,
    pressureRatio: pr,
    temperatureRatio: tr,
    densityRatio: dr,
    totalPressureRatio: p0ratio,
    deflectionDeg: 0,
    waveAngleDeg: 90,
    type: 'normal',
    valid: true,
  };
}

/**
 * Oblique shock: θ-β-M relation (Anderson "Modern Compressible Flow" Ch. 9).
 *
 * tan(θ) = 2·cot(β) × (M1²·sin²(β) − 1) / (M1²·(γ + cos(2β)) + 2)
 *
 * Given M1 and deflection θ, iterate to find wave angle β.
 */
export function obliqueShockRelations(m1: number, deflectionDeg: number): ShockResult {
  const g = 1.4;
  const theta = (deflectionDeg * PI) / 180;

  if (m1 < 1.0 || deflectionDeg <= 0) {
    return {
      m1, m2: m1, pressureRatio: 1, temperatureRatio: 1,
      densityRatio: 1, totalPressureRatio: 1,
      deflectionDeg, waveAngleDeg: 0,
      type: 'detached', valid: false,
    };
  }

  // Newton-Raphson to solve θ-β-M for β
  let beta = (deflectionDeg + 5) * PI / 180;  // initial guess
  for (let iter = 0; iter < 50; iter++) {
    const sinB = Math.sin(beta);
    const cosB = Math.cos(beta);
    const m1sqSin2 = m1 * m1 * sinB * sinB;

    const tanTheta = (2 / Math.tan(beta)) * (m1sqSin2 - 1) /
      (m1 * m1 * (g + Math.cos(2 * beta)) + 2);

    const residual = Math.atan(tanTheta) - theta;
    if (Math.abs(residual) < 1e-10) break;

    // d(tanθ)/dβ — numerical derivative
    const dBeta = 1e-8;
    const beta2 = beta + dBeta;
    const sinB2 = Math.sin(beta2);
    const m1sqSin2_2 = m1 * m1 * sinB2 * sinB2;
    const tanTheta2 = (2 / Math.tan(beta2)) * (m1sqSin2_2 - 1) /
      (m1 * m1 * (g + Math.cos(2 * beta2)) + 2);
    const dTanTheta = (Math.atan(tanTheta2) - Math.atan(tanTheta)) / dBeta;

    if (Math.abs(dTanTheta) < 1e-15) break;
    beta -= residual / dTanTheta;
  }

  // Check if solution exists
  const betaDeg = (beta * 180) / PI;
  if (betaDeg <= deflectionDeg || beta <= 0 || beta >= PI / 2) {
    return {
      m1, m2: m1, pressureRatio: 1, temperatureRatio: 1,
      densityRatio: 1, totalPressureRatio: 1,
      deflectionDeg, waveAngleDeg: 0,
      type: 'detached', valid: false,
    };
  }

  // Compute post-shock Mach from normal component
  const m1n = m1 * Math.sin(beta);
  const normalResult = normalShockRelations(m1n);

  // Post-shock Mach (component normal to shock is reduced, tangential unchanged)
  const m2n = normalResult.m2;
  const m2 = m2n / Math.sin(beta - theta);

  return {
    m1,
    m2,
    pressureRatio: normalResult.pressureRatio,
    temperatureRatio: normalResult.temperatureRatio,
    densityRatio: normalResult.densityRatio,
    totalPressureRatio: normalResult.totalPressureRatio,
    deflectionDeg,
    waveAngleDeg: betaDeg,
    type: 'oblique',
    valid: true,
  };
}

// ---------------------------------------------------------------------------
// Feature 12 — Prandtl-Meyer Expansion Fan
// ---------------------------------------------------------------------------

export interface ExpansionFanResult {
  /** Upstream Mach number */
  m1: number;
  /** Downstream Mach number */
  m2: number;
  /** Prandtl-Meyer function ν(M) upstream */
  nu1: number;
  /** Prandtl-Meyer function ν(M) downstream */
  nu2: number;
  /** Total turning angle (degrees) */
  turningDeg: number;
  /** Pressure ratio: p2/p1 */
  pressureRatio: number;
  /** Temperature ratio: T2/T1 */
  temperatureRatio: number;
  /** Density ratio: ρ2/ρ1 */
  densityRatio: number;
  /** Whether the result is physically valid */
  valid: boolean;
}

/**
 * Prandtl-Meyer expansion fan function ν(M):
 *   ν(M) = √(γ+1)/√(γ−1) × arctan(√((γ−1)/(γ+1)×(M²−1))) − arctan(√(M²−1))
 *
 * Reference: Anderson "Modern Compressible Flow" Ch. 9.
 */
export function prandtlMeyerNu(mach: number): number {
  if (mach < 1.0) return 0;
  const g = 1.4;
  const gp1 = g + 1;
  const gm1 = g - 1;
  const m2m1 = mach * mach - 1;
  return Math.sqrt(gp1 / gm1) * Math.atan(Math.sqrt(gm1 / gp1 * m2m1)) -
    Math.atan(Math.sqrt(m2m1));
}

/**
 * Given upstream M1 and turning angle Δν (degrees), compute downstream M2
 * using the Prandtl-Meyer expansion fan relations.
 */
export function prandtlMeyerExpansion(
  m1: number,
  turningDeg: number,
): ExpansionFanResult {
  if (m1 < 1.0 || turningDeg <= 0) {
    return {
      m1, m2: m1, nu1: 0, nu2: 0,
      turningDeg, pressureRatio: 1, temperatureRatio: 1, densityRatio: 1,
      valid: false,
    };
  }

  const nu1 = prandtlMeyerNu(m1);
  const nu2 = nu1 + (turningDeg * PI) / 180;

  // Invert ν(M) = nu2 to find M2 using bisection
  let mLow = 1.0;
  let mHigh = 10.0;
  for (let i = 0; i < 60; i++) {
    const mMid = (mLow + mHigh) / 2;
    if (prandtlMeyerNu(mMid) < nu2) {
      mLow = mMid;
    } else {
      mHigh = mMid;
    }
  }
  const m2 = (mLow + mHigh) / 2;

  // Isentropic relations: p2/p1 = (T2/T1)^(γ/(γ-1))
  const g = 1.4;
  const tRatio = (1 + (g - 1) / 2 * m1 * m1) / (1 + (g - 1) / 2 * m2 * m2);
  const pRatio = Math.pow(tRatio, g / (g - 1));
  const rhoRatio = Math.pow(tRatio, 1 / (g - 1));

  return {
    m1,
    m2,
    nu1: (nu1 * 180) / PI,
    nu2: (nu2 * 180) / PI,
    turningDeg,
    pressureRatio: pRatio,
    temperatureRatio: tRatio,
    densityRatio: rhoRatio,
    valid: true,
  };
}

// ---------------------------------------------------------------------------

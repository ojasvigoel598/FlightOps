// Flight Ops — Mission definition and requirements engine.
//
// Converts a student-defined mission into engineering requirements that
// drive the aircraft design process. Implements the Sadraey-style workflow:
//   mission requirements → design requirements → configuration → sizing.
//
// All quantities are SI unless stated. Angles in degrees at the API boundary.

import { standardAtmosphere, dynamicPressure, reynoldsNumber } from './aerodynamics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissionDefinition {
  /** Descriptive name for the mission */
  name: string;
  /** Required range in km */
  rangeKm: number;
  /** Required endurance in minutes */
  enduranceMin: number;
  /** Cruise speed in m/s */
  cruiseSpeedMs: number;
  /** Maximum speed in m/s (0 = same as cruise) */
  maxSpeedMs: number;
  /** Operating altitude in m */
  altitudeM: number;
  /** Payload mass in kg */
  payloadKg: number;
  /** Number of passengers (0 = cargo-only) */
  passengers: number;
  /** Required climb rate in m/s */
  climbRateMs: number;
  /** Maximum takeoff distance in m (0 = no constraint) */
  takeoffDistanceM: number;
  /** Maximum landing distance in m (0 = no constraint) */
  landingDistanceM: number;
  /** Reserve fuel fraction (e.g. 0.15 = 15% reserve) */
  reserveFraction: number;
  /** Whether VTOL capability is required */
  vtolRequired: boolean;
  /** Hover duration in seconds (0 = not applicable) */
  hoverDurationS: number;
  /** Mission type for categorisation */
  missionType: MissionType;
}

export type MissionType =
  | 'trainer'
  | 'regional-passenger'
  | 'long-range'
  | 'cargo'
  | 'surveillance'
  | 'high-speed'
  | 'agricultural'
  | 'custom';

export interface MissionRequirements {
  /** Total aircraft mass target in kg (derived from payload + fuel + structure estimate) */
  targetMassKg: number;
  /** Required lift coefficient at cruise */
  requiredClCruise: number;
  /** Required lift coefficient at takeoff (with flaps/ground effect estimate) */
  requiredClTakeoff: number;
  /** Minimum wing area in m² to meet takeoff distance constraint */
  minWingAreaTakeoffM2: number;
  /** Required L/D at cruise */
  requiredLdCruise: number;
  /** Required thrust-to-weight ratio */
  requiredTwr: number;
  /** Estimated fuel mass in kg */
  fuelMassKg: number;
  /** Wing loading target in N/m² */
  wingLoadingTarget: number;
  /** Power loading target in W/N */
  powerLoadingTarget: number;
  /** Minimum aspect ratio for induced drag constraint */
  minAspectRatio: number;
  /** Cruise Reynolds number (for airfoil selection guidance) */
  cruiseReynolds: number;
  /** Warnings about the mission being difficult or impossible */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Preset missions
// ---------------------------------------------------------------------------

export const PRESET_MISSIONS: Record<MissionType, MissionDefinition> = {
  trainer: {
    name: 'Flight Trainer',
    rangeKm: 200,
    enduranceMin: 60,
    cruiseSpeedMs: 55,
    maxSpeedMs: 70,
    altitudeM: 1500,
    payloadKg: 100,
    passengers: 1,
    climbRateMs: 3,
    takeoffDistanceM: 300,
    landingDistanceM: 250,
    reserveFraction: 0.15,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'trainer',
  },
  'regional-passenger': {
    name: 'Regional Passenger',
    rangeKm: 800,
    enduranceMin: 120,
    cruiseSpeedMs: 120,
    maxSpeedMs: 160,
    altitudeM: 6000,
    payloadKg: 2000,
    passengers: 19,
    climbRateMs: 5,
    takeoffDistanceM: 1200,
    landingDistanceM: 900,
    reserveFraction: 0.15,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'regional-passenger',
  },
  'long-range': {
    name: 'Long Range',
    rangeKm: 3000,
    enduranceMin: 300,
    cruiseSpeedMs: 200,
    maxSpeedMs: 260,
    altitudeM: 10000,
    payloadKg: 500,
    passengers: 0,
    climbRateMs: 8,
    takeoffDistanceM: 2000,
    landingDistanceM: 1500,
    reserveFraction: 0.20,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'long-range',
  },
  cargo: {
    name: 'Cargo Hauler',
    rangeKm: 500,
    enduranceMin: 90,
    cruiseSpeedMs: 90,
    maxSpeedMs: 120,
    altitudeM: 3000,
    payloadKg: 5000,
    passengers: 0,
    climbRateMs: 4,
    takeoffDistanceM: 800,
    landingDistanceM: 700,
    reserveFraction: 0.10,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'cargo',
  },
  surveillance: {
    name: 'Surveillance UAV',
    rangeKm: 1500,
    enduranceMin: 480,
    cruiseSpeedMs: 60,
    maxSpeedMs: 80,
    altitudeM: 4000,
    payloadKg: 30,
    passengers: 0,
    climbRateMs: 2,
    takeoffDistanceM: 200,
    landingDistanceM: 200,
    reserveFraction: 0.20,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'surveillance',
  },
  'high-speed': {
    name: 'High Speed',
    rangeKm: 600,
    enduranceMin: 60,
    cruiseSpeedMs: 250,
    maxSpeedMs: 350,
    altitudeM: 8000,
    payloadKg: 200,
    passengers: 1,
    climbRateMs: 15,
    takeoffDistanceM: 1500,
    landingDistanceM: 1200,
    reserveFraction: 0.15,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'high-speed',
  },
  agricultural: {
    name: 'Agricultural',
    rangeKm: 50,
    enduranceMin: 30,
    cruiseSpeedMs: 40,
    maxSpeedMs: 60,
    altitudeM: 100,
    payloadKg: 800,
    passengers: 0,
    climbRateMs: 2,
    takeoffDistanceM: 250,
    landingDistanceM: 250,
    reserveFraction: 0.10,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'agricultural',
  },
  custom: {
    name: 'Custom Mission',
    rangeKm: 500,
    enduranceMin: 90,
    cruiseSpeedMs: 80,
    maxSpeedMs: 100,
    altitudeM: 3000,
    payloadKg: 200,
    passengers: 2,
    climbRateMs: 3,
    takeoffDistanceM: 500,
    landingDistanceM: 400,
    reserveFraction: 0.15,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType: 'custom',
  },
};

// ---------------------------------------------------------------------------
// Engineering requirements computation
// ---------------------------------------------------------------------------

/**
 * Convert a mission definition into engineering design requirements.
 * Uses a Breguet-range-based fuel fraction, simplified weight build-up,
 * and aerodynamic constraints from the mission profile.
 *
 * Reference: Sadraey, Aircraft Design: A Systems Engineering Approach,
 * ch. 4-6 (mission analysis, sizing, weight estimation).
 */
export function computeMissionRequirements(mission: MissionDefinition): MissionRequirements {
  const atm = standardAtmosphere(mission.altitudeM);
  const qCruise = dynamicPressure(mission.cruiseSpeedMs, atm.densityKgM3);
  const reCruise = reynoldsNumber(
    mission.cruiseSpeedMs,
    1.5, // reference chord ~1.5 m (typical for the class of aircraft)
    atm.densityKgM3,
    atm.viscosityPaS,
  );

  const warnings: string[] = [];

  // --- Fuel fraction (Breguet range equation, simplified) ---
  // We assume L/D ≈ 10 initially and iterate once.
  const ldInitial = 10;
  const tsfcPerS = 0.6 / 3600; // typical turboprop TSFC in 1/s
  const rangeM = mission.rangeKm * 1000;
  const enduranceS = mission.enduranceMin * 60;
  const cruiseSpeedMs = mission.cruiseSpeedMs;

  // Breguel range: W_fuel/W_total = 1 - exp(-R * g * TSFC / (V * L/D))
  const exponent = -(rangeM * 9.80665 * tsfcPerS) / (cruiseSpeedMs * ldInitial);
  const fuelFraction = 1 - Math.exp(exponent);
  const fuelFractionWithReserve = fuelFraction + mission.reserveFraction;

  if (fuelFractionWithReserve >= 0.6) {
    warnings.push(
      'Fuel fraction exceeds 60% of takeoff weight — mission may be too demanding for a conventional design.',
    );
  }

  // --- Weight build-up (simplified) ---
  // Structural fraction ≈ 0.45-0.55 of MTOW for conventional aircraft
  const structuralFraction = 0.50;
  const payloadFraction = mission.payloadKg > 0 ? 0 : 0; // computed from actual payload

  // MTOW estimate: payload / (1 - fuelFraction - structuralFraction)
  const availableFraction = 1 - fuelFractionWithReserve - structuralFraction;
  const mtowEstimate =
    availableFraction > 0.1
      ? mission.payloadKg / availableFraction
      : mission.payloadKg * 3; // fallback for extreme missions

  const fuelMassKg = mtowEstimate * fuelFractionWithReserve;
  const targetMassKg = mtowEstimate;

  // --- Aerodynamic requirements ---
  // Required CL at cruise: W = q * S * CL => CL = W / (q * S)
  // We estimate S from wing loading target
  const wingLoadingEstimate = 2500; // N/m², typical GA/military
  const wingAreaEstimate = (targetMassKg * 9.80665) / wingLoadingEstimate;
  const requiredClCruise = (targetMassKg * 9.80665) / (qCruise * wingAreaEstimate);

  // Required CL at takeoff (lower speed, higher CL needed)
  const vTakeoff = Math.sqrt((2 * targetMassKg * 9.80665) / (atm.densityKgM3 * wingAreaEstimate * 2.0));
  const qTakeoff = dynamicPressure(vTakeoff, atm.densityKgM3);
  const requiredClTakeoff = (targetMassKg * 9.80665) / (qTakeoff * wingAreaEstimate);

  // Required L/D at cruise from Breguet
  const requiredLdCruise = ldInitial;

  // Required T/W for climb
  const weightN = targetMassKg * 9.80665;
  const climbDragN = weightN / ldInitial; // level-flight drag ≈ climb drag
  const climbThrustN = climbDragN + targetMassKg * mission.climbRateMs; // excess for climb
  const requiredTwr = climbThrustN / weightN;

  // Takeoff distance constraint → minimum wing area
  // Simplified: d = V² / (2*a), a = (T/W - mu) * g, with mu ≈ 0.03
  if (mission.takeoffDistanceM > 0) {
    const mu = 0.03; // rolling friction
    const accelNeeded = (vTakeoff * vTakeoff) / (2 * mission.takeoffDistanceM);
    const minTwrForTakeoff = (accelNeeded / 9.80665 + mu) / (1 - accelNeeded / (9.80665 * ldInitial));
    if (minTwrForTakeoff > requiredTwr) {
      warnings.push(
        `Takeoff distance requires T/W >= ${minTwrForTakeoff.toFixed(2)}, but climb only needs ${requiredTwr.toFixed(2)}. Increase wing area or thrust.`,
      );
    }
  }

  // Minimum aspect ratio from induced drag constraint
  const oswaldE = 0.85;
  const minAspectRatio = 1 / (Math.PI * oswaldE * 0.006); // k = cd0_induced = 0.006 target

  // Power loading
  const cruisePowerW = (targetMassKg * 9.80665 * cruiseSpeedMs) / ldInitial;
  const powerLoadingTarget = cruisePowerW / weightN;

  return {
    targetMassKg,
    requiredClCruise,
    requiredClTakeoff,
    minWingAreaTakeoffM2: wingAreaEstimate * 0.8,
    requiredLdCruise,
    requiredTwr,
    fuelMassKg,
    wingLoadingTarget: wingLoadingEstimate,
    powerLoadingTarget,
    minAspectRatio,
    cruiseReynolds: reCruise,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Mission scoring
// ---------------------------------------------------------------------------

export interface MissionScore {
  /** Overall score 0-100 */
  overall: number;
  /** Fuel margin: positive = excess range */
  fuelMarginPct: number;
  /** Weight margin: positive = under MTOW */
  weightMarginPct: number;
  /** Whether the mission is feasible with the given stats */
  feasible: boolean;
  /** Descriptive label */
  label: string;
  /** Per-category scores */
  categories: { name: string; score: number; max: number }[];
}

/**
 * Score how well a set of vehicle stats meets the mission requirements.
 */
export function scoreMission(
  requirements: MissionRequirements,
  stats: {
    rangeKm: number;
    weightKg: number;
    aeroEfficiency: number;
    safety: number;
    reliability: number;
    feasible: boolean;
  },
): MissionScore {
  const fuelMargin = ((stats.rangeKm - requirements.targetMassKg * 0.5) / requirements.targetMassKg) * 100;
  const weightMargin = ((requirements.targetMassKg - stats.weightKg) / requirements.targetMassKg) * 100;
  const feasible = stats.feasible && weightMargin > -10;

  const categories = [
    { name: 'Range', score: Math.min(100, (stats.rangeKm / (requirements.targetMassKg * 0.5)) * 100), max: 100 },
    { name: 'Weight', score: Math.max(0, Math.min(100, 50 + weightMargin)), max: 100 },
    { name: 'Aero', score: stats.aeroEfficiency, max: 100 },
    { name: 'Safety', score: stats.safety, max: 100 },
    { name: 'Reliability', score: stats.reliability, max: 100 },
  ];

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  );

  const label =
    overall >= 85 ? 'Excellent' :
    overall >= 70 ? 'Good' :
    overall >= 55 ? 'Fair' :
    overall >= 40 ? 'Marginal' :
    'Poor';

  return {
    overall,
    fuelMarginPct: fuelMargin,
    weightMarginPct: weightMargin,
    feasible,
    label,
    categories,
  };
}

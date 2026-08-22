// Fun-Mode Flight Physics — state-driven simulation.
//
// Replaces the old scripted flightProgress curve with a real
// simulation where joystick controls → flight dynamics → aircraft state → world position.
//
// The model is simplified but internally consistent:
//   throttle → thrust → airspeed → fuel burn
//   pitch → vertical acceleration → altitude
//   yaw → heading change
//   drag depends on gear, flaps, speed

import { clamp } from '@/utils/math';

// ---------------------------------------------------------------------------
// Flight state
// ---------------------------------------------------------------------------

export interface FunFlightState {
  // Position (metres)
  xM: number;
  altitudeM: number;
  zM: number;
  // Velocity
  airspeedMs: number;
  heading: number; // degrees (0 = north / -Z)
  vsiMs: number;   // vertical speed m/s
  // Attitude
  pitch: number;   // radians
  roll: number;    // radians
  // Systems
  throttle: number; // 0-1
  engineRunning: boolean;
  engineFailed: boolean;
  failedEngine: number; // 0 = none, 1/2
  gearDown: boolean;
  flapDeg: number;
  brakeOn: boolean;
  // Mass
  massKg: number;
  fuelKg: number;
  // Environment
  windMs: number;
  windDirDeg: number;
  densityKgM3: number;
  // Simulation
  totalTime: number;
  distanceFlown: number;
  flightProgress: number; // 0-1 mission metric
  integrity: number; // 0-100
  icingLevel: number; // 0-1
  // Paused
  paused: boolean;
}

// ---------------------------------------------------------------------------
// Wing config from player choice
// ---------------------------------------------------------------------------

interface WingParams {
  spanM: number;
  areaM2: number;
  clMax: number;
  cd0: number;
  oswaldE: number;
}

const WING_MAP: Record<string, WingParams> = {
  short:  { spanM: 8,  areaM2: 12, clMax: 1.4, cd0: 0.022, oswaldE: 0.75 },
  medium: { spanM: 10, areaM2: 16, clMax: 1.6, cd0: 0.025, oswaldE: 0.80 },
  long:   { spanM: 14, areaM2: 18, clMax: 1.8, cd0: 0.027, oswaldE: 0.85 },
  wide:   { spanM: 12, areaM2: 24, clMax: 1.7, cd0: 0.030, oswaldE: 0.78 },
};

// ---------------------------------------------------------------------------
// Engine config
// ---------------------------------------------------------------------------

interface EngineParams {
  maxThrustN: number;
  fuelBurnRate: number; // kg per N per second
}

const ENGINE_MAP: Record<string, EngineParams> = {
  piston:    { maxThrustN: 3000, fuelBurnRate: 0.00018 },
  turboprop: { maxThrustN: 6000, fuelBurnRate: 0.00012 },
  turbofan:  { maxThrustN: 12000, fuelBurnRate: 0.00008 },
  electric:  { maxThrustN: 4000, fuelBurnRate: 0 },
};

// ---------------------------------------------------------------------------
// Create initial state
// ---------------------------------------------------------------------------

export function createFunFlightState(opts: {
  wingId: string;
  propId: string;
  engineCount: number;
  windMs: number;
  windDirDeg: number;
  payloadKg: number;
}): FunFlightState {
  const wing = WING_MAP[opts.wingId] ?? WING_MAP.medium;
  const massKg = 1200 + opts.payloadKg + (opts.engineCount * 200);
  return {
    xM: 0, altitudeM: 0, zM: 0,
    airspeedMs: 0, heading: 180, vsiMs: 0,
    pitch: 0, roll: 0,
    throttle: 0, engineRunning: false, engineFailed: false, failedEngine: 0,
    gearDown: true, flapDeg: 0, brakeOn: true,
    massKg, fuelKg: 300,
    windMs: opts.windMs, windDirDeg: opts.windDirDeg,
    densityKgM3: 1.225,
    totalTime: 0, distanceFlown: 0, flightProgress: 0,
    integrity: 100, icingLevel: 0,
    paused: false,
  };
}

// ---------------------------------------------------------------------------
// Get wing/engine params for a configuration
// ---------------------------------------------------------------------------

export function getWingParams(wingId: string): WingParams {
  return WING_MAP[wingId] ?? WING_MAP.medium;
}

export function getEngineParams(propId: string): EngineParams {
  return ENGINE_MAP[propId] ?? ENGINE_MAP.turboprop;
}

// ---------------------------------------------------------------------------
// Step the simulation
// ---------------------------------------------------------------------------

export interface FunFlightInput {
  throttle: number;    // 0-1
  pitchInput: number;  // -1 to 1
  yawInput: number;    // -1 to 1
  gearDown: boolean;
  flapDeg: number;
  brake: boolean;
}

export interface EventEffects {
  dragMultiplier: number;
  liftMultiplier: number;
  thrustMultiplier: number;
  integrityDamage: number;
}

export function stepFunFlight(
  state: FunFlightState,
  input: FunFlightInput,
  wingId: string,
  propId: string,
  engineCount: number,
  dt: number,
  eventEffects: EventEffects | null,
): FunFlightState {
  if (state.paused) return state;
  if (state.flightProgress >= 1) return state;

  const s = { ...state };
  s.totalTime += dt;

  const wing = WING_MAP[wingId] ?? WING_MAP.medium;
  const engine = ENGINE_MAP[propId] ?? ENGINE_MAP.turboprop;
  const AR = (wing.spanM * wing.spanM) / wing.areaM2;

  // --- Engine ---
  s.throttle = clamp(input.throttle, 0, 1);

  if (!s.engineRunning && s.throttle > 0.05 && !s.brakeOn) {
    s.engineRunning = true;
  }

  let thrustN = 0;
  if (s.engineRunning && !s.engineFailed) {
    thrustN = engine.maxThrustN * s.throttle * engineCount;
  } else if (s.engineFailed) {
    // Failed engine produces 0; running engine at half capacity
    thrustN = engine.maxThrustN * s.throttle * Math.max(0, engineCount - 1) * 0.5;
  }

  // Altitude effect on thrust (thinner air = less thrust)
  const altFactor = Math.max(0.4, 1 - s.altitudeM / 12000);
  thrustN *= altFactor;

  // Event effects
  const evtDrag = eventEffects?.dragMultiplier ?? 1;
  const evtLift = eventEffects?.liftMultiplier ?? 1;
  const evtThrust = eventEffects?.thrustMultiplier ?? 1;
  thrustN *= evtThrust;

  // Icing drag penalty
  const icingDrag = 1 + s.icingLevel * 0.4;

  // --- Airspeed ---
  // Density from altitude (ISA)
  s.densityKgM3 = 1.225 * Math.exp(-s.altitudeM / 8500);

  // Dynamic pressure
  const q = 0.5 * s.densityKgM3 * s.airspeedMs * s.airspeedMs;

  // Lift coefficient (simplified: Cl = Cl_alpha * AoA, limited by Cl_max)
  const aoaDeg = s.pitch * (180 / Math.PI) * 5; // simplified pitch → AoA
  const clAlpha = 2 * Math.PI;
  let cl = clAlpha * (aoaDeg * Math.PI / 180);
  cl = clamp(cl, -wing.clMax * 1.2, wing.clMax * evtLift);

  // Flap bonus
  const flapClBonus = (s.flapDeg / 30) * 0.6;
  cl += flapClBonus;

  // Drag
  const cdInduced = (cl * cl) / (Math.PI * AR * wing.oswaldE);
  const gearDrag = s.gearDown ? 0.015 : 0;
  const flapDrag = (s.flapDeg / 30) * 0.018;
  const brakeDrag = s.brakeOn && s.altitudeM < 2 ? 0.05 : 0;
  const cd = wing.cd0 + cdInduced + gearDrag + flapDrag + brakeDrag;
  const dragN = q * wing.areaM2 * cd * evtDrag * icingDrag;

  // Net forward force
  const netForward = thrustN - dragN;
  const accel = netForward / s.massKg;
  s.airspeedMs = Math.max(0, s.airspeedMs + accel * dt);

  // --- Attitude (from joystick input) ---
  const targetPitch = input.pitchInput * 0.25; // ±0.25 rad max pitch
  s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 3);
  s.pitch = clamp(s.pitch, -0.4, 0.4);

  // Roll from yaw input (simplified coupling)
  const targetRoll = -input.yawInput * 0.3;
  s.roll += (targetRoll - s.roll) * Math.min(1, dt * 4);
  s.roll *= (1 - dt * 2); // roll damping

  // --- Vertical motion ---
  const liftN = q * wing.areaM2 * cl;
  const weightN = s.massKg * 9.81;
  const netVertical = liftN - weightN;
  const vertAccel = netVertical / s.massKg;

  s.vsiMs += vertAccel * dt;
  s.vsiMs *= (1 - dt * 0.5); // damping
  s.altitudeM += s.vsiMs * dt;

  // Ground check
  if (s.altitudeM <= 0) {
    s.altitudeM = 0;
    if (s.vsiMs < -5) {
      // Hard landing — damage
      s.integrity = Math.max(0, s.integrity + s.vsiMs * 2);
    }
    s.vsiMs = Math.max(0, s.vsiMs);
    if (s.gearDown || s.altitudeM === 0) {
      s.airspeedMs = Math.max(0, s.airspeedMs - 3 * dt);
    }
  }

  // --- Heading (from yaw input) ---
  s.heading += input.yawInput * 30 * dt;
  s.heading = ((s.heading % 360) + 360) % 360;

  // --- Position ---
  const headingRad = (s.heading * Math.PI) / 180;
  s.xM += s.airspeedMs * Math.sin(headingRad) * dt;
  s.zM -= s.airspeedMs * Math.cos(headingRad) * dt;

  // Wind effect on position
  const windRad = (s.windDirDeg * Math.PI) / 180;
  s.xM += s.windMs * Math.sin(windRad) * dt * 0.3;
  s.zM -= s.windMs * Math.cos(windRad) * dt * 0.3;

  // --- Fuel ---
  if (s.engineRunning && s.fuelKg > 0) {
    const burnRate = engine.fuelBurnRate * thrustN;
    s.fuelKg = Math.max(0, s.fuelKg - burnRate * dt * 60);
    if (s.fuelKg <= 0) {
      s.engineRunning = false;
      s.engineFailed = true;
    }
  }

  // --- Distance & Progress ---
  const distInc = s.airspeedMs * dt;
  s.distanceFlown += distInc;
  // Progress based on distance (target = 100km for a typical mission)
  const targetDist = 100000; // 100 km
  s.flightProgress = clamp(s.distanceFlown / targetDist, 0, 1);

  // --- Event damage ---
  if (eventEffects && eventEffects.integrityDamage > 0) {
    s.integrity = Math.max(0, s.integrity - eventEffects.integrityDamage * dt);
  }

  // --- Icing accumulation ---
  if (s.icingLevel > 0) {
    // Slowly recover when not icing
    s.icingLevel = Math.max(0, s.icingLevel - 0.01 * dt);
  }

  return s;
}

// ---------------------------------------------------------------------------
// Get derived values for rendering
// ---------------------------------------------------------------------------

export function getFlightRenderState(s: FunFlightState): {
  position: [number, number, number];
  pitch: number;
  bank: number;
  flightSpeed: number;
  isHighAlt: boolean;
} {
  // Scale positions for3D scene (1 unit = 1m, but scene is scaled)
  const scale = 0.05; // 1m = 0.05 scene units
  const xPos = s.xM * scale;
  const yPos = Math.max(1.2, s.altitudeM * scale + 1.2);
  const zPos = -s.zM * scale;

  return {
    position: [xPos, yPos, zPos],
    pitch: s.pitch,
    bank: s.roll,
    flightSpeed: clamp(s.airspeedMs / 100, 0, 1), // normalized 0-1
    isHighAlt: s.altitudeM > 3000,
  };
}

// 3-DOF flight dynamics model for Model B.
//
// Progressive complexity:
//   Level 1 — static (forces, moments, trim)
//   Level 2 — 1D kinematic (speed, altitude, distance)
//   Level 3 — 3-DOF longitudinal (forward, vertical, pitch)
//   Level 4 — 6-DOF (roll, pitch, yaw, all axes) — stub for future
//
// All quantities SI. Time-stepping is fixed dt for determinism.

import { standardAtm } from '../aerodynamics';

// ---------------------------------------------------------------------------
// Aircraft state
// ---------------------------------------------------------------------------

export interface FlightState {
  /** Position (m) in Earth frame */
  xM: number;
  yM: number; // altitude
  zM: number;
  /** Velocity components (m/s) in Earth frame */
  vxMs: number;
  vyMs: number;
  vzMs: number;
  /** Euler angles (rad) */
  pitchRad: number;
  rollRad: number;
  yawRad: number;
  /** Angle of attack (rad) */
  alphaRad: number;
  /** Side-slip angle (rad) */
  betaRad: number;
  /** Airspeed (m/s) */
  airspeedMs: number;
  /** Mach number */
  mach: number;
  /** Dynamic pressure (Pa) */
  qPa: number;
  /** Fuel remaining (kg) */
  fuelKg: number;
  /** Time elapsed (s) */
  timeS: number;
}

// ---------------------------------------------------------------------------
// Aircraft parameters for dynamics
// ---------------------------------------------------------------------------

export interface DynamicsParams {
  massKg: number;
  wingAreaM2: number;
  /** Lift curve slope (1/rad) — thin-airfoil ≈ 2π */
  clAlpha: number;
  /** Zero-lift drag coefficient */
  cd0: number;
  /** Oswald efficiency */
  oswaldE: number;
  /** Aspect ratio */
  aspectRatio: number;
  /** Maximum lift coefficient */
  clMax: number;
  /** Max thrust (N) */
  maxThrustN: number;
  /** Specific fuel consumption (kg/(N*s) for jets, kg/(W*s) for props) */
  sfc: number;
  /** Engine type — determines how thrust scales with altitude/speed */
  engineType: 'jet' | 'prop';
  /** Moment of inertia about pitch axis (kg*m^2) */
  iPitchKgM2: number;
  /** Pitch damping (Nm per rad/s) */
  pitchDamping: number;
  /** Neutral point position from nose (m) */
  neutralPointM: number;
  /** CG position from nose (m) */
  cgPositionM: number;
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

export function createInitialState(altitudeM = 0, airspeedMs = 0, fuelKg = 100): FlightState {
  return {
    xM: 0,
    yM: altitudeM,
    zM: 0,
    vxMs: airspeedMs,
    vyMs: 0,
    vzMs: 0,
    pitchRad: 0,
    rollRad: 0,
    yawRad: 0,
    alphaRad: 0,
    betaRad: 0,
    airspeedMs,
    mach: 0,
    qPa: 0,
    fuelKg,
    timeS: 0,
  };
}

// ---------------------------------------------------------------------------
// Atmosphere helpers
// ---------------------------------------------------------------------------

function airDensity(altM: number): number {
  const atm = standardAtm(altM);
  return atm.densityKgM3;
}

function speedOfSound(altM: number): number {
  const atm = standardAtm(altM);
  return atm.speedOfSoundMs;
}

// ---------------------------------------------------------------------------
// Aerodynamic coefficients from alpha
// ---------------------------------------------------------------------------

function clFromAlpha(alphaDeg: number, p: DynamicsParams): number {
  // Linear region, then stall
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const clLinear = p.clAlpha * alphaRad;
  const clStall = p.clMax;
  if (clLinear > clStall) return clStall;
  if (clLinear < -clStall) return -clStall;
  return clLinear;
}

function cdFromCL(cl: number, p: DynamicsParams): number {
  const k = 1 / (Math.PI * p.oswaldE * p.aspectRatio);
  return p.cd0 + k * cl * cl;
}

function cmFromAlpha(alphaDeg: number, p: DynamicsParams): number {
  // Static margin: Cm_alpha = -SM * cl_alpha
  const sm = (p.neutralPointM - p.cgPositionM) / (p.wingAreaM2 / p.aspectRatio);
  const clAlphaRad = p.clAlpha;
  const alphaRad = (alphaDeg * Math.PI) / 180;
  return -sm * clAlphaRad * alphaRad + 0.02; // slight nose-up at zero alpha
}

// ---------------------------------------------------------------------------
// Thrust model
// ---------------------------------------------------------------------------

function thrustAvailable(
  altM: number,
  airspeedMs: number,
  throttle: number,
  p: DynamicsParams,
): number {
  const rho = airDensity(altM);
  const rho0 = 1.225;

  if (p.engineType === 'jet') {
    // Jet: thrust ∝ ρ/ρ₀ (simplified)
    return p.maxThrustN * throttle * (rho / rho0);
  } else {
    // Propeller: thrust ∝ ρ/ρ₀ * η_prop (speed-dependent efficiency)
    const etaProp = Math.max(0.3, 0.85 - 0.0003 * airspeedMs * airspeedMs);
    return p.maxThrustN * throttle * (rho / rho0) * etaProp;
  }
}

// ---------------------------------------------------------------------------
// Core simulation step (3-DOF longitudinal)
// ---------------------------------------------------------------------------

export interface SimInputs {
  throttle: number;   // 0-1
  elevatorDeg: number; // -25 to +25 (positive = nose up)
  dt: number;          // time step in seconds
}

export interface StepResult {
  state: FlightState;
  /** Aerodynamic forces for visualization */
  forces: {
    liftN: number;
    dragN: number;
    thrustN: number;
    weightN: number;
  };
  /** Whether aircraft is on the ground */
  onGround: boolean;
  /** Whether aircraft has stalled */
  stalled: boolean;
}

const GRAVITY = 9.80665;

export function stepFlightDynamics(
  state: FlightState,
  params: DynamicsParams,
  inputs: SimInputs,
): StepResult {
  const { dt, throttle, elevatorDeg } = inputs;
  const s = { ...state };

  // Air density and speed of sound
  const rho = airDensity(s.yM);
  const aSound = speedOfSound(s.yM);
  const rho0 = 1.225;

  // Update airspeed
  s.airspeedMs = Math.sqrt(s.vxMs * s.vxMs + s.vyMs * s.vyMs);
  s.mach = aSound > 0 ? s.airspeedMs / aSound : 0;

  // Dynamic pressure
  s.qPa = 0.5 * rho * s.airspeedMs * s.airspeedMs;

  // Flight path angle
  const gammaRad = s.airspeedMs > 0.1
    ? Math.atan2(s.vyMs, s.vxMs)
    : 0;

  // Angle of attack: pitch minus flight path
  s.alphaRad = s.pitchRad - gammaRad;
  const alphaDeg = (s.alphaRad * 180) / Math.PI;

  // Aerodynamic coefficients
  const cl = clFromAlpha(alphaDeg, params);
  const cd = cdFromCL(cl, params);
  const cm = cmFromAlpha(alphaDeg, params);

  // Forces
  const liftN = s.qPa * params.wingAreaM2 * cl;
  const dragN = s.qPa * params.wingAreaM2 * cd;
  const thrustN = thrustAvailable(s.yM, s.airspeedMs, throttle, params);
  const weightN = params.massKg * GRAVITY;

  // Transform forces to Earth frame
  const cosGamma = Math.cos(gammaRad);
  const sinGamma = Math.sin(gammaRad);

  // Net force along flight path
  const forceAlongPath = thrustN * Math.cos(s.alphaRad) - dragN - weightN * Math.sin(gammaRad);
  // Net force perpendicular to flight path
  const forcePerpPath = liftN + thrustN * Math.sin(s.alphaRad) - weightN * Math.cos(gammaRad);

  // Acceleration along flight path
  const aAlongPath = forceAlongPath / params.massKg;
  // Acceleration perpendicular (centripetal for now, will simplify)
  const aPerpPath = forcePerpPath / params.massKg;

  // Update velocity in Earth frame
  s.vxMs += (aAlongPath * cosGamma - aPerpPath * sinGamma) * dt;
  s.vyMs += (aAlongPath * sinGamma + aPerpPath * cosGamma) * dt;

  // Update position
  s.xM += s.vxMs * dt;
  s.yM += s.vyMs * dt;

  // Ground constraint
  const onGround = s.yM <= 0.5 && s.vyMs <= 0;
  if (onGround) {
    s.yM = 0.5;
    if (s.vyMs < 0) s.vyMs = 0;
    // Ground friction
    s.vxMs *= 0.999;
  }

  // Pitch dynamics: elevator → pitching moment → angular acceleration
  const elevatorEffect = elevatorDeg * 0.003; // simplified control power
  const pitchAccel = (cm + elevatorEffect - params.pitchDamping * (s.pitchRad / dt)) / params.iPitchKgM2;
  s.pitchRad += pitchAccel * dt * dt;

  // Clamp pitch to reasonable range
  s.pitchRad = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, s.pitchRad));

  // On ground: prevent nose diving
  if (onGround) {
    s.pitchRad = Math.max(-0.05, Math.min(0.15, s.pitchRad));
  }

  // Fuel consumption
  const fuelBurnRate = params.engineType === 'jet'
    ? params.sfc * thrustN * throttle
    : params.sfc * (thrustN / 0.82) * throttle; // brake power
  s.fuelKg = Math.max(0, s.fuelKg - fuelBurnRate * dt);

  // Time
  s.timeS += dt;

  // Stall detection
  const stalled = Math.abs(alphaDeg) > 15 && s.airspeedMs > 10;

  return {
    state: s,
    forces: { liftN, dragN, thrustN, weightN },
    onGround,
    stalled,
  };
}

// ---------------------------------------------------------------------------
// 1D kinematic model (Level 1 — simplest)
// ---------------------------------------------------------------------------

export function stepKinematic(
  state: FlightState,
  params: DynamicsParams,
  inputs: SimInputs,
): StepResult {
  // Simplified: constant altitude, compute speed from thrust - drag
  const rho = airDensity(state.yM);
  state.qPa = 0.5 * rho * state.airspeedMs * state.airspeedMs;

  const cl = 0.4; // trimmed cruise
  const cd = params.cd0 + cl * cl / (Math.PI * params.oswaldE * params.aspectRatio);
  const dragN = state.qPa * params.wingAreaM2 * cd;
  const thrustN = thrustAvailable(state.yM, state.airspeedMs, inputs.throttle, params);

  const accel = (thrustN - dragN) / params.massKg;
  state.vxMs = Math.max(0, state.vxMs + accel * inputs.dt);
  state.airspeedMs = state.vxMs;
  state.xM += state.vxMs * inputs.dt;

  // Fuel
  const fuelBurn = params.sfc * thrustN * inputs.dt;
  state.fuelKg = Math.max(0, state.fuelKg - fuelBurn);
  state.timeS += inputs.dt;

  return {
    state,
    forces: { liftN: params.massKg * GRAVITY, dragN, thrustN, weightN: params.massKg * GRAVITY },
    onGround: state.yM <= 0.5,
    stalled: false,
  };
}

// ---------------------------------------------------------------------------
// Trim computation — find AoA for L = W
// ---------------------------------------------------------------------------

export function findTrimAlpha(params: DynamicsParams, airspeedMs: number, altM: number): number {
  const rho = airDensity(altM);
  const q = 0.5 * rho * airspeedMs * airspeedMs;
  if (q < 1) return 0;
  const clRequired = (params.massKg * GRAVITY) / (q * params.wingAreaM2);
  const alphaRad = clRequired / params.clAlpha;
  return (alphaRad * 180) / Math.PI;
}

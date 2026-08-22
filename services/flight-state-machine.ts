// Flight State Machine — 20-phase simulation engine.
//
// Models the complete flight from pre-flight to shutdown.
// Each phase defines expected altitude, airspeed, throttle, gear, flaps,
// camera, warnings, control behaviour, and transition conditions.
//
// Reference: Sadraey Ch.3 (Conceptual Design) + flight dynamics principles.

// ---------------------------------------------------------------------------
// Phase enum
// ---------------------------------------------------------------------------

export type FlightPhase =
  | 'PREFLIGHT'
  | 'ENGINE_START'
  | 'TAXI'
  | 'TAKEOFF_ROLL'
  | 'ROTATION'
  | 'LIFTOFF'
  | 'INITIAL_CLIMB'
  | 'CLIMB'
  | 'CRUISE_CLIMB'
  | 'CRUISE'
  | 'FAILURE'
  | 'DESCENT'
  | 'APPROACH'
  | 'GEAR_DOWN'
  | 'FINAL'
  | 'FLARE'
  | 'TOUCHDOWN'
  | 'ROLLOUT'
  | 'TAXI_IN'
  | 'SHUTDOWN';

export const ALL_PHASES: FlightPhase[] = [
  'PREFLIGHT', 'ENGINE_START', 'TAXI', 'TAKEOFF_ROLL', 'ROTATION',
  'LIFTOFF', 'INITIAL_CLIMB', 'CLIMB', 'CRUISE_CLIMB', 'CRUISE',
  'FAILURE', 'DESCENT', 'APPROACH', 'GEAR_DOWN', 'FINAL',
  'FLARE', 'TOUCHDOWN', 'ROLLOUT', 'TAXI_IN', 'SHUTDOWN',
];

// ---------------------------------------------------------------------------
// Phase configuration
// ---------------------------------------------------------------------------

export interface PhaseConfig {
  label: string;
  icon: string;
  /** Expected altitude range (m AGL) */
  altRange: [number, number];
  /** Expected airspeed range (m/s) */
  spdRange: [number, number];
  /** Throttle setting 0-1 */
  throttle: number;
  /** Gear down? */
  gearDown: boolean;
  /** Flap setting degrees */
  flapDeg: number;
  /** Camera mode */
  camera: string;
  /** Active warnings */
  warnings: string[];
  /** Expected vertical speed (m/s) */
  vsi: number;
  /** Transition description */
  transitionNote: string;
}

export const PHASE_CONFIG: Record<FlightPhase, PhaseConfig> = {
  PREFLIGHT: {
    label: 'Pre-Flight', icon: '✈️',
    altRange: [0, 0], spdRange: [0, 0], throttle: 0,
    gearDown: true, flapDeg: 0, camera: 'hangar',
    warnings: [], vsi: 0,
    transitionNote: 'Systems check complete. Ready for engine start.',
  },
  ENGINE_START: {
    label: 'Engine Start', icon: '🔧',
    altRange: [0, 0], spdRange: [0, 2], throttle: 0.05,
    gearDown: true, flapDeg: 0, camera: 'exterior',
    warnings: [], vsi: 0,
    transitionNote: 'Engines spooling up. Oil pressure nominal.',
  },
  TAXI: {
    label: 'Taxi', icon: '🚗',
    altRange: [0, 0], spdRange: [2, 15], throttle: 0.15,
    gearDown: true, flapDeg: 0, camera: 'chase',
    warnings: [], vsi: 0,
    transitionNote: 'Taxiing to runway. Flight controls checked.',
  },
  TAKEOFF_ROLL: {
    label: 'Takeoff Roll', icon: '🛫',
    altRange: [0, 0], spdRange: [15, 65], throttle: 1.0,
    gearDown: true, flapDeg: 10, camera: 'side_runway',
    warnings: [], vsi: 0,
    transitionNote: 'Full power. Accelerating down runway.',
  },
  ROTATION: {
    label: 'Rotation', icon: '↗️',
    altRange: [0, 5], spdRange: [55, 70], throttle: 1.0,
    gearDown: true, flapDeg: 10, camera: 'chase',
    warnings: [], vsi: 5,
    transitionNote: 'Vr — rotating. Nose lifting off.',
  },
  LIFTOFF: {
    label: 'Liftoff', icon: '起飞',
    altRange: [5, 30], spdRange: [60, 75], throttle: 1.0,
    gearDown: true, flapDeg: 10, camera: 'chase',
    warnings: [], vsi: 10,
    transitionNote: 'Positive rate of climb. Gear up when ready.',
  },
  INITIAL_CLIMB: {
    label: 'Initial Climb', icon: '📐',
    altRange: [30, 300], spdRange: [65, 85], throttle: 0.9,
    gearDown: false, flapDeg: 5, camera: 'chase',
    warnings: [], vsi: 8,
    transitionNote: 'Climbing to pattern altitude. Flaps retracting.',
  },
  CLIMB: {
    label: 'Climb', icon: '⬆️',
    altRange: [300, 3000], spdRange: [75, 110], throttle: 0.85,
    gearDown: false, flapDeg: 0, camera: 'chase',
    warnings: [], vsi: 5,
    transitionNote: 'Climbing to cruise altitude. Clean configuration.',
  },
  CRUISE_CLIMB: {
    label: 'Cruise Climb', icon: '📈',
    altRange: [3000, 5000], spdRange: [90, 130], throttle: 0.75,
    gearDown: false, flapDeg: 0, camera: 'chase',
    warnings: [], vsi: 2,
    transitionNote: 'Approaching cruise altitude. Reducing climb rate.',
  },
  CRUISE: {
    label: 'Cruise', icon: '🛩️',
    altRange: [4000, 6000], spdRange: [100, 150], throttle: 0.65,
    gearDown: false, flapDeg: 0, camera: 'cinematic',
    warnings: [], vsi: 0,
    transitionNote: 'Level cruise. Monitoring fuel and systems.',
  },
  FAILURE: {
    label: 'Engine Failure', icon: '⚠️',
    altRange: [3000, 6000], spdRange: [80, 130], throttle: 0.3,
    gearDown: false, flapDeg: 0, camera: 'engine_close',
    warnings: ['ENGINE FAILURE', 'ASYMMETRIC THRUST', 'REDUCED CLIMB'],
    vsi: -2,
    transitionNote: 'Engine failure! Compensating with rudder. Declaring emergency.',
  },
  DESCENT: {
    label: 'Descent', icon: '⬇️',
    altRange: [1000, 4000], spdRange: [80, 120], throttle: 0.3,
    gearDown: false, flapDeg: 0, camera: 'chase',
    warnings: [], vsi: -5,
    transitionNote: 'Descending to approach altitude. Speed checks.',
  },
  APPROACH: {
    label: 'Approach', icon: '🎯',
    altRange: [200, 1000], spdRange: [60, 90], throttle: 0.4,
    gearDown: false, flapDeg: 15, camera: 'approach',
    warnings: [], vsi: -3,
    transitionNote: 'On approach. Glideslope nominal. Gear when ready.',
  },
  GEAR_DOWN: {
    label: 'Gear Down', icon: '🔧',
    altRange: [100, 500], spdRange: [55, 80], throttle: 0.45,
    gearDown: true, flapDeg: 20, camera: 'gear_inspect',
    warnings: [], vsi: -2,
    transitionNote: 'Landing gear down and locked. Three greens.',
  },
  FINAL: {
    label: 'Final', icon: '🏁',
    altRange: [30, 200], spdRange: [50, 70], throttle: 0.4,
    gearDown: true, flapDeg: 30, camera: 'approach',
    warnings: [], vsi: -2,
    transitionNote: 'On final approach. Stabilised. Flaps landing.',
  },
  FLARE: {
    label: 'Flare', icon: '↘️',
    altRange: [1, 10], spdRange: [40, 55], throttle: 0.1,
    gearDown: true, flapDeg: 30, camera: 'side_runway',
    warnings: [], vsi: -1,
    transitionNote: 'Flaring. Retarding throttle. Hold off.',
  },
  TOUCHDOWN: {
    label: 'Touchdown', icon: '🛬',
    altRange: [0, 2], spdRange: [35, 50], throttle: 0,
    gearDown: true, flapDeg: 30, camera: 'side_runway',
    warnings: [], vsi: 0,
    transitionNote: 'Touchdown! Main wheels first. Nose coming down.',
  },
  ROLLOUT: {
    label: 'Rollout', icon: '🏎️',
    altRange: [0, 0], spdRange: [10, 40], throttle: 0,
    gearDown: true, flapDeg: 15, camera: 'chase',
    warnings: [], vsi: 0,
    transitionNote: 'Rolling out. Braking. Speed decreasing.',
  },
  TAXI_IN: {
    label: 'Taxi In', icon: '🚗',
    altRange: [0, 0], spdRange: [2, 12], throttle: 0.1,
    gearDown: true, flapDeg: 0, camera: 'chase',
    warnings: [], vsi: 0,
    transitionNote: 'Taxiing to parking. Flaps retracting.',
  },
  SHUTDOWN: {
    label: 'Shutdown', icon: '🔌',
    altRange: [0, 0], spdRange: [0, 0], throttle: 0,
    gearDown: true, flapDeg: 0, camera: 'hangar',
    warnings: [], vsi: 0,
    transitionNote: 'Engine shutdown complete. Mission debrief.',
  },
};

// ---------------------------------------------------------------------------
// Transition conditions (when to auto-advance phases)
// ---------------------------------------------------------------------------

export interface TransitionCondition {
  /** Minimum altitude (m AGL) */
  minAlt?: number;
  /** Maximum altitude (m AGL) */
  maxAlt?: number;
  /** Minimum airspeed (m/s) */
  minSpeed?: number;
  /** Maximum airspeed (m/s) */
  maxSpeed?: number;
  /** Minimum time in phase (s) */
  minTime?: number;
  /** Gear must be down */
  gearDown?: boolean;
  /** Gear must be up */
  gearUp?: boolean;
  /** Flap setting */
  flapDeg?: number;
  /** Vertical speed minimum */
  minVSI?: number;
  /** Custom check function */
  customCheck?: (s: FlightSimState) => boolean;
}

export const TRANSITIONS: Record<FlightPhase, { next: FlightPhase; condition: TransitionCondition }[]> = {
  PREFLIGHT: [{ next: 'ENGINE_START', condition: { customCheck: (s) => s.engineRunning } }],
  ENGINE_START: [{ next: 'TAXI', condition: { minTime: 3, minSpeed: 2 } }],
  TAXI: [{ next: 'TAKEOFF_ROLL', condition: { minSpeed: 15 } }],
  TAKEOFF_ROLL: [{ next: 'ROTATION', condition: { minSpeed: 55 } }],
  ROTATION: [{ next: 'LIFTOFF', condition: { minAlt: 5 } }],
  LIFTOFF: [{ next: 'INITIAL_CLIMB', condition: { minAlt: 30 } }],
  INITIAL_CLIMB: [{ next: 'CLIMB', condition: { minAlt: 300 } }],
  CLIMB: [{ next: 'CRUISE_CLIMB', condition: { minAlt: 3000 } }],
  CRUISE_CLIMB: [{ next: 'CRUISE', condition: { minAlt: 4500, minVSI: -1 } }],
  CRUISE: [
    { next: 'FAILURE', condition: { customCheck: (s) => s.engineFailed } },
    { next: 'DESCENT', condition: { maxAlt: 3500 } },
  ],
  FAILURE: [{ next: 'DESCENT', condition: { minTime: 3 } }],
  DESCENT: [{ next: 'APPROACH', condition: { maxAlt: 1000 } }],
  APPROACH: [{ next: 'GEAR_DOWN', condition: { maxAlt: 500, gearDown: true } }],
  GEAR_DOWN: [{ next: 'FINAL', condition: { maxAlt: 200 } }],
  FINAL: [{ next: 'FLARE', condition: { maxAlt: 10 } }],
  FLARE: [{ next: 'TOUCHDOWN', condition: { maxAlt: 2 } }],
  TOUCHDOWN: [{ next: 'ROLLOUT', condition: { maxSpeed: 35, minTime: 1 } }],
  ROLLOUT: [{ next: 'TAXI_IN', condition: { maxSpeed: 12 } }],
  TAXI_IN: [{ next: 'SHUTDOWN', condition: { customCheck: (s) => !s.engineRunning || s.timeInPhase > 3 } }],
  SHUTDOWN: [],
};

// ---------------------------------------------------------------------------
// Flight simulation state
// ---------------------------------------------------------------------------

export interface FlightSimState {
  // Position
  xM: number;
  altitudeM: number;
  zM: number;
  // Velocity
  airspeedMs: number;
  vsiMs: number;
  heading: number; // degrees
  // Attitude
  pitch: number; // degrees
  roll: number;  // degrees
  aoa: number;   // degrees
  // Systems
  throttle: number; // 0-1
  engineRunning: boolean;
  engineFailed: boolean;
  failedEngine: number; // 0 = none, 1 or 2
  gearDown: boolean;
  flapDeg: number;
  brakeOn: boolean;
  // Environmental
  icingLevel: number; // 0 = none, 1 = full ice
  // Mass
  massKg: number;
  fuelKg: number;
  // Phase
  currentPhase: FlightPhase;
  timeInPhase: number;
  totalTime: number;
  // Environment
  windMs: number;
  windDirDeg: number;
  densityKgM3: number;
  // Telemetry log
  phaseLog: { phase: FlightPhase; time: number; reason: string }[];
}

// ---------------------------------------------------------------------------
// State machine step
// ---------------------------------------------------------------------------

export function createInitialState(params: {
  massKg: number;
  fuelKg: number;
  windMs?: number;
  windDirDeg?: number;
}): FlightSimState {
  return {
    xM: 0, altitudeM: 0, zM: 0,
    airspeedMs: 0, vsiMs: 0, heading: 0,
    pitch: 0, roll: 0, aoa: 0,
    throttle: 0, engineRunning: false, engineFailed: false, failedEngine: 0,
    gearDown: true, flapDeg: 0, brakeOn: true, icingLevel: 0,
    massKg: params.massKg, fuelKg: params.fuelKg,
    currentPhase: 'PREFLIGHT', timeInPhase: 0, totalTime: 0,
    windMs: params.windMs ?? 5, windDirDeg: params.windDirDeg ?? 270,
    densityKgM3: 1.225,
    phaseLog: [{ phase: 'PREFLIGHT', time: 0, reason: 'Mission start' }],
  };
}

/**
 * Advance the flight simulation by dt seconds.
 * Returns the updated state.
 */
export function stepFlight(state: FlightSimState, dt: number): FlightSimState {
  const s = { ...state };
  s.totalTime += dt;
  s.timeInPhase += dt;

  const cfg = PHASE_CONFIG[s.currentPhase];

  // Apply throttle from phase config (gradual approach)
  const targetThrottle = cfg.throttle;
  s.throttle += (targetThrottle - s.throttle) * Math.min(1, dt * 2);

  // Engine failure effects
  if (s.engineFailed) {
    s.throttle *= 0.5; // 50% thrust reduction
  }

  // Simple flight dynamics
  const rho = s.densityKgM3;
  const wingArea = 16; // m² — from default config
  const clAlpha = 2 * Math.PI;
  const cd0 = 0.025;
  const oswald = 0.8;
  const aspectRatio = 8;

  // Thrust (simplified)
  const maxThrust = s.massKg * 0.3; // ~0.3 T/W ratio
  const altFactor = Math.max(0.3, 1 - s.altitudeM / 15000);
  const thrust = maxThrust * s.throttle * altFactor;

  // AoA from pitch and flight path
  s.aoa = s.pitch - Math.atan2(-s.vsiMs, Math.max(s.airspeedMs, 1)) * (180 / Math.PI);

  // Lift
  const cl = clAlpha * (s.aoa * Math.PI / 180);
  const lift = 0.5 * rho * s.airspeedMs * s.airspeedMs * wingArea * Math.min(cl, 1.6);

  // Drag (with gear and flaps)
  const gearDrag = s.gearDown ? 0.015 : 0;
  const flapDrag = (s.flapDeg / 30) * 0.02;
  const cdInduced = (cl * cl) / (Math.PI * aspectRatio * oswald);
  const cd = cd0 + gearDrag + flapDrag + cdInduced;
  const drag = 0.5 * rho * s.airspeedMs * s.airspeedMs * wingArea * cd;

  // Weight
  const weight = s.massKg * 9.81;

  // Forces
  const netForward = thrust - drag;
  const netVertical = lift - weight;

  // Update velocity
  const acceleration = netForward / s.massKg;
  s.airspeedMs = Math.max(0, s.airspeedMs + acceleration * dt);

  // Update altitude
  s.vsiMs += (netVertical / s.massKg) * dt;
  s.vsiMs *= 0.98; // damping
  s.altitudeM = Math.max(0, s.altitudeM + s.vsiMs * dt);

  // Ground check
  if (s.altitudeM <= 0) {
    s.altitudeM = 0;
    if (s.vsiMs < 0) s.vsiMs = 0;
    s.airspeedMs = Math.max(0, s.airspeedMs - 2 * dt); // ground friction
  }

  // Update position
  const headingRad = (s.heading * Math.PI) / 180;
  s.xM += s.airspeedMs * Math.cos(headingRad) * dt;
  s.zM += s.airspeedMs * Math.sin(headingRad) * dt;

  // Fuel burn
  const sfc = 0.00005; // kg/(N*s) simplified
  s.fuelKg = Math.max(0, s.fuelKg - thrust * sfc * dt);
  s.massKg = s.massKg - thrust * sfc * dt;

  // Attitude from phase config
  const targetPitch = s.currentPhase === 'CRUISE' ? 2 :
    s.currentPhase === 'CLIMB' || s.currentPhase === 'CRUISE_CLIMB' ? 8 :
    s.currentPhase === 'DESCENT' || s.currentPhase === 'APPROACH' ? -3 :
    s.currentPhase === 'FLARE' ? 5 :
    s.currentPhase === 'TAKEOFF_ROLL' ? 0 : s.pitch;
  s.pitch += (targetPitch - s.pitch) * Math.min(1, dt * 1.5);

  // Bank from heading changes
  s.roll *= 0.95;

  // Density from altitude (ISA)
  s.densityKgM3 = 1.225 * Math.exp(-s.altitudeM / 8500);

  // Check phase transitions
  const transitions = TRANSITIONS[s.currentPhase];
  for (const t of transitions) {
    if (checkTransition(s, t.condition)) {
      s.currentPhase = t.next;
      s.timeInPhase = 0;
      const reason = PHASE_CONFIG[t.next].transitionNote;
      s.phaseLog.push({ phase: t.next, time: s.totalTime, reason });
      break;
    }
  }

  return s;
}

function checkTransition(state: FlightSimState, cond: TransitionCondition): boolean {
  if (cond.minAlt !== undefined && state.altitudeM < cond.minAlt) return false;
  if (cond.maxAlt !== undefined && state.altitudeM > cond.maxAlt) return false;
  if (cond.minSpeed !== undefined && state.airspeedMs < cond.minSpeed) return false;
  if (cond.maxSpeed !== undefined && state.airspeedMs > cond.maxSpeed) return false;
  if (cond.minTime !== undefined && state.timeInPhase < cond.minTime) return false;
  if (cond.gearDown !== undefined && state.gearDown !== cond.gearDown) return false;
  if (cond.gearUp !== undefined && state.gearDown === cond.gearUp) return false;
  if (cond.flapDeg !== undefined && state.flapDeg !== cond.flapDeg) return false;
  if (cond.minVSI !== undefined && state.vsiMs < cond.minVSI) return false;
  if (cond.customCheck && !cond.customCheck(state)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Autopilot commands (for cinematic/automated missions)
// ---------------------------------------------------------------------------

export interface AutopilotCommand {
  throttle?: number;
  pitch?: number;
  roll?: number;
  gear?: boolean;
  flaps?: number;
  brake?: boolean;
  engineFail?: number; // 0 = none, 1 = engine 1, 2 = engine 2
}

/**
 * Generate autopilot commands for a given phase.
 * The autopilot controls the aircraft but the physics engine does the work.
 */
export function autopilotForPhase(phase: FlightPhase, state: FlightSimState): AutopilotCommand {
  switch (phase) {
    case 'PREFLIGHT': return { throttle: 0, brake: true };
    case 'ENGINE_START': return { throttle: 0.05, brake: true };
    case 'TAXI': return { throttle: 0.15, brake: false };
    case 'TAKEOFF_ROLL': return { throttle: 1.0, brake: false, gear: true, flaps: 10 };
    case 'ROTATION': return { throttle: 1.0, pitch: 12, gear: true, flaps: 10 };
    case 'LIFTOFF': return { throttle: 1.0, pitch: 8, gear: true, flaps: 10 };
    case 'INITIAL_CLIMB': return { throttle: 0.9, pitch: 8, gear: false, flaps: 5 };
    case 'CLIMB': return { throttle: 0.85, pitch: 5, gear: false, flaps: 0 };
    case 'CRUISE_CLIMB': return { throttle: 0.75, pitch: 3, gear: false, flaps: 0 };
    case 'CRUISE': return { throttle: 0.65, pitch: 2, gear: false, flaps: 0 };
    case 'FAILURE': return { throttle: 0.3, pitch: 3, gear: false, flaps: 0 };
    case 'DESCENT': return { throttle: 0.3, pitch: -3, gear: false, flaps: 0 };
    case 'APPROACH': return { throttle: 0.4, pitch: -2, gear: false, flaps: 15 };
    case 'GEAR_DOWN': return { throttle: 0.45, pitch: -2, gear: true, flaps: 20 };
    case 'FINAL': return { throttle: 0.4, pitch: -2, gear: true, flaps: 30 };
    case 'FLARE': return { throttle: 0.1, pitch: 5, gear: true, flaps: 30 };
    case 'TOUCHDOWN': return { throttle: 0, pitch: 0, gear: true, flaps: 30, brake: true };
    case 'ROLLOUT': return { throttle: 0, pitch: 0, gear: true, flaps: 15, brake: true };
    case 'TAXI_IN': return { throttle: 0.1, pitch: 0, gear: true, flaps: 0, brake: false };
    case 'SHUTDOWN': return { throttle: 0, brake: true };
  }
}

// ---------------------------------------------------------------------------
// Engineering causality — explains WHY things happen
// ---------------------------------------------------------------------------

export interface EngineeringCausality {
  event: string;
  cause: string;
  physicalEffect: string;
  aircraftEffect: string;
  controlResponse: string;
  missionEffect: string;
}

export function getCausality(phase: FlightPhase, state: FlightSimState): EngineeringCausality | null {
  if (phase === 'FAILURE' && state.engineFailed) {
    return {
      event: `ENGINE ${state.failedEngine} FAILURE`,
      cause: 'Engine malfunction — combustion ceased',
      physicalEffect: `Thrust reduced by ~50%. Asymmetric thrust of ${state.failedEngine === 1 ? 'left' : 'right'} engine.`,
      aircraftEffect: 'Yawing moment toward failed engine. Reduced climb capability. Possible roll coupling.',
      controlResponse: 'Compensating rudder input required. Asymmetric thrust management.',
      missionEffect: 'Climb capability reduced. Diversion to nearest airport recommended.',
    };
  }
  if (phase === 'TOUCHDOWN') {
    return {
      event: 'TOUCHDOWN',
      cause: 'Aircraft reached flare altitude and reduced to landing speed',
      physicalEffect: 'Main wheels contact runway. Weight transfer from wings to wheels.',
      aircraftEffect: 'Lift decreases as speed reduces. Aircraft settles on gear.',
      controlResponse: 'Nose wheel gently lowered. Braking commenced.',
      missionEffect: 'Mission nearing completion. Rollout and taxi-in remaining.',
    };
  }
  return null;
}

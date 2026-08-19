// Flight Ops — Detailed aircraft configuration for the Aero Lab designer.
//
// Extends the game's simple Design type with real engineering parameters:
// wing geometry, tail, fuselage, propulsion, and mass breakdown.
// All quantities are SI.

// ---------------------------------------------------------------------------
// Wing geometry
// ---------------------------------------------------------------------------

export interface WingConfig {
  /** Wing span in m */
  spanM: number;
  /** Wing area in m² */
  areaM2: number;
  /** Taper ratio (tip chord / root chord) */
  taperRatio: number;
  /** Quarter-chord sweep angle in degrees */
  sweepDeg: number;
  /** Dihedral angle in degrees */
  dihedralDeg: number;
  /** Incidence angle in degrees */
  incidenceDeg: number;
  /** Washout (twist) in degrees (negative = tip has lower AoA) */
  washoutDeg: number;
  /** Airfoil section identifier (from AIRFOILS in aerodynamics.ts) */
  airfoilId: string;
  /** Flap type for high-lift */
  flapType: 'none' | 'plain' | 'split' | 'slotted' | 'fowler';
  /** Number of flap segments */
  flapSegments: number;
}

// ---------------------------------------------------------------------------
// Tail geometry
// ---------------------------------------------------------------------------

export interface TailConfig {
  /** Horizontal tail area in m² */
  htAreaM2: number;
  /** Vertical tail area in m² */
  vtAreaM2: number;
  /** Tail arm (distance from wing AC to tail AC) in m */
  tailArmM: number;
  /** Horizontal tail airfoil */
  htAirfoilId: string;
  /** Vertical tail airfoil */
  vtAirfoilId: string;
  /** Tail configuration */
  configuration: 'conventional' | 't-tail' | 'v-tail' | 'canard' | 'none';
}

// ---------------------------------------------------------------------------
// Fuselage
// ---------------------------------------------------------------------------

export interface FuselageConfig {
  /** Fuselage length in m */
  lengthM: number;
  /** Maximum diameter in m */
  diameterM: number;
  /** Fineness ratio (length / diameter) */
  finenessRatio: number;
}

// ---------------------------------------------------------------------------
// Propulsion
// ---------------------------------------------------------------------------

export type PropulsionType = 'piston' | 'turboprop' | 'turbojet' | 'turbofan' | 'electric';

export interface PropulsionConfig {
  type: PropulsionType;
  /** Number of engines */
  count: number;
  /** Rated power per engine in W (for piston/turboprop/electric) */
  powerW: number;
  /** Rated thrust per engine in N (for jets) */
  thrustN: number;
  /** Propeller diameter in m (for prop-driven) */
  propDiameterM: number;
  /** Engine mass per unit in kg */
  engineMassKg: number;
  /** Propeller efficiency (0-1) */
  propEfficiency: number;
  /** Specific fuel consumption in kg/(W*s) for piston, kg/(N*s) for jets */
  sfc: number;
}

// ---------------------------------------------------------------------------
// Mass breakdown
// ---------------------------------------------------------------------------

export interface MassBreakdown {
  /** Wing structural mass in kg */
  wingKg: number;
  /** Fuselage structural mass in kg */
  fuselageKg: number;
  /** Tail structural mass in kg */
  tailKg: number;
  /** Landing gear mass in kg */
  landingGearKg: number;
  /** Propulsion system total mass in kg */
  propulsionKg: number;
  /** Fuel/battery mass in kg */
  fuelKg: number;
  /** Payload mass in kg */
  payloadKg: number;
  /** Avionics / systems mass in kg */
  systemsKg: number;
  /** Total empty mass in kg */
  emptyMassKg: number;
  /** Maximum takeoff mass in kg */
  mtomKg: number;
  /** CG position from nose in m */
  cgPositionM: number;
}

// ---------------------------------------------------------------------------
// Complete aircraft configuration
// ---------------------------------------------------------------------------

export interface AircraftConfig {
  /** Configuration name */
  name: string;
  wing: WingConfig;
  tail: TailConfig;
  fuselage: FuselageConfig;
  propulsion: PropulsionConfig;
  mass: MassBreakdown;
}

// ---------------------------------------------------------------------------
// Default configurations (starting points for students)
// ---------------------------------------------------------------------------

export function defaultWingConfig(): WingConfig {
  return {
    spanM: 10,
    areaM2: 16,
    taperRatio: 0.6,
    sweepDeg: 2,
    dihedralDeg: 3,
    incidenceDeg: 2,
    washoutDeg: -2,
    airfoilId: 'naca2412',
    flapType: 'slotted',
    flapSegments: 2,
  };
}

export function defaultTailConfig(): TailConfig {
  return {
    htAreaM2: 3.5,
    vtAreaM2: 2.5,
    tailArmM: 5,
    htAirfoilId: 'naca0012',
    vtAirfoilId: 'naca0012',
    configuration: 'conventional',
  };
}

export function defaultFuselageConfig(): FuselageConfig {
  return {
    lengthM: 8,
    diameterM: 1.2,
    finenessRatio: 8 / 1.2,
  };
}

export function defaultPropulsionConfig(): PropulsionConfig {
  return {
    type: 'turboprop',
    count: 1,
    powerW: 500_000,
    thrustN: 0,
    propDiameterM: 2.5,
    engineMassKg: 120,
    propEfficiency: 0.82,
    sfc: 0.55 / 3600,
  };
}

/**
 * Compute the mass breakdown from the aircraft geometry.
 * Uses simplified statistical/empirical relationships based on Raymer
 * and Sadraey weight-estimation methods.
 */
export function computeMassBreakdown(
  wing: WingConfig,
  tail: TailConfig,
  fuselage: FuselageConfig,
  propulsion: PropulsionConfig,
  payloadKg: number,
  fuelKg: number,
): MassBreakdown {
  // Statistical weight fractions (simplified Raymer/Sadraey)
  // Wing: ~8-12% of MTOM for metal, ~6-9% for composite
  const wingKg = wing.areaM2 * 22; // ~22 kg/m² for metal wing
  const fuselageKg = fuselage.lengthM * fuselage.diameterM * 35; // kg per m² of wetted area
  const tailKg = (tail.htAreaM2 + tail.vtAreaM2) * 15;
  const landingGearKg = 80 + payloadKg * 0.02;
  const propulsionKg = propulsion.engineMassKg * propulsion.count + propulsion.propDiameterM * 15 * propulsion.count;
  const systemsKg = 50 + payloadKg * 0.01;

  const emptyMassKg = wingKg + fuselageKg + tailKg + landingGearKg + propulsionKg + systemsKg;
  const mtomKg = emptyMassKg + fuelKg + payloadKg;

  // Simplified CG estimate: 25-30% of fuselage length from nose
  const cgPositionM = fuselage.lengthM * 0.28;

  return {
    wingKg,
    fuselageKg,
    tailKg,
    landingGearKg,
    propulsionKg,
    fuelKg,
    payloadKg,
    systemsKg,
    emptyMassKg,
    mtomKg,
    cgPositionM,
  };
}

// ---------------------------------------------------------------------------
// Derived engineering quantities
// ---------------------------------------------------------------------------

export interface AircraftPerformance {
  /** Wing loading in N/m² */
  wingLoading: number;
  /** Power loading in W/N */
  powerLoading: number;
  /** Aspect ratio */
  aspectRatio: number;
  /** Estimated zero-lift drag coefficient */
  cd0: number;
  /** Estimated Oswald efficiency */
  oswaldE: number;
  /** Estimated max L/D */
  maxLd: number;
  /** Estimated stall speed in m/s */
  stallSpeedMs: number;
  /** Estimated cruise speed in m/s */
  cruiseSpeedMs: number;
  /** Estimated max climb rate in m/s */
  climbRateMs: number;
  /** Estimated range in km */
  rangeKm: number;
  /** Estimated endurance in minutes */
  enduranceMin: number;
  /** Estimated takeoff distance in m */
  takeoffDistanceM: number;
  /** Pitching moment coefficient (approximate) */
  cm: number;
  /** Static margin (negative = unstable) */
  staticMargin: number;
}

/**
 * Compute derived performance from the full aircraft configuration.
 */
export function computePerformance(
  config: AircraftConfig,
): AircraftPerformance {
  const { wing, tail, fuselage, propulsion, mass } = config;

  const aspectRatio = (wing.spanM * wing.spanM) / wing.areaM2;
  const wingLoading = (mass.mtomKg * 9.80665) / wing.areaM2;
  const powerLoading = propulsion.powerW * propulsion.count / (mass.mtomKg * 9.80665);

  // Parasite drag estimate (Raymer component buildup, simplified)
  const wingFriction = wing.areaM2 * 0.005; // skin friction
  const fuselageFriction = fuselage.lengthM * fuselage.diameterM * Math.PI * 0.004;
  const tailFriction = (tail.htAreaM2 + tail.vtAreaM2) * 0.005;
  const interferenceFactor = 1.15;
  const cd0 = (wingFriction + fuselageFriction + tailFriction) * interferenceFactor / wing.areaM2;

  const oswaldE = 0.85 - 0.02 * Math.max(0, wing.sweepDeg / 10);
  const k = 1 / (Math.PI * oswaldE * aspectRatio);
  const maxLd = 1 / (2 * Math.sqrt(cd0 * k));

  // Stall speed: W = 0.5 * rho * V^2 * S * CLmax
  const clMax = 1.6 + (wing.flapType === 'fowler' ? 0.4 : wing.flapType === 'slotted' ? 0.3 : wing.flapType === 'plain' ? 0.2 : 0);
  const rho0 = 1.225;
  const stallSpeedMs = Math.sqrt((2 * mass.mtomKg * 9.80665) / (rho0 * wing.areaM2 * clMax));

  // Cruise speed estimate from power available = power required
  const rhoCruise = 1.225 * Math.exp(-mass.mtomKg * 0.00001); // rough altitude correction
  const cruiseSpeedMs = Math.pow(
    (2 * powerLoading * mass.mtomKg * 9.80665 * maxLd * propulsion.propEfficiency) / (rhoCruise * wing.areaM2),
    1 / 3,
  );

  // Climb rate: excess power / weight
  const climbDrag = mass.mtomKg * 9.80665 / maxLd;
  const excessPower = propulsion.powerW * propulsion.count * propulsion.propEfficiency - climbDrag * cruiseSpeedMs * 0.5;
  const climbRateMs = Math.max(0, excessPower / (mass.mtomKg * 9.80665));

  // Range (Breguet)
  const rangeKm = cruiseSpeedMs * maxLd * propulsion.propEfficiency / (9.80665 * propulsion.sfc * 3600) / 1000;
  const enduranceMin = rangeKm / (cruiseSpeedMs * 3.6 / 1000) * 60;

  // Takeoff distance (simplified)
  const vTakeoff = stallSpeedMs * 1.2;
  const accelDistance = (vTakeoff * vTakeoff) / (2 * 9.80665 * (propulsion.thrustN * propulsion.count / (mass.mtomKg * 9.80665) - 0.03));
  const takeoffDistanceM = accelDistance * 1.15; // ground roll + rotation

  // Static margin: CG distance ahead of neutral point
  const neutralPoint = fuselage.lengthM * 0.35; // rough estimate
  const staticMargin = (neutralPoint - mass.cgPositionM) / (wing.spanM / aspectRatio);

  // Pitching moment (rough)
  const cm = -0.05 * (wing.washoutDeg / -2); // proportional to washout

  return {
    wingLoading,
    powerLoading,
    aspectRatio,
    cd0,
    oswaldE,
    maxLd,
    stallSpeedMs,
    cruiseSpeedMs,
    climbRateMs,
    rangeKm,
    enduranceMin,
    takeoffDistanceM,
    cm,
    staticMargin,
  };
}

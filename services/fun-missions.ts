// Fun Mode — Mission definitions with objectives and environmental conditions.
// Each mission provides a unique challenge for the player to design and fly an aircraft.

// ---------------------------------------------------------------------------

export interface FunMission {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Category for display grouping */
  category: 'training' | 'commercial' | 'military' | 'challenge';
  /** Objectives the player must satisfy */
  objectives: MissionObjective[];
  /** Environmental conditions during flight */
  environment: MissionEnvironment;
  /** Base reward in credits */
  creditReward: number;
  /** XP reward */
  xpReward: number;
  /** Difficulty 1-5 */
  difficulty: number;
  /** Recommended aircraft type hint */
  hint: string;
}

export interface MissionObjective {
  id: string;
  text: string;
  /** Parameter to check */
  parameter: string;
  /** Comparison: 'gte' | 'lte' | 'eq' */
  comparison: 'gte' | 'lte' | 'eq';
  /** Target value */
  value: number;
  /** Unit string for display */
  unit: string;
  /** Bonus credit for this objective */
  bonusCredits: number;
}

export interface MissionEnvironment {
  /** Wind speed in m/s */
  windMs: number;
  /** Wind direction in degrees */
  windDirDeg: number;
  /** Visibility 0-1 (1 = clear, 0 = zero vis) */
  visibility: number;
  /** Turbulence intensity 0-1 */
  turbulence: number;
  /** Temperature deviation from ISA in °C */
  tempDeviationC: number;
  /** Weather events that may occur */
  events: WeatherEvent[];
}

export interface WeatherEvent {
  /** When during flight this can trigger (0-1 progress) */
  triggerProgress: number;
  /** Type of event */
  type: 'gust' | 'crosswind' | 'icing' | 'thunderstorm' | 'wind_shear';
  /** Severity 1-5 */
  severity: number;
  /** Duration in seconds of flight time */
  durationS: number;
  /** Description shown to player */
  description: string;
}

export interface MissionResult {
  missionId: string;
  completed: boolean;
  objectivesMet: number;
  totalObjectives: number;
  creditsEarned: number;
  xpEarned: number;
  /** Flight stats */
  fuelUsedKg: number;
  maxSpeedMs: number;
  distanceTraveledKm: number;
  eventsEncountered: string[];
  /** Performance grade */
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
}

// ---------------------------------------------------------------------------

export const FUN_MISSIONS: FunMission[] = [
  // ---- TRAINING ----
  {
    id: 'first-flight',
    name: 'First Flight',
    icon: '🎓',
    description: 'Your very first flight! Take off, reach 500m altitude, and land safely.',
    category: 'training',
    objectives: [
      { id: 'takeoff', text: 'Take off successfully', parameter: 'altitude', comparison: 'gte', value: 50, unit: 'm', bonusCredits: 100 },
      { id: 'altitude', text: 'Reach 500 m altitude', parameter: 'altitude', comparison: 'gte', value: 500, unit: 'm', bonusCredits: 200 },
      { id: 'land', text: 'Land safely', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 300 },
    ],
    environment: { windMs: 3, windDirDeg: 270, visibility: 1, turbulence: 0.1, tempDeviationC: 0, events: [] },
    creditReward: 500,
    xpReward: 100,
    difficulty: 1,
    hint: 'Use a trainer with medium wings and a piston engine.',
  },
  {
    id: 'pattern-work',
    name: 'Circuit Training',
    icon: '🔄',
    description: 'Fly a standard traffic pattern: take off, fly a rectangle, and land back on the runway.',
    category: 'training',
    objectives: [
      { id: 'climb', text: 'Climb to 300 m', parameter: 'altitude', comparison: 'gte', value: 300, unit: 'm', bonusCredits: 100 },
      { id: 'distance', text: 'Fly at least 5 km total', parameter: 'distance', comparison: 'gte', value: 5, unit: 'km', bonusCredits: 200 },
      { id: 'land', text: 'Land on the runway', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 300 },
    ],
    environment: { windMs: 5, windDirDeg: 180, visibility: 0.9, turbulence: 0.15, tempDeviationC: 0, events: [] },
    creditReward: 600,
    xpReward: 120,
    difficulty: 1,
    hint: 'A balanced medium-wing design works well for pattern work.',
  },

  // ---- COMMERCIAL ----
  {
    id: 'passenger-hop',
    name: 'Passenger Hop',
    icon: '👥',
    description: 'Carry 19 passengers 300 km. Keep them comfortable — no excessive speed or rough flying.',
    category: 'commercial',
    objectives: [
      { id: 'range', text: 'Fly 300 km', parameter: 'distance', comparison: 'gte', value: 300, unit: 'km', bonusCredits: 300 },
      { id: 'fuel', text: 'Land with >10% fuel remaining', parameter: 'fuelRemainingPct', comparison: 'gte', value: 10, unit: '%', bonusCredits: 200 },
      { id: 'speed', text: 'Cruise above 80 m/s', parameter: 'cruiseSpeed', comparison: 'gte', value: 80, unit: 'm/s', bonusCredits: 200 },
    ],
    environment: { windMs: 8, windDirDeg: 225, visibility: 0.85, turbulence: 0.2, tempDeviationC: 5, events: [{ triggerProgress: 0.4, type: 'gust', severity: 2, durationS: 5, description: 'Thermal turbulence near the mountains!' }] },
    creditReward: 1200,
    xpReward: 250,
    difficulty: 3,
    hint: 'A turboprop or turbofan with swept wings handles this well.',
  },
  {
    id: 'cargo-run',
    name: 'Heavy Cargo',
    icon: '📦',
    description: 'Haul 5000 kg of cargo over 400 km. You need strong wings and plenty of thrust.',
    category: 'commercial',
    objectives: [
      { id: 'range', text: 'Fly 400 km', parameter: 'distance', comparison: 'gte', value: 400, unit: 'km', bonusCredits: 300 },
      { id: 'takeoff', text: 'Take off within 800 m', parameter: 'takeoffDist', comparison: 'lte', value: 800, unit: 'm', bonusCredits: 250 },
      { id: 'land', text: 'Land safely', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 250 },
    ],
    environment: { windMs: 6, windDirDeg: 90, visibility: 0.9, turbulence: 0.15, tempDeviationC: 0, events: [] },
    creditReward: 1500,
    xpReward: 300,
    difficulty: 3,
    hint: 'Wide wings with a powerful engine. Piston engines struggle with this load.',
  },
  {
    id: 'desert-supply',
    name: 'Desert Supply Run',
    icon: '🏜️',
    description: 'Deliver supplies to a remote desert outpost. High temperatures reduce engine performance.',
    category: 'commercial',
    objectives: [
      { id: 'range', text: 'Fly 600 km', parameter: 'distance', comparison: 'gte', value: 600, unit: 'km', bonusCredits: 400 },
      { id: 'fuel', text: 'Arrive with fuel to spare', parameter: 'fuelRemainingPct', comparison: 'gte', value: 15, unit: '%', bonusCredits: 300 },
    ],
    environment: { windMs: 4, windDirDeg: 315, visibility: 0.7, turbulence: 0.3, tempDeviationC: 20, events: [{ triggerProgress: 0.6, type: 'wind_shear', severity: 3, durationS: 8, description: 'Hot desert thermals causing wind shear!' }] },
    creditReward: 1800,
    xpReward: 350,
    difficulty: 4,
    hint: 'Hot air is less dense — you need more wing area and thrust.',
  },

  // ---- MILITARY ----
  {
    id: 'intercept',
    name: 'Quick Intercept',
    icon: '⚔️',
    description: 'Scramble and intercept a target at Mach 0.8. Speed is everything.',
    category: 'military',
    objectives: [
      { id: 'speed', text: 'Reach Mach 0.8 (≈270 m/s)', parameter: 'maxSpeed', comparison: 'gte', value: 270, unit: 'm/s', bonusCredits: 500 },
      { id: 'climb', text: 'Climb to 8000 m', parameter: 'altitude', comparison: 'gte', value: 8000, unit: 'm', bonusCredits: 300 },
    ],
    environment: { windMs: 12, windDirDeg: 270, visibility: 1, turbulence: 0.1, tempDeviationC: -10, events: [] },
    creditReward: 2000,
    xpReward: 400,
    difficulty: 4,
    hint: 'You need a jet engine and swept wings. Short and stubby is fine.',
  },
  {
    id: 'recon-patrol',
    name: 'Recon Patrol',
    icon: '👁️',
    description: 'Loiter over a zone for 30 minutes. Endurance is key — not speed.',
    category: 'military',
    objectives: [
      { id: 'endurance', text: 'Fly for 30+ minutes', parameter: 'flightTime', comparison: 'gte', value: 1800, unit: 's', bonusCredits: 400 },
      { id: 'altitude', text: 'Stay above 2000 m', parameter: 'altitude', comparison: 'gte', value: 2000, unit: 'm', bonusCredits: 200 },
      { id: 'fuel', text: 'Land with fuel remaining', parameter: 'fuelRemainingPct', comparison: 'gte', value: 5, unit: '%', bonusCredits: 300 },
    ],
    environment: { windMs: 10, windDirDeg: 180, visibility: 0.8, turbulence: 0.25, tempDeviationC: 0, events: [{ triggerProgress: 0.3, type: 'gust', severity: 3, durationS: 10, description: 'Strong headwind gust!' }, { triggerProgress: 0.7, type: 'crosswind', severity: 2, durationS: 6, description: 'Crosswind from the east.' }] },
    creditReward: 1800,
    xpReward: 350,
    difficulty: 3,
    hint: 'Long slender wings for efficiency. A turboprop gives good endurance.',
  },
  {
    id: 'dogfight',
    name: 'Dogfight Challenge',
    icon: '🎯',
    description: 'Outmaneuver the opponent! Reach high speed, pull tight turns, and show your aircraft can handle it.',
    category: 'military',
    objectives: [
      { id: 'speed', text: 'Reach 200 m/s', parameter: 'maxSpeed', comparison: 'gte', value: 200, unit: 'm/s', bonusCredits: 400 },
      { id: 'maneuver', text: 'Pull 3+ G turn', parameter: 'maxG', comparison: 'gte', value: 3, unit: 'G', bonusCredits: 500 },
      { id: 'altitude', text: 'Fight above 3000 m', parameter: 'altitude', comparison: 'gte', value: 3000, unit: 'm', bonusCredits: 200 },
    ],
    environment: { windMs: 15, windDirDeg: 45, visibility: 1, turbulence: 0.3, tempDeviationC: 0, events: [{ triggerProgress: 0.5, type: 'gust', severity: 4, durationS: 5, description: 'Turbulence during high-G turn!' }] },
    creditReward: 2500,
    xpReward: 500,
    difficulty: 5,
    hint: 'Short swept wings, powerful engine, symmetric airfoil. Think fighter jet.',
  },

  // ---- CHALLENGE ----
  {
    id: 'crosswind-landing',
    name: 'Crosswind Landing',
    icon: '💨',
    description: 'Land in a 15-knot crosswind. Your tail design and control authority matter.',
    category: 'challenge',
    objectives: [
      { id: 'land', text: 'Land safely', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 400 },
      { id: 'distance', text: 'Fly at least 10 km first', parameter: 'distance', comparison: 'gte', value: 10, unit: 'km', bonusCredits: 200 },
    ],
    environment: { windMs: 8, windDirDeg: 315, visibility: 0.9, turbulence: 0.4, tempDeviationC: 0, events: [{ triggerProgress: 0.1, type: 'crosswind', severity: 4, durationS: 999, description: 'Strong crosswind from the left!' }] },
    creditReward: 1500,
    xpReward: 300,
    difficulty: 4,
    hint: 'A good vertical tail gives directional stability in crosswind.',
  },
  {
    id: 'storm-runner',
    name: 'Storm Runner',
    icon: '⛈️',
    description: 'Fly through a thunderstorm zone. Expect turbulence, wind shear, and icing.',
    category: 'challenge',
    objectives: [
      { id: 'range', text: 'Fly 200 km through the storm', parameter: 'distance', comparison: 'gte', value: 200, unit: 'km', bonusCredits: 500 },
      { id: 'integrity', text: 'Keep airframe above 50%', parameter: 'integrity', comparison: 'gte', value: 50, unit: '%', bonusCredits: 400 },
      { id: 'land', text: 'Land safely after', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 300 },
    ],
    environment: { windMs: 20, windDirDeg: 135, visibility: 0.4, turbulence: 0.8, tempDeviationC: -5, events: [
      { triggerProgress: 0.2, type: 'gust', severity: 5, durationS: 8, description: 'Severe turbulence!' },
      { triggerProgress: 0.4, type: 'icing', severity: 3, durationS: 15, description: 'Ice forming on the wings!' },
      { triggerProgress: 0.6, type: 'wind_shear', severity: 4, durationS: 6, description: 'Dangerous wind shear!' },
      { triggerProgress: 0.8, type: 'thunderstorm', severity: 5, durationS: 10, description: 'Lightning nearby — severe updraft!' },
    ]},
    creditReward: 3000,
    xpReward: 600,
    difficulty: 5,
    hint: 'Thick wings resist icing better. Turboprop engines handle rough weather.',
  },
  {
    id: 'mountain-pass',
    name: 'Mountain Pass',
    icon: '🏔️',
    description: 'Navigate through a narrow mountain valley. Stay above terrain but below cloud ceiling.',
    category: 'challenge',
    objectives: [
      { id: 'range', text: 'Cross the mountain range (80 km)', parameter: 'distance', comparison: 'gte', value: 80, unit: 'km', bonusCredits: 400 },
      { id: 'climb', text: 'Reach 4000 m altitude', parameter: 'altitude', comparison: 'gte', value: 4000, unit: 'm', bonusCredits: 300 },
      { id: 'land', text: 'Land on the other side', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 400 },
    ],
    environment: { windMs: 12, windDirDeg: 270, visibility: 0.6, turbulence: 0.6, tempDeviationC: -8, events: [
      { triggerProgress: 0.3, type: 'gust', severity: 4, durationS: 10, description: 'Mountain wave turbulence!' },
      { triggerProgress: 0.6, type: 'wind_shear', severity: 3, durationS: 5, description: 'Downdraft in the valley!' },
    ]},
    creditReward: 2200,
    xpReward: 450,
    difficulty: 5,
    hint: 'High climb rate and good altitude performance. Turboprop at high power.',
  },
  {
    id: 'night-approach',
    name: 'Night Approach',
    icon: '🌙',
    description: 'Fly a precision approach at night in low visibility. Instrument flying skills required.',
    category: 'challenge',
    objectives: [
      { id: 'range', text: 'Fly 150 km in low visibility', parameter: 'distance', comparison: 'gte', value: 150, unit: 'km', bonusCredits: 300 },
      { id: 'land', text: 'Land on the runway', parameter: 'landed', comparison: 'eq', value: 1, unit: '', bonusCredits: 500 },
    ],
    environment: { windMs: 6, windDirDeg: 180, visibility: 0.3, turbulence: 0.2, tempDeviationC: -3, events: [] },
    creditReward: 1800,
    xpReward: 350,
    difficulty: 4,
    hint: 'Stability matters when you can barely see. A conventional tail is most predictable.',
  },
];

// ---------------------------------------------------------------------------

/** Get missions filtered by category */
export function getMissionsByCategory(category: FunMission['category']): FunMission[] {
  return FUN_MISSIONS.filter(m => m.category === category);
}

/** Evaluate if a flight result meets a mission objective */
export function evaluateObjective(
  obj: MissionObjective,
  flightStats: Record<string, number>,
): boolean {
  const val = flightStats[obj.parameter] ?? 0;
  switch (obj.comparison) {
    case 'gte': return val >= obj.value;
    case 'lte': return val <= obj.value;
    case 'eq': return Math.abs(val - obj.value) < 0.01;
    default: return false;
  }
}

/** Compute final mission result */
export function computeMissionResult(
  mission: FunMission,
  flightStats: Record<string, number>,
): MissionResult {
  const objectivesMet = mission.objectives.filter(o => evaluateObjective(o, flightStats)).length;
  const completed = objectivesMet === mission.objectives.length;

  let creditsEarned = completed ? mission.creditReward : 0;
  let xpEarned = completed ? mission.xpReward : 0;

  // Bonus credits for each objective met
  for (const obj of mission.objectives) {
    if (evaluateObjective(obj, flightStats)) {
      creditsEarned += obj.bonusCredits;
    }
  }

  // Grade
  const pct = objectivesMet / mission.objectives.length;
  const grade: MissionResult['grade'] =
    pct >= 1 ? 'S' :
    pct >= 0.8 ? 'A' :
    pct >= 0.6 ? 'B' :
    pct >= 0.4 ? 'C' :
    pct >= 0.2 ? 'D' : 'F';

  return {
    missionId: mission.id,
    completed,
    objectivesMet,
    totalObjectives: mission.objectives.length,
    creditsEarned,
    xpEarned,
    fuelUsedKg: flightStats.fuelUsedKg ?? 0,
    maxSpeedMs: flightStats.maxSpeed ?? 0,
    distanceTraveledKm: flightStats.distance ?? 0,
    eventsEncountered: [],
    grade,
  };
}

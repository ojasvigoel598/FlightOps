// Chapter progression system based on Sadraey's Aircraft Design.
// Each chapter has missions, learning objectives, and unlock criteria.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Chapter {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  /** Sadraey chapter reference */
  sadraeyRef: string;
  /** Learning objectives */
  objectives: string[];
  /** Missions in this chapter */
  missions: Mission[];
  /** Concepts introduced at this level */
  concepts: string[];
  /** Unlock criteria — null = always available */
  unlockCriteria: null | { chapter: number; missionsCompleted: number };
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  /** Engineering requirements the student must meet */
  requirements: MissionRequirement[];
  /** What the student learns by completing this */
  learningOutcome: string;
  /** Difficulty 1-5 */
  difficulty: number;
  /** Estimated time in minutes */
  estimatedMinutes: number;
}

export interface MissionRequirement {
  parameter: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  targetValue?: number;
  /** Human-readable description */
  description: string;
}

// ---------------------------------------------------------------------------
// Student progress
// ---------------------------------------------------------------------------

export interface StudentProgress {
  /** Current chapter (1-12) */
  currentChapter: number;
  /** Completed missions: chapterId.missionId */
  completedMissions: Set<string>;
  /** Rank / title */
  rank: string;
  /** Total engineering credits earned */
  credits: number;
  /** Predictions made correctly */
  correctPredictions: number;
  /** Total predictions attempted */
  totalPredictions: number;
  /** Engineering notebook entries */
  notebookEntries: NotebookEntry[];
}

export interface NotebookEntry {
  chapter: number;
  mission: string;
  timestamp: number;
  decision: string;
  predictedEffect: string;
  actualResult: string;
  lesson: string;
}

// ---------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------

export const RANKS = [
  { minCredits: 0, title: 'Apprentice Aircraft Designer', icon: '🎓' },
  { minCredits: 500, title: 'Junior Aerodynamicist', icon: '✈️' },
  { minCredits: 1500, title: 'Aircraft Configuration Engineer', icon: '🔧' },
  { minCredits: 3000, title: 'Preliminary Design Engineer', icon: '📐' },
  { minCredits: 5000, title: 'Flight Dynamics Engineer', icon: '🛩️' },
  { minCredits: 8000, title: 'Aircraft Design Engineer', icon: '🏅' },
  { minCredits: 12000, title: 'Lead Aircraft Designer', icon: '👨‍✈️' },
];

export function getRank(credits: number): string {
  let rank = RANKS[0].title;
  for (const r of RANKS) {
    if (credits >= r.minCredits) rank = r.title;
  }
  return rank;
}

// ---------------------------------------------------------------------------
// All 12 chapters
// ---------------------------------------------------------------------------

export const CHAPTERS: Chapter[] = [
  // ---- Chapter 1 ----
  {
    id: 1,
    title: 'Aircraft Design Fundamentals',
    subtitle: 'Your first mission as a junior designer',
    description: 'You have been hired as the junior aircraft designer. Learn the fundamentals: requirements, constraints, feasibility, and the design loop.',
    sadraeyRef: 'Sadraey Ch. 1 — Introduction to Aircraft Design',
    objectives: [
      'Understand what aircraft design means',
      'Learn to read mission requirements',
      'Understand that design is a loop: synthesise → analyse → evaluate → decide',
      'Make your first feasibility assessment',
    ],
    missions: [
      {
        id: '1.1-first-aircraft',
        name: 'The First Aircraft',
        description: 'Design a basic aircraft to carry 4 passengers over 200 km. You start with limited knowledge — learn as you go.',
        requirements: [
          { parameter: 'payload', unit: 'kg', minValue: 240, description: 'Carry at least 4 passengers (60 kg each)' },
          { parameter: 'range', unit: 'km', minValue: 200, description: 'Fly at least 200 km' },
          { parameter: 'takeoffDistance', unit: 'm', maxValue: 1200, description: 'Take off within 1200 m' },
          { parameter: 'landingSpeed', unit: 'm/s', maxValue: 45, description: 'Land safely under 45 m/s' },
        ],
        learningOutcome: 'Design is a loop: you must satisfy ALL requirements simultaneously, not just one.',
        difficulty: 1,
        estimatedMinutes: 15,
      },
      {
        id: '1.2-trade-off',
        name: 'The First Trade-Off',
        description: 'Your first design was too heavy. Reduce weight without losing range.',
        requirements: [
          { parameter: 'mtow', unit: 'kg', maxValue: 2500, description: 'Keep MTOW under 2500 kg' },
          { parameter: 'range', unit: 'km', minValue: 200, description: 'Still fly 200 km' },
          { parameter: 'payload', unit: 'kg', minValue: 240, description: 'Keep the passengers' },
        ],
        learningOutcome: 'Every design change has consequences. Lighter structures may mean less payload.',
        difficulty: 2,
        estimatedMinutes: 15,
      },
    ],
    concepts: ['requirements', 'constraints', 'feasibility', 'design loop', 'trade-offs'],
    unlockCriteria: null,
  },

  // ---- Chapter 2 ----
  {
    id: 2,
    title: 'Systems Engineering Approach',
    subtitle: 'Manage a design programme',
    description: 'Learn that an aircraft is a system of systems. Manage requirements, functions, subsystems, and interfaces.',
    sadraeyRef: 'Sadraey Ch. 2 — Systems Engineering Approach',
    objectives: [
      'Understand aircraft as a system of subsystems',
      'Learn requirements analysis and functional decomposition',
      'Manage conflicting requirements',
      'Understand design reviews',
    ],
    missions: [
      {
        id: '2.1-subsystems',
        name: 'The Subsystem Challenge',
        description: 'Your aircraft needs wing, fuselage, tail, propulsion, and avionics — all working together. Increase range without increasing MTOW.',
        requirements: [
          { parameter: 'range', unit: 'km', minValue: 400, description: 'Increase range to 400 km' },
          { parameter: 'mtow', unit: 'kg', maxValue: 2500, description: 'Without increasing MTOW' },
          { parameter: 'allSubsystemsPresent', unit: '', description: 'All major subsystems defined' },
        ],
        learningOutcome: 'Aircraft components cannot be designed independently. Changes propagate through the system.',
        difficulty: 2,
        estimatedMinutes: 20,
      },
    ],
    concepts: ['systems engineering', 'subsystems', 'interfaces', 'trade studies', 'design reviews'],
    unlockCriteria: { chapter: 1, missionsCompleted: 1 },
  },

  // ---- Chapter 3 ----
  {
    id: 3,
    title: 'Conceptual Design',
    subtitle: 'Choose your aircraft configuration',
    description: 'Construct an aircraft configuration — wing, tail, fuselage, propulsion. See it assembled in 3D.',
    sadraeyRef: 'Sadraey Ch. 3 — Aircraft Conceptual Design',
    objectives: [
      'Select a wing configuration',
      'Select a tail configuration',
      'Select a propulsion configuration',
      'Assemble the aircraft visually in 3D',
      'Match configuration to mission',
    ],
    missions: [
      {
        id: '3.1-interceptor',
        name: 'High-Speed Interceptor',
        description: 'Design an aircraft that can reach Mach 0.85. What configuration is best?',
        requirements: [
          { parameter: 'maxSpeed', unit: 'Mach', minValue: 0.85, description: 'Reach Mach 0.85' },
          { parameter: 'takeoffDistance', unit: 'm', maxValue: 1500, description: 'Take off within 1500 m' },
        ],
        learningOutcome: 'High-speed missions favour swept wings, low drag, powerful engines — but these hurt low-speed performance.',
        difficulty: 3,
        estimatedMinutes: 25,
      },
      {
        id: '3.2-transport',
        name: 'Short-Haul Transport',
        description: 'Design an aircraft to carry 50 passengers 500 km.',
        requirements: [
          { parameter: 'payload', unit: 'kg', minValue: 4000, description: 'Carry 50 passengers (80 kg each)' },
          { parameter: 'range', unit: 'km', minValue: 500, description: 'Fly 500 km' },
          { parameter: 'comfort', unit: '', description: 'Landing speed under 60 m/s' },
        ],
        learningOutcome: 'Transport aircraft prioritise efficiency and passenger comfort. Different configuration than the interceptor.',
        difficulty: 3,
        estimatedMinutes: 25,
      },
      {
        id: '3.3-surveillance',
        name: 'Long-Endurance Surveillance',
        description: 'Design an aircraft that can loiter for 8 hours.',
        requirements: [
          { parameter: 'endurance', unit: 'hours', minValue: 8, description: 'Loiter for 8 hours' },
          { parameter: 'altitude', unit: 'm', minValue: 3000, description: 'At 3000 m altitude' },
        ],
        learningOutcome: 'Endurance missions favour high aspect ratio, efficient engines, and lightweight structures.',
        difficulty: 3,
        estimatedMinutes: 25,
      },
    ],
    concepts: ['configuration', 'wing position', 'tail type', 'propulsion type', 'layout'],
    unlockCriteria: { chapter: 2, missionsCompleted: 1 },
  },

  // ---- Chapter 4 ----
  {
    id: 4,
    title: 'Preliminary Design',
    subtitle: 'Make it quantitative',
    description: 'Move from qualitative choices to numbers: MTOW, wing area, wing loading, thrust loading. The matching plot becomes your design tool.',
    sadraeyRef: 'Sadraey Ch. 4 — Preliminary Design',
    objectives: [
      'Understand MTOW estimation',
      'Learn wing loading and thrust loading',
      'Create a matching plot',
      'Size the wing and engine',
    ],
    missions: [
      {
        id: '4.1-sizing',
        name: 'First Sizing',
        description: 'Size a wing and engine for your aircraft from Chapter 3. Meet all performance requirements.',
        requirements: [
          { parameter: 'stallSpeed', unit: 'm/s', maxValue: 40, description: 'Stall speed under 40 m/s' },
          { parameter: 'takeoffDistance', unit: 'm', maxValue: 1200, description: 'Take off within 1200 m' },
          { parameter: 'climbRate', unit: 'm/s', minValue: 3, description: 'Climb at 3+ m/s' },
        ],
        learningOutcome: 'Wing loading (W/S) and thrust loading (T/W) together determine whether your aircraft can fly.',
        difficulty: 3,
        estimatedMinutes: 25,
      },
    ],
    concepts: ['MTOW', 'wing loading', 'thrust loading', 'matching plot', 'sizing'],
    unlockCriteria: { chapter: 3, missionsCompleted: 1 },
  },

  // ---- Chapter 5 ----
  {
    id: 5,
    title: 'Wing Design',
    subtitle: 'The most important component',
    description: 'Design the wing in detail: aspect ratio, sweep, taper, twist, airfoil, dihedral. See the effects in 3D and in flight.',
    sadraeyRef: 'Sadraey Ch. 5 — Wing Design',
    objectives: [
      'Understand aspect ratio and its effect on induced drag',
      'Design sweep for speed',
      'Choose taper and twist for load distribution',
      'Select airfoil sections',
      'Design high-lift devices',
    ],
    missions: [
      {
        id: '5.1-speed-trap',
        name: 'Break the Sound Barrier',
        description: 'Your aircraft needs to reach Mach 0.9. Modify wing sweep and airfoil to achieve it.',
        requirements: [
          { parameter: 'maxSpeed', unit: 'Mach', minValue: 0.9, description: 'Reach Mach 0.9' },
          { parameter: 'takeoffDistance', unit: 'm', maxValue: 1500, description: 'Still take off safely' },
        ],
        learningOutcome: 'Sweep delays compressibility effects but reduces low-speed CL slope. This is the fundamental swept-wing trade-off.',
        difficulty: 4,
        estimatedMinutes: 20,
      },
      {
        id: '5.2-efficiency',
        name: 'Maximum Efficiency',
        description: 'Achieve L/D > 15 by optimising aspect ratio and wing geometry.',
        requirements: [
          { parameter: 'maxLd', unit: '', minValue: 15, description: 'L/D ratio above 15' },
          { parameter: 'range', unit: 'km', minValue: 800, description: 'Fly 800 km' },
        ],
        learningOutcome: 'Higher aspect ratio reduces induced drag, but increases structural weight. Gliders use AR > 15; fighters use AR < 4.',
        difficulty: 4,
        estimatedMinutes: 20,
      },
    ],
    concepts: ['aspect ratio', 'sweep', 'taper', 'twist', 'dihedral', 'airfoil', 'high-lift', 'ailerons'],
    unlockCriteria: { chapter: 4, missionsCompleted: 1 },
  },

  // ---- Chapter 6 ----
  {
    id: 6,
    title: 'Tail Design',
    subtitle: 'Stability and control',
    description: 'Design the tail for stability and trim. See how the aircraft responds to disturbances.',
    sadraeyRef: 'Sadraey Ch. 6 — Tail Design',
    objectives: [
      'Understand longitudinal stability',
      'Design horizontal and vertical tail',
      'Learn tail volume coefficients',
      'Understand static margin',
      'Compare tail configurations',
    ],
    missions: [
      {
        id: '6.1-gust-response',
        name: 'The Gust',
        description: 'Your aircraft encounters a gust. Adjust tail design to maintain stable flight.',
        requirements: [
          { parameter: 'staticMargin', unit: '%MAC', minValue: 5, description: 'Static margin 5-15% MAC' },
          { parameter: 'pitchOscillation', unit: 'degrees', maxValue: 5, description: 'Pitch deviation under 5°' },
        ],
        learningOutcome: 'Static margin determines longitudinal stability. Too little = unstable. Too much = sluggish control.',
        difficulty: 4,
        estimatedMinutes: 20,
      },
      {
        id: '6.2-tail-config',
        name: 'Tail Configuration Showdown',
        description: 'Compare conventional, T-tail, V-tail, and canard. Which is best for your mission?',
        requirements: [
          { parameter: 'missionFeasible', unit: '', description: 'Mission must be achievable' },
          { parameter: 'stability', unit: '', description: 'Must be statically stable' },
        ],
        learningOutcome: 'Different tail configurations have different trade-offs in stability, drag, weight, and control authority.',
        difficulty: 4,
        estimatedMinutes: 25,
      },
    ],
    concepts: ['static margin', 'tail volume', 'trim', 'longitudinal stability', 'directional stability'],
    unlockCriteria: { chapter: 5, missionsCompleted: 1 },
  },

  // ---- Chapter 7 ----
  {
    id: 7,
    title: 'Fuselage Design',
    subtitle: 'The body of the aircraft',
    description: 'Design the fuselage: length, diameter, cabin arrangement. Fit payload while keeping drag low.',
    sadraeyRef: 'Sadraey Ch. 7 — Fuselage Design',
    objectives: [
      'Understand fineness ratio and drag',
      'Size the fuselage for payload',
      'Understand wetted area',
      'Balance internal arrangement',
    ],
    missions: [
      {
        id: '7.1-passenger-fit',
        name: 'Passenger Cabin',
        description: 'Fit 50 passengers in a fuselage with minimum drag.',
        requirements: [
          { parameter: 'passengers', unit: '', minValue: 50, description: 'Carry 50 passengers' },
          { parameter: 'finenessRatio', unit: '', minValue: 6, maxValue: 12, description: 'Fineness ratio 6-12' },
          { parameter: 'cd0Increase', unit: '', maxValue: 0.005, description: 'Fuselage drag penalty under 0.005' },
        ],
        learningOutcome: 'A long, thin fuselage has less drag (lower fineness ratio penalty), but may be structurally challenging.',
        difficulty: 3,
        estimatedMinutes: 20,
      },
    ],
    concepts: ['fineness ratio', 'wetted area', 'cabin arrangement', 'payload volume'],
    unlockCriteria: { chapter: 6, missionsCompleted: 1 },
  },

  // ---- Chapter 8 ----
  {
    id: 8,
    title: 'Propulsion System Design',
    subtitle: 'Powering the aircraft',
    description: 'Select and size the propulsion system. Understand thrust, power, fuel consumption, and engine-out behaviour.',
    sadraeyRef: 'Sadraey Ch. 8 — Propulsion System Design',
    objectives: [
      'Match engine to mission requirements',
      'Understand SFC and fuel burn',
      'Size fuel tanks',
      'Consider engine-out performance',
    ],
    missions: [
      {
        id: '8.1-engine-select',
        name: 'Engine Selection',
        description: 'Choose between piston, turboprop, turbofan, and electric for your aircraft.',
        requirements: [
          { parameter: 'missionFeasible', unit: '', description: 'Complete the mission' },
          { parameter: 'fuelMargin', unit: '%', minValue: 10, description: 'At least 10% fuel reserve' },
        ],
        learningOutcome: 'No engine type is universally best. The right choice depends on speed, range, and operating environment.',
        difficulty: 3,
        estimatedMinutes: 20,
      },
    ],
    concepts: ['thrust', 'power', 'SFC', 'fuel consumption', 'engine-out', 'propulsion matching'],
    unlockCriteria: { chapter: 7, missionsCompleted: 1 },
  },

  // ---- Chapter 9 ----
  {
    id: 9,
    title: 'Landing Gear Design',
    subtitle: 'Getting on and off the ground',
    description: 'Design the landing gear: tricycle configuration, gear placement, braking, crosswind handling.',
    sadraeyRef: 'Sadraey Ch. 9 — Landing Gear Design',
    objectives: [
      'Choose gear configuration',
      'Size gear for ground handling',
      'Understand overturn risk',
      'Design braking performance',
    ],
    missions: [
      {
        id: '9.1-landing-challenge',
        name: 'Crosswind Landing',
        description: 'Land safely in a 15-knot crosswind.',
        requirements: [
          { parameter: 'landingDistance', unit: 'm', maxValue: 1000, description: 'Stop within 1000 m' },
          { parameter: 'crosswindComponent', unit: 'kts', minValue: 15, description: 'Handle 15 kt crosswind' },
        ],
        learningOutcome: 'Landing gear placement affects ground handling, overturn risk, and crosswind capability.',
        difficulty: 4,
        estimatedMinutes: 20,
      },
    ],
    concepts: ['tricycle gear', 'track', 'wheelbase', 'braking', 'crosswind', 'ground handling'],
    unlockCriteria: { chapter: 8, missionsCompleted: 1 },
  },

  // ---- Chapter 10 ----
  {
    id: 10,
    title: 'Weight of Components',
    subtitle: 'Every decision has a weight penalty',
    description: 'Understand weight breakdown. Every design decision adds weight, which requires more lift, which requires more thrust, which requires more fuel.',
    sadraeyRef: 'Sadraey Ch. 10 — Weight of Components',
    objectives: [
      'Understand the weight spiral',
      'Estimate component weights',
      'Optimise weight through material and configuration choices',
      'See weight consequences in real-time',
    ],
    missions: [
      {
        id: '10.1-weight-spiral',
        name: 'The Weight Spiral',
        description: 'Your aircraft is too heavy. Break the weight spiral by making smarter design choices.',
        requirements: [
          { parameter: 'mtow', unit: 'kg', maxValue: 5000, description: 'MTOW under 5000 kg' },
          { parameter: 'payloadFraction', unit: '%', minValue: 20, description: 'Payload fraction above 20%' },
        ],
        learningOutcome: 'The weight spiral: heavier → more lift → bigger wing → heavier → more fuel → heavier. Break it through smart design.',
        difficulty: 5,
        estimatedMinutes: 25,
      },
    ],
    concepts: ['weight spiral', 'statistical weight', 'material selection', 'weight fraction'],
    unlockCriteria: { chapter: 9, missionsCompleted: 1 },
  },

  // ---- Chapter 11 ----
  {
    id: 11,
    title: 'Weight Distribution',
    subtitle: 'Where the CG matters',
    description: 'Place the CG correctly. Move payload and fuel to see stability consequences.',
    sadraeyRef: 'Sadraey Ch. 11 — Aircraft Weight Distribution',
    objectives: [
      'Understand CG and its effect on stability',
      'Place payload and fuel',
      'Compute CG travel',
      'Stay within the CG envelope',
    ],
    missions: [
      {
        id: '11.1-cg-envelope',
        name: 'CG Envelope Challenge',
        description: 'Load the aircraft with different payloads and fuel loads. Keep the CG within the safe envelope for all loading conditions.',
        requirements: [
          { parameter: 'cgForward', unit: '%MAC', minValue: 10, description: 'CG forward limit 10% MAC' },
          { parameter: 'cgAft', unit: '%MAC', maxValue: 40, description: 'CG aft limit 40% MAC' },
          { parameter: 'allLoadingConditions', unit: '', description: 'Safe in all loading conditions' },
        ],
        learningOutcome: 'CG position affects stability, control, and trim. An aircraft must be safe across all loading conditions.',
        difficulty: 5,
        estimatedMinutes: 25,
      },
    ],
    concepts: ['CG', 'neutral point', 'CG envelope', 'loading conditions', 'trim drag'],
    unlockCriteria: { chapter: 10, missionsCompleted: 1 },
  },

  // ---- Chapter 12 ----
  {
    id: 12,
    title: 'Control Surfaces',
    subtitle: 'Fly the aircraft',
    description: 'Add control surfaces and actually fly the aircraft. Test your design in a real flight mission.',
    sadraeyRef: 'Sadraey Ch. 12 — Design of Control Surfaces',
    objectives: [
      'Size elevator, rudder, and ailerons',
      'Understand control authority',
      'Fly the aircraft through a mission',
      'Experience roll, pitch, and yaw',
    ],
    missions: [
      {
        id: '12.1-final-flight',
        name: 'Final Flight Test',
        description: 'Your complete aircraft design. Take off, fly the mission, and land safely. Everything you have learned comes together.',
        requirements: [
          { parameter: 'missionComplete', unit: '', description: 'Complete the full mission' },
          { parameter: 'landingSafe', unit: '', description: 'Land safely within limits' },
          { parameter: 'allSystemsFunctional', unit: '', description: 'All systems operational' },
        ],
        learningOutcome: 'Aircraft design is an integrated process. Every component affects every other. You designed this aircraft.',
        difficulty: 5,
        estimatedMinutes: 30,
      },
    ],
    concepts: ['elevator', 'rudder', 'aileron', 'flaps', 'control authority', 'coordinated flight'],
    unlockCriteria: { chapter: 11, missionsCompleted: 1 },
  },
];

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

export function createInitialProgress(): StudentProgress {
  return {
    currentChapter: 1,
    completedMissions: new Set(),
    rank: RANKS[0].title,
    credits: 0,
    correctPredictions: 0,
    totalPredictions: 0,
    notebookEntries: [],
  };
}

export function isChapterUnlocked(chapter: Chapter, progress: StudentProgress): boolean {
  if (!chapter.unlockCriteria) return true;
  const { chapter: reqChapter, missionsCompleted } = chapter.unlockCriteria;
  const completed = CHAPTERS
    .find(c => c.id === reqChapter)
    ?.missions.filter(m => progress.completedMissions.has(`${reqChapter}.${m.id}`)).length ?? 0;
  return completed >= missionsCompleted;
}

export function completeMission(
  progress: StudentProgress,
  chapterId: number,
  missionId: string,
  creditsEarned: number,
  predictionCorrect?: boolean,
): StudentProgress {
  const key = `${chapterId}.${missionId}`;
  const newCompleted = new Set(progress.completedMissions);
  newCompleted.add(key);

  const newCredits = progress.credits + creditsEarned;
  const correctPredictions = progress.correctPredictions + (predictionCorrect ? 1 : 0);
  const totalPredictions = progress.totalPredictions + (predictionCorrect !== undefined ? 1 : 0);

  // Advance chapter if all missions in current chapter completed
  const currentChapter = CHAPTERS.find(c => c.id === chapterId);
  const allMissionsDone = currentChapter?.missions.every(m => newCompleted.has(`${chapterId}.${m.id}`)) ?? false;
  const nextChapter = allMissionsDone && chapterId < 12 ? chapterId + 1 : chapterId;

  return {
    ...progress,
    completedMissions: newCompleted,
    currentChapter: nextChapter,
    rank: getRank(newCredits),
    credits: newCredits,
    correctPredictions,
    totalPredictions,
  };
}

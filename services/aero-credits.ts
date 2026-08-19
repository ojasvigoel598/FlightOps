// Flight Ops — Aero Credits game loop.
//
// The progression system rewards engineering understanding, not grinding.
// Students earn credits by: completing missions, meeting requirements,
// efficient design, safe flight, and discovering better configurations.
// Credits unlock technology tiers that expose higher-fidelity analysis.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TechTier {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** What this tier unlocks */
  unlocks: string[];
  /** Prerequisite tier IDs */
  requires: string[];
  /** Icon name */
  icon: string;
}

export interface AeroCreditState {
  credits: number;
  totalEarned: number;
  unlockedTiers: string[];
  missionsFlown: number;
  bestLd: number;
  bestRange: number;
  designsExplored: number;
}

export interface RewardBreakdown {
  baseReward: number;
  efficiencyBonus: number;
  safetyBonus: number;
  payloadBonus: number;
  totalReward: number;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Technology tiers
// ---------------------------------------------------------------------------

export const TECH_TIERS: TechTier[] = [
  {
    id: 'basic-analysis',
    name: 'Basic Analysis',
    description: 'Standard aerodynamic analysis with empirical methods.',
    cost: 0,
    unlocks: ['empirical-cd0', 'basic-stall', 'simple-range'],
    requires: [],
    icon: 'calculator',
  },
  {
    id: 'lifting-line',
    name: 'Lifting-Line Theory',
    description: 'Prandtl lifting-line method for finite-wing analysis. Shows spanwise lift distribution and induced drag.',
    cost: 500,
    unlocks: ['llt-analysis', 'span-efficiency', 'downwash-visualisation'],
    requires: ['basic-analysis'],
    icon: 'chart-line',
  },
  {
    id: 'panel-method',
    name: 'Panel Method',
    description: 'Source-panel method for Cp distribution around arbitrary 2D airfoil shapes.',
    cost: 1200,
    unlocks: ['cp-distribution', 'velocity-field', 'pressure-visualisation'],
    requires: ['basic-analysis'],
    icon: 'grid',
  },
  {
    id: 'vlm',
    name: 'Vortex Lattice',
    description: 'Full 3D vortex lattice method for multi-surface analysis. Handles sweep, dihedral, and tail interactions.',
    cost: 2500,
    unlocks: ['vlm-analysis', 'multi-surface', 'interaction-effects'],
    requires: ['lifting-line'],
    icon: 'axis-x-arrow',
  },
  {
    id: 'unsteady',
    name: 'Unsteady Aerodynamics',
    description: 'Theodorsen C(k), Wagner function, and Duhamel superposition for oscillating airfoils.',
    cost: 3000,
    unlocks: ['theodorsen', 'wagner', 'flutter-screening'],
    requires: ['panel-method'],
    icon: 'wave',
  },
  {
    id: 'stability',
    name: 'Stability & Control',
    description: 'Static stability analysis, control authority, CG envelope, and trim analysis.',
    cost: 4000,
    unlocks: ['static-stability', 'control-authority', 'cg-envelope', 'trim-analysis'],
    requires: ['vlm'],
    icon: 'sigma',
  },
  {
    id: 'advanced-materials',
    name: 'Advanced Materials',
    description: 'Composite structures, weight reduction, and material optimisation.',
    cost: 1500,
    unlocks: ['composite-weight', 'material-database'],
    requires: ['basic-analysis'],
    icon: 'layers-triple',
  },
  {
    id: 'propulsion-sim',
    name: 'Propulsion Simulation',
    description: 'Engine maps, fuel flow modelling, and thrust matching.',
    cost: 2000,
    unlocks: ['engine-map', 'fuel-flow', 'thrust-matching'],
    requires: ['basic-analysis'],
    icon: 'cog',
  },
];

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

export function initialCreditState(): AeroCreditState {
  return {
    credits: 0,
    totalEarned: 0,
    unlockedTiers: ['basic-analysis'],
    missionsFlown: 0,
    bestLd: 0,
    bestRange: 0,
    designsExplored: 0,
  };
}

export function canUnlockTier(state: AeroCreditState, tierId: string): boolean {
  const tier = TECH_TIERS.find((t) => t.id === tierId);
  if (!tier) return false;
  if (state.unlockedTiers.includes(tierId)) return false;
  if (state.credits < tier.cost) return false;
  return tier.requires.every((req) => state.unlockedTiers.includes(req));
}

export function unlockTier(state: AeroCreditState, tierId: string): AeroCreditState | null {
  if (!canUnlockTier(state, tierId)) return null;
  const tier = TECH_TIERS.find((t) => t.id === tierId)!;
  return {
    ...state,
    credits: state.credits - tier.cost,
    unlockedTiers: [...state.unlockedTiers, tierId],
  };
}

// ---------------------------------------------------------------------------
// Mission rewards
// ---------------------------------------------------------------------------

/**
 * Compute the reward for completing a mission based on engineering merit.
 * Rewards efficient, safe, payload-carrying designs more than basic flights.
 */
export function computeReward(params: {
  rangeKm: number;
  requiredRangeKm: number;
  ld: number;
  safety: number;
  payloadKg: number;
  feasible: boolean;
  stallSpeedMs: number;
}): RewardBreakdown {
  const reasons: string[] = [];
  let baseReward = 0;
  let efficiencyBonus = 0;
  let safetyBonus = 0;
  let payloadBonus = 0;

  if (!params.feasible) {
    return { baseReward: 0, efficiencyBonus: 0, safetyBonus: 0, payloadBonus: 0, totalReward: 0, reasons: ['Mission not completed'] };
  }

  // Base reward for completing a mission
  baseReward = 100;
  reasons.push(`Mission completed: +${baseReward}`);

  // Efficiency bonus: higher L/D gives more credits
  if (params.ld > 8) {
    efficiencyBonus = Math.round((params.ld - 8) * 50);
    reasons.push(`L/D efficiency (${params.ld.toFixed(1)}): +${efficiencyBonus}`);
  }

  // Safety bonus
  if (params.safety > 70) {
    safetyBonus = Math.round((params.safety - 70) * 3);
    reasons.push(`Safety margin (${params.safety.toFixed(0)}%): +${safetyBonus}`);
  }

  // Payload bonus: more payload = more engineering challenge
  if (params.payloadKg > 100) {
    payloadBonus = Math.round(params.payloadKg * 0.05);
    reasons.push(`Payload carried (${params.payloadKg} kg): +${payloadBonus}`);
  }

  // Range completion bonus
  const rangeFraction = Math.min(1, params.rangeKm / params.requiredRangeKm);
  if (rangeFraction >= 1) {
    baseReward += 200;
    reasons.push('Range requirement met: +200');
  } else if (rangeFraction > 0.8) {
    baseReward += 100;
    reasons.push('Partial range completion: +100');
  }

  const totalReward = baseReward + efficiencyBonus + safetyBonus + payloadBonus;

  return { baseReward, efficiencyBonus, safetyBonus, payloadBonus, totalReward, reasons };
}

// ---------------------------------------------------------------------------
// Design scoring (for comparing old vs new)
// ---------------------------------------------------------------------------

export interface DesignComparison {
  oldScore: number;
  newScore: number;
  improvement: number;
  changes: string[];
}

export function compareDesigns(
  oldPerf: { rangeKm: number; maxLd: number; stallSpeedMs: number; cd0: number },
  newPerf: { rangeKm: number; maxLd: number; stallSpeedMs: number; cd0: number },
): DesignComparison {
  const oldScore = oldPerf.rangeKm * 0.3 + oldPerf.maxLd * 10 - oldPerf.stallSpeedMs * 2 - oldPerf.cd0 * 1000;
  const newScore = newPerf.rangeKm * 0.3 + newPerf.maxLd * 10 - newPerf.stallSpeedMs * 2 - newPerf.cd0 * 1000;
  const improvement = newScore - oldScore;

  const changes: string[] = [];
  if (newPerf.rangeKm > oldPerf.rangeKm) changes.push(`Range +${(newPerf.rangeKm - oldPerf.rangeKm).toFixed(0)} km`);
  else if (newPerf.rangeKm < oldPerf.rangeKm) changes.push(`Range ${(newPerf.rangeKm - oldPerf.rangeKm).toFixed(0)} km`);

  if (newPerf.maxLd > oldPerf.maxLd) changes.push(`L/D +${(newPerf.maxLd - oldPerf.maxLd).toFixed(1)}`);
  else if (newPerf.maxLd < oldPerf.maxLd) changes.push(`L/D ${(newPerf.maxLd - oldPerf.maxLd).toFixed(1)}`);

  if (newPerf.stallSpeedMs < oldPerf.stallSpeedMs) changes.push(`Stall -${(oldPerf.stallSpeedMs - newPerf.stallSpeedMs).toFixed(1)} m/s`);
  else if (newPerf.stallSpeedMs > oldPerf.stallSpeedMs) changes.push(`Stall +${(newPerf.stallSpeedMs - oldPerf.stallSpeedMs).toFixed(1)} m/s`);

  return { oldScore, newScore, improvement, changes };
}

// ---------------------------------------------------------------------------
// Educational explanations
// ---------------------------------------------------------------------------

export interface Explanation {
  title: string;
  simple: string;
  engineering: string;
  whatToChange: string;
}

const EXPLANATIONS: Record<string, Explanation> = {
  aspectRatio: {
    title: 'Aspect Ratio',
    simple: 'A long, skinny wing flies more efficiently than a short, stubby one — like a glider vs a fighter jet.',
    engineering:
      'Aspect ratio AR = b²/S. Higher AR reduces induced drag (CDi = CL²/(πeAR)). The trade-off: structural weight and翼tip bending moments increase with span. Typical values: trainers 6-8, gliders 15-30, jets 7-10.',
    whatToChange: 'Increase span while keeping area constant. Watch weight increase.',
  },
  wingLoading: {
    title: 'Wing Loading',
    simple: 'How much each square metre of wing has to carry. Lower = slower takeoff, higher = faster cruise.',
    engineering:
      'Wing loading W/S = mg/S (N/m²). Affects stall speed (VS ∝ √(W/S)), takeoff distance, and gust response. Low W/S: short field, good low-speed handling. High W/S: good cruise efficiency, rough-air penetration.',
    whatToChange: 'Increase wing area to reduce W/S, or reduce weight.',
  },
  staticMargin: {
    title: 'Static Margin',
    simple: 'How far forward the centre of gravity is ahead of the balance point. Positive = the aircraft naturally levels itself.',
    engineering:
      'Static margin = (x_NP - x_CG) / MAC. Positive values give longitudinal static stability. Too large: overly stable, heavy elevator loads. Too small or negative: unstable, requires active control. Typical: 5-15% MAC.',
    whatToChange: 'Move CG forward (add nose weight) or move tail aft.',
  },
  lOverD: {
    title: 'Lift-to-Drag Ratio (L/D)',
    simple: 'How efficiently the aircraft converts engine power into forward flight. Higher = farther on less fuel.',
    engineering:
      'Maximum L/D = 0.5√(πeAR/CD0). Determines cruise efficiency, range (Breguet: R ∝ V·L/D·η/TSFC), and glide performance. GA aircraft: 8-14, gliders: 30-60, jets: 15-20.',
    whatToChange: 'Reduce CD0 (cleaner aerodynamics) or increase AR (longer wings).',
  },
  stallSpeed: {
    title: 'Stall Speed',
    simple: 'The minimum speed the aircraft can fly. Below this, the wing stops generating enough lift and the aircraft drops.',
    engineering:
      'VS = √(2W/(ρS·CLmax)). Affected by weight, wing area, and maximum lift coefficient (which depends on airfoil and flaps). Safety regulations require adequate margin between VS and approach speed.',
    whatToChange: 'Increase CLmax (flaps, airfoil), increase wing area, or reduce weight.',
  },
};

export function getExplanation(key: string): Explanation | null {
  return EXPLANATIONS[key] ?? null;
}

export function getAllExplanationKeys(): string[] {
  return Object.keys(EXPLANATIONS);
}

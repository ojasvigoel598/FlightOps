// Chapter mission evaluation engine (B17).
//
// Checks whether the student's current aircraft design meets all the
// requirements for the active chapter mission. Returns detailed feedback
// on which requirements pass/fail and why.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvaluationResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Score 0-100 */
  score: number;
  /** Per-requirement results */
  requirements: RequirementResult[];
  /** Credits earned (0 if not passed) */
  creditsEarned: number;
  /** XP earned */
  xpEarned: number;
  /** Summary feedback */
  summary: string;
  /** Suggestions for improvement */
  suggestions: string[];
}

export interface RequirementResult {
  /** Parameter name */
  parameter: string;
  /** Requirement description */
  description: string;
  /** Whether this requirement is met */
  met: boolean;
  /** Current value */
  currentValue: number;
  /** Required value */
  requiredValue: number;
  /** Unit */
  unit: string;
  /** How far off (positive = over limit, negative = under limit) */
  margin: number;
  /** Human-readable status */
  status: string;
}

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

export interface AircraftMetrics {
  rangeKm: number;
  mtowKg: number;
  stallSpeedMs: number;
  cruiseSpeedMs: number;
  climbRateMs: number;
  takeoffDistanceM: number;
  landingSpeedMs: number;
  maxLd: number;
  staticMargin: number;
  aspectRatio: number;
  wingLoading: number;
  payloadKg: number;
  fuelKg: number;
  emptyMassKg: number;
}

export interface MissionRequirement {
  parameter: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  targetValue?: number;
  description: string;
}

/**
 * Evaluate the student's aircraft against mission requirements.
 */
export function evaluateMission(
  metrics: AircraftMetrics,
  requirements: MissionRequirement[],
  creditValue: number = 100,
): EvaluationResult {
  const results: RequirementResult[] = [];

  for (const req of requirements) {
    const currentValue = getMetricValue(metrics, req.parameter);
    if (currentValue === null) continue;

    let met = true;
    let margin = 0;
    let status = '';

    if (req.minValue !== undefined) {
      if (currentValue >= req.minValue) {
        margin = currentValue - req.minValue;
        status = `✅ ${currentValue.toFixed(1)} ≥ ${req.minValue} (margin: +${margin.toFixed(1)})`;
      } else {
        met = false;
        margin = currentValue - req.minValue;
        status = `❌ ${currentValue.toFixed(1)} < ${req.minValue} (shortfall: ${margin.toFixed(1)})`;
      }
    } else if (req.maxValue !== undefined) {
      if (currentValue <= req.maxValue) {
        margin = req.maxValue - currentValue;
        status = `✅ ${currentValue.toFixed(1)} ≤ ${req.maxValue} (margin: +${margin.toFixed(1)})`;
      } else {
        met = false;
        margin = currentValue - req.maxValue;
        status = `❌ ${currentValue.toFixed(1)} > ${req.maxValue} (excess: ${margin.toFixed(1)})`;
      }
    } else if (req.targetValue !== undefined) {
      const diff = Math.abs(currentValue - req.targetValue);
      if (diff < req.targetValue * 0.1) {
        met = true;
        status = `✅ ${currentValue.toFixed(1)} ≈ ${req.targetValue}`;
      } else {
        met = false;
        margin = currentValue - req.targetValue;
        status = `❌ ${currentValue.toFixed(1)} ≠ ${req.targetValue} (off by ${diff.toFixed(1)})`;
      }
    }

    results.push({
      parameter: req.parameter,
      description: req.description,
      met,
      currentValue,
      requiredValue: req.minValue ?? req.maxValue ?? req.targetValue ?? 0,
      unit: req.unit,
      margin,
      status,
    });
  }

  const allMet = results.every(r => r.met);
  const metCount = results.filter(r => r.met).length;
  const score = results.length > 0 ? Math.round((metCount / results.length) * 100) : 0;

  // Generate suggestions for failed requirements
  const suggestions: string[] = [];
  for (const r of results) {
    if (!r.met) {
      suggestions.push(generateSuggestion(r));
    }
  }

  const creditsEarned = allMet ? creditValue : Math.round(creditValue * score / 100);
  const xpEarned = allMet ? Math.round(creditValue * 0.5) : 0;

  const summary = allMet
    ? `All ${results.length} requirements met! Mission passed with ${score}% score.`
    : `${metCount}/${results.length} requirements met. Score: ${score}%. ${results.length - metCount} requirement(s) need attention.`;

  return {
    passed: allMet,
    score,
    requirements: results,
    creditsEarned,
    xpEarned,
    summary,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Metric extraction
// ---------------------------------------------------------------------------

function getMetricValue(metrics: AircraftMetrics, parameter: string): number | null {
  const map: Record<string, number> = {
    range: metrics.rangeKm,
    rangeKm: metrics.rangeKm,
    mtow: metrics.mtowKg,
    mtowKg: metrics.mtowKg,
    stallSpeed: metrics.stallSpeedMs,
    stallSpeedMs: metrics.stallSpeedMs,
    maxSpeed: metrics.cruiseSpeedMs,
    cruiseSpeed: metrics.cruiseSpeedMs,
    cruiseSpeedMs: metrics.cruiseSpeedMs,
    climbRate: metrics.climbRateMs,
    climbRateMs: metrics.climbRateMs,
    takeoffDistance: metrics.takeoffDistanceM,
    takeoffDist: metrics.takeoffDistanceM,
    landingSpeed: metrics.landingSpeedMs,
    maxLd: metrics.maxLd,
    staticMargin: metrics.staticMargin,
    aspectRatio: metrics.aspectRatio,
    wingLoading: metrics.wingLoading,
    payload: metrics.payloadKg,
    payloadKg: metrics.payloadKg,
    fuel: metrics.fuelKg,
    fuelKg: metrics.fuelKg,
    emptyMass: metrics.emptyMassKg,
  };
  return map[parameter] ?? null;
}

// ---------------------------------------------------------------------------
// Suggestion generation
// ---------------------------------------------------------------------------

function generateSuggestion(result: RequirementResult): string {
  const { parameter, currentValue, requiredValue, unit, margin } = result;

  if (parameter === 'range' || parameter === 'rangeKm') {
    if (margin < 0) {
      return `Range is ${Math.abs(margin).toFixed(0)} km short. Try: increase fuel capacity, improve L/D (higher aspect ratio), or reduce weight.`;
    }
  }

  if (parameter === 'stallSpeed' || parameter === 'stallSpeedMs') {
    if (margin > 0) {
      return `Stall speed is ${margin.toFixed(1)} m/s too high. Try: increase wing area, use a higher-lift airfoil (e.g. NACA 4412), or add flaps.`;
    }
  }

  if (parameter === 'takeoffDistance' || parameter === 'takeoffDist') {
    if (margin > 0) {
      return `Takeoff distance exceeds limit by ${margin.toFixed(0)} m. Try: increase wing area, add more powerful engine, or reduce takeoff weight.`;
    }
  }

  if (parameter === 'climbRate' || parameter === 'climbRateMs') {
    if (margin < 0) {
      return `Climb rate is ${Math.abs(margin).toFixed(1)} m/s too low. Try: increase engine power, reduce weight, or improve thrust-to-weight ratio.`;
    }
  }

  if (parameter === 'mtow' || parameter === 'mtowKg') {
    if (margin > 0) {
      return `MTOW exceeds limit by ${margin.toFixed(0)} kg. Try: reduce fuel load, use lighter materials, or downsize components.`;
    }
  }

  return `Requirement "${parameter}" is not met. Current: ${currentValue.toFixed(1)} ${unit}, Required: ${requiredValue.toFixed(1)} ${unit}. Adjust the design to satisfy this constraint.`;
}

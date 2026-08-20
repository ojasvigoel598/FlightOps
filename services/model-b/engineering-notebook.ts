// Engineering Notebook for Model B (B18).
//
// Automatically records every design decision the student makes:
//   - what parameter changed
//   - what the student predicted would happen
//   - what actually happened
//   - what was learned
//
// The notebook becomes an engineering design record by the end of the course.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotebookEntry {
  /** Timestamp */
  timestamp: number;
  /** Chapter this entry belongs to */
  chapterId: number;
  /** Mission name */
  missionName: string;
  /** What the student changed */
  change: DesignChange;
  /** What the student predicted (from prediction challenge) */
  prediction: string;
  /** Whether prediction was correct */
  predictionCorrect: boolean;
  /** What actually happened (computed result) */
  actualResult: string;
  /** Engineering insight / lesson */
  lesson: string;
}

export interface DesignChange {
  /** Parameter that changed */
  parameter: string;
  /** Old value */
  oldValue: number;
  /** New value */
  newValue: number;
  /** Unit */
  unit: string;
  /** Direction of change */
  direction: 'increased' | 'decreased' | 'unchanged';
}

export interface NotebookStats {
  totalEntries: number;
  correctPredictions: number;
  totalPredictions: number;
  accuracyPct: number;
  chaptersCovered: number[];
  parametersChanged: string[];
}

// ---------------------------------------------------------------------------
// State management (singleton in-memory for this session)
// ---------------------------------------------------------------------------

let _entries: NotebookEntry[] = [];

export function getNotebookEntries(): readonly NotebookEntry[] {
  return _entries;
}

export function addNotebookEntry(entry: NotebookEntry): void {
  _entries.push(entry);
}

export function clearNotebook(): void {
  _entries = [];
}

export function getNotebookStats(): NotebookStats {
  const correctPredictions = _entries.filter(e => e.predictionCorrect).length;
  const totalPredictions = _entries.filter(e => e.prediction.length > 0).length;
  const chaptersCovered = [...new Set(_entries.map(e => e.chapterId))].sort();
  const parametersChanged = [...new Set(_entries.map(e => e.change.parameter))];

  return {
    totalEntries: _entries.length,
    correctPredictions,
    totalPredictions,
    accuracyPct: totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0,
    chaptersCovered,
    parametersChanged,
  };
}

// ---------------------------------------------------------------------------
// Auto-generate insight based on change and result
// ---------------------------------------------------------------------------

export function generateInsight(change: DesignChange, resultDelta: { rangeDelta: number; stallDelta: number; ldDelta: number; weightDelta: number }): string {
  const { parameter, oldValue, newValue, direction } = change;
  const diff = Math.abs(newValue - oldValue);

  if (parameter === 'wingSpan' || parameter === 'spanM') {
    if (direction === 'increased') {
      return `Increasing span by ${diff.toFixed(0)} m raised the aspect ratio. This reduces induced drag (CDi ∝ 1/AR), improving L/D by ~${resultDelta.ldDelta.toFixed(1)}. However, structural weight increases with span².`;
    }
    return `Reducing span lowered the aspect ratio. Induced drag increases, reducing L/D. But the wing is now lighter and more manoeuvrable.`;
  }

  if (parameter === 'sweep' || parameter === 'sweepDeg') {
    if (direction === 'increased') {
      return `Sweep increased from ${oldValue}° to ${newValue}°. This delays compressibility (higher M_crit) but reduces low-speed CL slope. The wing needs more area or speed to generate the same lift.`;
    }
    return `Reducing sweep improves low-speed lift and reduces takeoff distance. But the aircraft will encounter compressibility effects at a lower Mach number.`;
  }

  if (parameter === 'wingArea' || parameter === 'areaM2') {
    if (direction === 'increased') {
      return `Larger wing area reduces wing loading (W/S), lowering stall speed and takeoff distance. But parasite drag increases proportionally.`;
    }
    return `Smaller wing area increases wing loading. The aircraft flies faster for the same thrust, but stall speed and takeoff distance increase.`;
  }

  if (parameter === 'aspectRatio') {
    return `Aspect ratio changed. Higher AR reduces induced drag but increases structural weight and span constraints. Gliders use AR > 15; fighters use AR < 4.`;
  }

  if (parameter === 'enginePower' || parameter === 'powerW') {
    if (direction === 'increased') {
      return `More power increases thrust-to-weight ratio. Climb rate improves, takeoff distance decreases. But fuel consumption may increase.`;
    }
    return `Less power reduces thrust. Climb performance degrades and takeoff distance increases. Check that the aircraft can still meet all requirements.`;
  }

  return `Changed ${parameter} from ${oldValue} to ${newValue} ${change.unit}. Observe how this affects the performance metrics above.`;
}

// ---------------------------------------------------------------------------
// Insight based on specific parameter changes (richer version)
// ---------------------------------------------------------------------------

export function generateRichInsight(
  change: DesignChange,
  perfBefore: { ld: number; stallSpeed: number; range: number; climbRate: number },
  perfAfter: { ld: number; stallSpeed: number; range: number; climbRate: number },
): string {
  const ldDelta = perfAfter.ld - perfBefore.ld;
  const stallDelta = perfAfter.stallSpeed - perfBefore.stallSpeed;
  const rangeDelta = perfAfter.range - perfBefore.range;
  const climbDelta = perfAfter.climbRate - perfBefore.climbRate;

  const parts: string[] = [];

  if (Math.abs(ldDelta) > 0.5) {
    parts.push(`L/D ${ldDelta > 0 ? 'improved' : 'decreased'} by ${Math.abs(ldDelta).toFixed(1)}`);
  }
  if (Math.abs(stallDelta) > 1) {
    parts.push(`stall speed ${stallDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(stallDelta).toFixed(1)} m/s`);
  }
  if (Math.abs(rangeDelta) > 50) {
    parts.push(`range ${rangeDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(rangeDelta).toFixed(0)} km`);
  }
  if (Math.abs(climbDelta) > 0.5) {
    parts.push(`climb rate ${climbDelta > 0 ? 'improved' : 'decreased'} by ${Math.abs(climbDelta).toFixed(1)} m/s`);
  }

  if (parts.length === 0) {
    return `No significant performance change detected. Try a larger parameter change to see the engineering effect.`;
  }

  return `Effect: ${parts.join(', ')}.`;
}

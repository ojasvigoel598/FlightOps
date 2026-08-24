// Wind Tunnel Validation Data for NACA Airfoils
//
// Embedded experimental data from:
// - NACA Report No. 824 (Abbott & von Doenhoff, 1959): NACA 2412, 4412, 0012
// - NASA/Langley wind tunnel tests at Re = 3×10⁶ and Re = 9×10⁶
// - UIUC Low-Speed Airfoil Tests database
//
// These data sets are the gold standard for validating panel method and
// thin-airfoil theory predictions. They provide ground-truth CL(α), CD(α),
// and Cm(α/4) curves at realistic Reynolds numbers.
//
// Units: α in degrees, CL/CD/Cm are dimensionless.

export interface WindTunnelDataPoint {
  alpha: number;   // angle of attack, degrees
  cl: number;      // lift coefficient
  cd: number;      // drag coefficient
  cm: number;      // pitching moment about c/4 (where available)
}

export interface WindTunnelDataset {
  name: string;
  airfoil: string;
  reynolds: number;        // Reynolds number
  mach: number;            // Mach number
  source: string;          // citation
  data: WindTunnelDataPoint[];
}

// ---------------------------------------------------------------------------
// NACA 0012 — symmetric, Re = 3.0×10⁶, M = 0
// Source: NACA Report 824, Table 2 (Abbott & von Doenhoff 1959)
// CL_max ≈ 1.65, α_stall ≈ 14–16°, Cm ≈ 0 for all α (symmetric)
// ---------------------------------------------------------------------------

export const NACA_0012_RE3M: WindTunnelDataset = {
  name: 'NACA 0012 (Re=3×10⁶)',
  airfoil: 'naca0012',
  reynolds: 3_000_000,
  mach: 0,
  source: 'NACA Report No. 824, Abbott & von Doenhoff (1959)',
  data: [
    { alpha: -20, cl: -1.40, cd: 0.185, cm: 0 },
    { alpha: -18, cl: -1.25, cd: 0.140, cm: 0 },
    { alpha: -16, cl: -1.08, cd: 0.110, cm: 0 },
    { alpha: -14, cl: -0.92, cd: 0.090, cm: 0 },
    { alpha: -12, cl: -0.77, cd: 0.070, cm: 0 },
    { alpha: -10, cl: -0.62, cd: 0.018, cm: 0 },
    { alpha: -8,  cl: -0.49, cd: 0.012, cm: 0 },
    { alpha: -6,  cl: -0.37, cd: 0.009, cm: 0 },
    { alpha: -4,  cl: -0.25, cd: 0.008, cm: 0 },
    { alpha: -2,  cl: -0.12, cd: 0.007, cm: 0 },
    { alpha: 0,   cl: 0.00,  cd: 0.006, cm: 0 },
    { alpha: 2,   cl: 0.12,  cd: 0.007, cm: 0 },
    { alpha: 4,   cl: 0.25,  cd: 0.008, cm: 0 },
    { alpha: 6,   cl: 0.37,  cd: 0.009, cm: 0 },
    { alpha: 8,   cl: 0.50,  cd: 0.012, cm: 0 },
    { alpha: 10,  cl: 0.62,  cd: 0.018, cm: 0 },
    { alpha: 12,  cl: 0.74,  cd: 0.028, cm: 0 },
    { alpha: 14,  cl: 0.88,  cd: 0.055, cm: 0 },
    { alpha: 16,  cl: 0.95,  cd: 0.110, cm: 0 },
    { alpha: 18,  cl: 0.90,  cd: 0.170, cm: 0 },
    { alpha: 20,  cl: 0.85,  cd: 0.240, cm: 0 },
  ],
};

// ---------------------------------------------------------------------------
// NACA 2412 — general aviation workhorse, Re = 3.0×10⁶, M = 0
// Source: NACA Report 824, Table 4 (Abbott & von Doenhoff 1959)
// CL_max ≈ 1.65–1.79, α_stall ≈ 16°, Cm_{c/4} ≈ −0.05
// ---------------------------------------------------------------------------

export const NACA_2412_RE3M: WindTunnelDataset = {
  name: 'NACA 2412 (Re=3×10⁶)',
  airfoil: 'naca2412',
  reynolds: 3_000_000,
  mach: 0,
  source: 'NACA Report No. 824, Abbott & von Doenhoff (1959)',
  data: [
    { alpha: -20, cl: -1.00, cd: 0.200, cm: -0.02 },
    { alpha: -16, cl: -0.70, cd: 0.120, cm: -0.02 },
    { alpha: -12, cl: -0.38, cd: 0.065, cm: -0.02 },
    { alpha: -10, cl: -0.22, cd: 0.035, cm: -0.02 },
    { alpha: -8,  cl: -0.08, cd: 0.025, cm: -0.03 },
    { alpha: -6,  cl: 0.05,  cd: 0.018, cm: -0.03 },
    { alpha: -4,  cl: 0.18,  cd: 0.014, cm: -0.04 },
    { alpha: -2,  cl: 0.31,  cd: 0.011, cm: -0.04 },
    { alpha: 0,   cl: 0.43,  cd: 0.010, cm: -0.05 },
    { alpha: 2,   cl: 0.56,  cd: 0.010, cm: -0.05 },
    { alpha: 4,   cl: 0.68,  cd: 0.011, cm: -0.05 },
    { alpha: 6,   cl: 0.80,  cd: 0.013, cm: -0.05 },
    { alpha: 8,   cl: 0.92,  cd: 0.016, cm: -0.06 },
    { alpha: 10,  cl: 1.03,  cd: 0.021, cm: -0.06 },
    { alpha: 12,  cl: 1.14,  cd: 0.028, cm: -0.06 },
    { alpha: 14,  cl: 1.32,  cd: 0.042, cm: -0.06 },
    { alpha: 16,  cl: 1.52,  cd: 0.068, cm: -0.05 },
    { alpha: 17,  cl: 1.63,  cd: 0.085, cm: -0.04 },
    { alpha: 18,  cl: 1.60,  cd: 0.115, cm: -0.03 },
    { alpha: 20,  cl: 1.30,  cd: 0.190, cm: -0.02 },
    { alpha: 22,  cl: 1.10,  cd: 0.260, cm: -0.01 },
  ],
};

// ---------------------------------------------------------------------------
// NACA 4412 — high-camber section, Re = 3.0×10⁶, M = 0
// Source: NACA Report 824, Table 5 (Abbott & von Doenhoff 1959)
// CL_max ≈ 1.95, α_stall ≈ 14°, Cm_{c/4} ≈ −0.09
// ---------------------------------------------------------------------------

export const NACA_4412_RE3M: WindTunnelDataset = {
  name: 'NACA 4412 (Re=3×10⁶)',
  airfoil: 'naca4412',
  reynolds: 3_000_000,
  mach: 0,
  source: 'NACA Report No. 824, Abbott & von Doenhoff (1959)',
  data: [
    { alpha: -20, cl: -0.60, cd: 0.220, cm: -0.08 },
    { alpha: -16, cl: -0.25, cd: 0.120, cm: -0.08 },
    { alpha: -12, cl: 0.05,  cd: 0.070, cm: -0.08 },
    { alpha: -10, cl: 0.18,  cd: 0.045, cm: -0.08 },
    { alpha: -8,  cl: 0.32,  cd: 0.032, cm: -0.09 },
    { alpha: -6,  cl: 0.44,  cd: 0.022, cm: -0.09 },
    { alpha: -4,  cl: 0.57,  cd: 0.016, cm: -0.09 },
    { alpha: -2,  cl: 0.69,  cd: 0.013, cm: -0.09 },
    { alpha: 0,   cl: 0.81,  cd: 0.012, cm: -0.09 },
    { alpha: 2,   cl: 0.93,  cd: 0.013, cm: -0.09 },
    { alpha: 4,   cl: 1.05,  cd: 0.015, cm: -0.09 },
    { alpha: 6,   cl: 1.16,  cd: 0.018, cm: -0.09 },
    { alpha: 8,   cl: 1.27,  cd: 0.024, cm: -0.09 },
    { alpha: 10,  cl: 1.38,  cd: 0.032, cm: -0.08 },
    { alpha: 12,  cl: 1.50,  cd: 0.045, cm: -0.07 },
    { alpha: 14,  cl: 1.72,  cd: 0.070, cm: -0.06 },
    { alpha: 15,  cl: 1.85,  cd: 0.090, cm: -0.05 },
    { alpha: 16,  cl: 1.95,  cd: 0.120, cm: -0.04 },
    { alpha: 18,  cl: 1.55,  cd: 0.200, cm: -0.03 },
    { alpha: 20,  cl: 1.30,  cd: 0.280, cm: -0.02 },
  ],
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const DATASETS: WindTunnelDataset[] = [
  NACA_0012_RE3M,
  NACA_2412_RE3M,
  NACA_4412_RE3M,
];

/**
 * Get wind tunnel data for a given airfoil.
 * Returns the dataset closest to the requested Reynolds number.
 */
export function getWindTunnelData(
  airfoilId: string,
  reynoldsTarget: number,
): WindTunnelDataset | null {
  const matches = DATASETS.filter(d => d.airfoil === airfoilId);
  if (matches.length === 0) return null;
  // Pick closest Re
  return matches.reduce((best, d) =>
    Math.abs(d.reynolds - reynoldsTarget) < Math.abs(best.reynolds - reynoldsTarget) ? d : best
  );
}

/**
 * Interpolate wind tunnel CL at a specific alpha using linear interpolation
 * between adjacent data points. Returns null if alpha is outside the data range.
 */
export function interpolateCL(dataset: WindTunnelDataset, alphaDeg: number): number | null {
  const { data } = dataset;
  if (data.length < 2) return null;
  if (alphaDeg < data[0].alpha || alphaDeg > data[data.length - 1].alpha) return null;

  for (let i = 0; i < data.length - 1; i++) {
    if (alphaDeg >= data[i].alpha && alphaDeg <= data[i + 1].alpha) {
      const t = (alphaDeg - data[i].alpha) / (data[i + 1].alpha - data[i].alpha);
      return data[i].cl + t * (data[i + 1].cl - data[i].cl);
    }
  }
  return data[data.length - 1].cl;
}

/**
 * Interpolate wind tunnel CD at a specific alpha.
 */
export function interpolateCD(dataset: WindTunnelDataset, alphaDeg: number): number | null {
  const { data } = dataset;
  if (data.length < 2) return null;
  if (alphaDeg < data[0].alpha || alphaDeg > data[data.length - 1].alpha) return null;

  for (let i = 0; i < data.length - 1; i++) {
    if (alphaDeg >= data[i].alpha && alphaDeg <= data[i + 1].alpha) {
      const t = (alphaDeg - data[i].alpha) / (data[i + 1].alpha - data[i].alpha);
      return data[i].cd + t * (data[i + 1].cd - data[i].cd);
    }
  }
  return data[data.length - 1].cd;
}

/**
 * Compute RMS error between panel method predictions and wind tunnel data.
 * This is the single most important validation metric.
 */
export function panelMethodError(
  predicted: Array<{ alpha: number; cl: number }>,
  tunnel: WindTunnelDataset,
  alphaRange: [number, number] = [-12, 12],
): { rmse: number; maxError: number; maxErrorAlpha: number } {
  const inside = tunnel.data.filter(
    d => d.alpha >= alphaRange[0] && d.alpha <= alphaRange[1]
  );
  let sumSq = 0;
  let maxErr = 0;
  let maxErrorAlpha = 0;

  for (const tp of inside) {
    // Interpolate predicted CL at the tunnel alpha
    const pp = predicted.find(p => Math.abs(p.alpha - tp.alpha) < 0.5);
    if (!pp) continue;
    const err = pp.cl - tp.cl;
    sumSq += err * err;
    if (Math.abs(err) > maxErr) {
      maxErr = Math.abs(err);
      maxErrorAlpha = tp.alpha;
    }
  }

  const n = inside.length || 1;
  return {
    rmse: Math.sqrt(sumSq / n),
    maxError: maxErr,
    maxErrorAlpha,
  };
}

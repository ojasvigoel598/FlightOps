// Flight Ops — Discrete unsteady vortex-panel method.
//
// A lightweight, self-contained 2D unsteady vortex method for a thin airfoil
// (the "unsteady panel / UVLM-lite" formulation of Katz & Plotkin, Low-Speed
// Aerodynamics, ch. 13.6, and the classical discrete-vortex starting-flow
// problem). It is the numerical counterpart of Wagner's theory: for a step
// change in angle of attack the circulation builds up through the shed wake,
// and CL(s)/2πα must track the Wagner function Φ(s).
//
// Model
// -----
// - N panels along the camber line (flat plate in the classic test): a bound
//   vortex at the quarter-chord of each panel, flow-tangency enforced at the
//   three-quarter-chord control points (the rear neutral point, which alone
//   recovers CL = 2πα in steady flow).
// - Each time step a wake vortex is shed from the trailing edge with strength
//   equal to minus the change in total bound circulation (Kelvin's theorem,
//   Γ_airfoil + Γ_wake = 0 from rest). The wake is the "starting vortex"
//   sheet; it convects downstream at the freestream speed and does not move
//   transversely (Wagner-theory assumption, as in Dawson & Brunton 2021).
// - Lift from the Kutta–Joukowski theorem: CL = −2·ΣΓ (chord-1 scaling,
//   V∞ = 1; positive lift ↔ clockwise/negative bound circulation).
//
// Validation (tests/unsteady-vortex.test.ts)
// - Kelvin's theorem: Γ_bound + Γ_wake ≈ 0 at every step (machine precision).
// - Step-response CL(s)/2πα tracks the exact Wagner function Φ(s) within a
//   few percent for s ≳ 2 and within ~1% at large s.
// - The long-time value matches the exact (not just Jones) Wagner function.
//
// Known limitation (documented, not hidden): for s ≲ 1 the discrete response
// lags the exact Wagner function. The exact Φ(0⁺) = 1/2 initial jump is
// produced by an infinitesimal vortex sheet at the trailing edge; a finite
// point vortex placed a finite distance behind the TE over-weights the near
// wake, so the discrete bound circulation builds up more slowly at first.
// This is a first-order artifact of the point-vortex wake discretisation,
// noted in the discrete-vortex-method literature (Katz & Plotkin §13.6) and
// consistent with the observation (Dawson & Brunton 2021) that early-time
// wake dynamics require a finer vortex representation than the flat-wake
// Wagner theory assumes.

export interface UnsteadyVortexStep {
  /** reduced time s = 2·V·t/c */
  s: number;
  /** lift coefficient */
  cl: number;
  /** total bound circulation (chord-1, V∞ = 1); steady flat plate: −πα */
  boundCirculation: number;
  /** total wake circulation */
  wakeCirculation: number;
  /** Kelvin residual Γ_bound + Γ_wake */
  kelvinResidual: number;
}

export interface UnsteadyVortexResult {
  steps: UnsteadyVortexStep[];
  /** final wake: { x (chord units), circulation } */
  wake: { x: number; circulation: number }[];
  /** maximum |Kelvin residual| over the run (should be ~0) */
  maxKelvinResidual: number;
  /** steady-state CL from the final step (≈ 2πα) */
  finalCl: number;
}

export interface UnsteadyVortexOptions {
  /** number of bound panels (default 16) */
  nPanels?: number;
  /** reduced-time step Δs = 2VΔt/c (default 0.05) */
  dtReduced?: number;
  /** number of time steps (default 400 → s_max = 20) */
  steps?: number;
  /** wake vortex shedding position, chord units behind the TE (default 0.02) */
  shedOffset?: number;
}

const TWO_PI = 2 * Math.PI;

export function unsteadyVortexStepResponse(
  alphaDeg: number,
  options: UnsteadyVortexOptions = {},
): UnsteadyVortexResult {
  if (!Number.isFinite(alphaDeg)) throw new Error('unsteady-vortex: alphaDeg must be finite');
  const alpha = (alphaDeg * Math.PI) / 180;
  const n = options.nPanels ?? 16;
  const ds = options.dtReduced ?? 0.05;
  const steps = options.steps ?? 400;
  const shed = options.shedOffset ?? 0.02;
  if (!Number.isInteger(n) || n < 4 || n > 128) throw new Error('unsteady-vortex: nPanels in [4, 128]');
  if (!Number.isFinite(ds) || ds <= 0 || ds > 0.5) throw new Error('unsteady-vortex: dtReduced in (0, 0.5]');
  if (!Number.isInteger(steps) || steps < 2 || steps > 20000) throw new Error('unsteady-vortex: steps in [2, 20000]');

  const dx = 1 / n;
  // Bound vortex and control-point positions (chord units, LE = 0, TE = 1).
  const xV: number[] = [];
  const xC: number[] = [];
  for (let i = 0; i < n; i += 1) {
    xV.push((i + 0.25) * dx);
    xC.push((i + 0.75) * dx);
  }

  // Influence matrix of the BOUND vortices: vertical velocity at control
  // point i from unit vortex j.
  const a: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    a.push(new Array<number>(n));
    for (let j = 0; j < n; j += 1) {
      a[i][j] = 1 / (TWO_PI * (xC[i] - xV[j]));
    }
  }

  const wakeX: number[] = [];
  const wakeG: number[] = [];
  const out: UnsteadyVortexStep[] = [];
  let maxKelvin = 0;

  for (let step = 0; step < steps; step += 1) {
    const s = (step + 1) * ds;

    // Advect the existing wake one step downstream (freestream convection).
    for (let w = 0; w < wakeX.length; w += 1) wakeX[w] += ds / 2;

    // The NEW wake vortex is solved IMPLICITLY together with the bound
    // circulation (Katz & Plotkin ch. 13.6 / UVLM): the augmented system is
    //   [A_bb  A_bw] [Γ_b  ]   [−sinα − w_oldWake]
    //   [1···1   1  ] [Γ_new] = [−Γ_oldWakeTotal  ]
    // where the last row enforces Kelvin's theorem exactly
    // (Γ_bound + Γ_wake = 0 from rest), which removes the explicit-shedding
    // feedback instability. The new vortex sits just behind the trailing edge.
    const xShed = 1 + shed;
    const size = n + 1;
    const mat: number[][] = [];
    const rhs = new Array<number>(size);
    let oldWakeTotal = 0;
    for (let w = 0; w < wakeX.length; w += 1) oldWakeTotal += wakeG[w];

    for (let i = 0; i < n; i += 1) {
      const row = new Array<number>(size);
      for (let j = 0; j < n; j += 1) row[j] = a[i][j];
      row[n] = 1 / (TWO_PI * (xC[i] - xShed));
      let wWake = 0;
      for (let w = 0; w < wakeX.length; w += 1) {
        wWake += wakeG[w] / (TWO_PI * (xC[i] - wakeX[w]));
      }
      rhs[i] = -Math.sin(alpha) - wWake;
      mat.push(row);
    }
    const kelvinRow = new Array<number>(size).fill(1);
    mat.push(kelvinRow);
    rhs[n] = -oldWakeTotal;

    const gamma = luSolve(luDecompose(mat), rhs);
    const boundTotal = gamma.slice(0, n).reduce((sum, g) => sum + g, 0);
    const shedG = gamma[n];
    wakeX.push(xShed);
    wakeG.push(shedG);

    const wakeTotal = oldWakeTotal + shedG;
    maxKelvin = Math.max(maxKelvin, Math.abs(boundTotal + wakeTotal));

    out.push({
      s,
      cl: -2 * boundTotal,
      boundCirculation: boundTotal,
      wakeCirculation: wakeTotal,
      kelvinResidual: boundTotal + wakeTotal,
    });
  }

  return {
    steps: out,
    wake: wakeX.map((x, w) => ({ x, circulation: wakeG[w] })),
    maxKelvinResidual: maxKelvin,
    finalCl: out.length > 0 ? out[out.length - 1].cl : 0,
  };
}

// ---------------------------------------------------------------------------
// Dense LU decomposition with partial pivoting (n ≤ 128 here)
// ---------------------------------------------------------------------------

interface Lu {
  lu: number[][];
  perm: number[];
}

function luDecompose(a: number[][]): Lu {
  const n = a.length;
  const lu = a.map((row) => [...row]);
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(lu[row][col]) > Math.abs(lu[pivot][col])) pivot = row;
    }
    if (Math.abs(lu[pivot][col]) < 1e-14) {
      throw new Error('unsteady-vortex: singular influence matrix (degenerate panel layout)');
    }
    if (pivot !== col) {
      const tmp = lu[col];
      lu[col] = lu[pivot];
      lu[pivot] = tmp;
      const tp = perm[col];
      perm[col] = perm[pivot];
      perm[pivot] = tp;
    }
    for (let row = col + 1; row < n; row += 1) {
      const f = lu[row][col] / lu[col][col];
      lu[row][col] = f;
      for (let k = col + 1; k < n; k += 1) lu[row][k] -= f * lu[col][k];
    }
  }
  return { lu, perm };
}

function luSolve({ lu, perm }: Lu, b: number[]): number[] {
  const n = b.length;
  const y = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    let sum = b[perm[i]];
    for (let j = 0; j < i; j += 1) sum -= lu[i][j] * y[j];
    y[i] = sum;
  }
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let sum = y[i];
    for (let j = i + 1; j < n; j += 1) sum -= lu[i][j] * x[j];
    x[i] = sum / lu[i][i];
  }
  return x;
}

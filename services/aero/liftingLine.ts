// Powered by OnSpace.AI
// Prandtl numerical lifting-line theory for finite wings.
//
// Formulation follows Prandtl's classical lifting-line theory as presented
// in Anderson, "Fundamentals of Aerodynamics" (5th ed.), ch. 5, and
// Katz & Plotkin, "Low-Speed Aerodynamics" (2nd ed., 2001), ch. 12. The
// bound circulation is expanded in a Fourier sine series over the span:
//
//   Gamma(theta) = 2 * b * V_inf * sum_{n=1..N} A_n * sin(n*theta),
//   y = (b/2) * cos(theta),   0 <= theta <= pi,
//
// with the wing tips (theta = 0, pi) excluded because the downwash integral
// is singular there. Substituting into the fundamental lifting-line
// equation (local section lift Gamma = (1/2) a0 c V alpha_eff) gives the
// linear system for the Fourier coefficients A_n:
//
//   [4*b/(a0*c_i)] * sum A_n sin(n theta_i)
//       + sum n*A_n sin(n theta_i) / sin(theta_i) = alpha - alpha_L0_i
//
// where the second sum is the local induced angle of attack (downwash) and
// the first term is the section lift at the effective angle. With V_inf = 1
// and area S = 2 * integral_0^{b/2} c(y) dy, aspect ratio AR = b^2/S:
//
//   C_L     = pi * AR * A_1
//   C_Di    = pi * AR * sum n*A_n^2          (induced drag)
//   e       = A_1^2 / sum n*A_n^2            (span efficiency, e = 1 ideal)
//   alpha_i = sum n*A_n sin(n theta)/sin(theta)   (local induced angle)
//
// Known limitation (documented, not hidden): classical lifting-line assumes
// thin 2-D sections aligned with the freestream, so sweep, dihedral, and
// section thickness effects are outside its scope. It is valid for
// high-aspect-ratio wings in attached flow within the linear range of the
// section polar. Fidelity: Level 2 (numerical lifting line).
//
// Validation: scripts/validate_aero.py ports this algorithm and checks it
// against the exact elliptical-wing solution (e = 1, uniform downwash,
// C_L_alpha = a0*AR/(AR+2)), the published span-efficiency range for
// rectangular wings, anti-symmetry, twist unloading, the AR -> inf limit
// toward the 2-D section slope a0, and N-convergence.

import { solveLinear } from './panel';

export type PlanformKind = 'rectangular' | 'elliptical' | 'taper';

export interface WingConfig {
  /** Wing span b [m]. */
  span: number;
  /** Root chord c_r [m]. */
  rootChord: number;
  /** Tip chord c_t [m] (ignored for elliptical planforms). */
  tipChord: number;
  /** Chord distribution along the span. */
  planform: PlanformKind;
  /** 2-D section lift-curve slope [per radian]; default 2*pi (thin airfoil). */
  sectionClAlpha?: number;
  /** Section zero-lift angle [deg]; default 0. */
  sectionAlphaL0?: number;
  /** Geometric twist at the tip [deg]; positive = washout (tip unloads). */
  twistDeg?: number;
  /** Number of spanwise stations (Fourier terms); default 40. */
  nStations?: number;
}

export interface LiftingLineStation {
  /** Spanwise coordinate y [m] (0 = centerline, b/2 = tip). */
  y: number;
  /** Non-dimensional span station y / (b/2). */
  eta: number;
  /** Fourier angle theta [rad]. */
  theta: number;
  /** Local chord [m]. */
  chord: number;
  /** Local geometric angle of attack [deg] (includes washout). */
  alphaDeg: number;
  /** Local circulation Gamma (nondimensional, per unit V_inf). */
  gamma: number;
  /** Local lift coefficient Cl = 2*Gamma / (c * V_inf). */
  cl: number;
  /** Local induced angle of attack [deg] (downwash). */
  alphaInducedDeg: number;
}

export interface LiftingLineResult {
  method: string;
  /** Wing planform area S [m^2]. */
  area: number;
  /** Aspect ratio AR = b^2 / S. */
  aspectRatio: number;
  /** Number of spanwise stations used. */
  nStations: number;
  /** Wing lift coefficient C_L. */
  cl: number;
  /** Induced drag coefficient C_Di (inviscid). */
  cdInduced: number;
  /** Span efficiency factor e (1 = ideal elliptical loading). */
  spanEfficiency: number;
  /** Wing lift-curve slope [per radian], finite difference. */
  clAlphaPerRad: number;
  /** Mean induced angle of attack [deg] across the stations. */
  alphaInducedAvgDeg: number;
  /** Fourier coefficients A_1..A_N. */
  coefficients: number[];
  /** Centerline circulation Gamma(0). */
  circulation0: number;
  /** Per-station spanwise data (full span, -b/2..+b/2, tip to tip). */
  stations: LiftingLineStation[];
}

function planformArea(cfg: WingConfig): number {
  const { span, rootChord, planform } = cfg;
  if (planform === 'rectangular') return span * rootChord;
  if (planform === 'elliptical') return (Math.PI * span * rootChord) / 4;
  return (span * (rootChord + cfg.tipChord)) / 2; // linear taper
}

/** Solve the lifting-line system once for a given geometric angle. */
function solveCoefficients(
  cfg: WingConfig,
  alphaDeg: number,
): { coeffs: number[]; theta: number[]; chord: number[]; y: number[] } {
  const b = cfg.span;
  const n = cfg.nStations ?? 40;
  const a0 = cfg.sectionClAlpha ?? 2 * Math.PI;
  const alphaL0Rad = ((cfg.sectionAlphaL0 ?? 0) * Math.PI) / 180;
  const twistRad = ((cfg.twistDeg ?? 0) * Math.PI) / 180;
  const alphaRad = (alphaDeg * Math.PI) / 180;

  const theta: number[] = [];
  const chord: number[] = [];
  const y: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    const th = (i * Math.PI) / (n + 1);
    const sinTh = Math.sin(th);
    theta.push(th);
    y.push(0.5 * b * Math.cos(th));
    if (cfg.planform === 'elliptical') {
      chord.push(cfg.rootChord * sinTh);
    } else if (cfg.planform === 'rectangular') {
      chord.push(cfg.rootChord);
    } else {
      const taper = cfg.tipChord / cfg.rootChord;
      chord.push(cfg.rootChord * (1 - (1 - taper) * Math.cos(th)));
    }
  }

  const A: number[][] = [];
  const rhs: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const row: number[] = [];
    const sinTh = Math.sin(theta[i]);
    for (let j = 0; j < n; j += 1) {
      const m = j + 1;
      const sinNth = Math.sin(m * theta[i]);
      row.push(((4 * b) / (a0 * chord[i])) * sinNth + (m * sinNth) / sinTh);
    }
    A.push(row);
    // Local geometric angle includes linear washout. The twist is a
    // function of |y| (symmetric across the span), and since y = (b/2)*cos
    // (theta) the symmetric form is eps = twist*|cos(theta)|: both tips get
    // the same reduction. (A plain cos(theta) is antisymmetric in theta and
    // would wash out one tip while washing in the other.)
    rhs.push(alphaRad - alphaL0Rad - twistRad * Math.abs(Math.cos(theta[i])));
  }

  return { coeffs: solveLinear(A, rhs), theta, chord, y };
}

/**
 * Solve Prandtl's lifting-line equations for a finite wing at one angle of
 * attack. Returns global coefficients plus the spanwise circulation/lift
 * distribution (half-span stations 0..b/2).
 */
export function solveLiftingLine(cfg: WingConfig, alphaDeg: number): LiftingLineResult {
  const b = cfg.span;
  const n = cfg.nStations ?? 40;
  if (!Number.isFinite(b) || b <= 0) throw new Error('span must be positive');
  if (!Number.isFinite(cfg.rootChord) || cfg.rootChord <= 0) {
    throw new Error('rootChord must be positive');
  }
  if (n < 3) throw new Error('nStations must be >= 3');

  const { coeffs, theta, chord, y } = solveCoefficients(cfg, alphaDeg);

  const area = planformArea(cfg);
  const ar = (b * b) / area;

  const sumNA2 = coeffs.reduce((s, a, i) => s + (i + 1) * a * a, 0);
  const cl = Math.PI * ar * coeffs[0];
  const cdInduced = Math.PI * ar * sumNA2;
  const spanEfficiency = sumNA2 > 0 ? (coeffs[0] * coeffs[0]) / sumNA2 : 1;

  // Lift-curve slope by finite difference (the system is linear in alpha,
  // so one extra solve is exact up to floating-point noise).
  const deltaDeg = 0.1;
  const { coeffs: coeffs2 } = solveCoefficients(cfg, alphaDeg + deltaDeg);
  const cl2 = Math.PI * ar * coeffs2[0];
  const clAlphaPerRad = (cl2 - cl) / ((deltaDeg * Math.PI) / 180);

  const stations: LiftingLineStation[] = [];
  let alphaInducedSum = 0;
  for (let i = 0; i < n; i += 1) {
    const sinTh = Math.sin(theta[i]);
    let gamma = 0;
    let alphaInduced = 0;
    for (let j = 0; j < n; j += 1) {
      const m = j + 1;
      const sinNth = Math.sin(m * theta[i]);
      gamma += coeffs[j] * sinNth;
      alphaInduced += m * coeffs[j] * (sinNth / sinTh);
    }
    gamma *= 2 * b;
    stations.push({
      y: y[i],
      eta: y[i] / (b / 2),
      theta: theta[i],
      chord: chord[i],
      alphaDeg: alphaDeg - (cfg.twistDeg ?? 0) * Math.abs(Math.cos(theta[i])) - (cfg.sectionAlphaL0 ?? 0),
      gamma,
      cl: (2 * gamma) / chord[i],
      alphaInducedDeg: (alphaInduced * 180) / Math.PI,
    });
    alphaInducedSum += alphaInduced;
  }

  // Centerline circulation: theta = pi/2, Gamma = 2b * sum A_n sin(n pi/2).
  let circ0 = 0;
  for (let j = 0; j < n; j += 1) {
    const m = j + 1;
    circ0 += coeffs[j] * Math.sin((m * Math.PI) / 2);
  }
  circ0 *= 2 * b;

  return {
    method: 'Prandtl Numerical Lifting Line',
    area,
    aspectRatio: ar,
    nStations: n,
    cl,
    cdInduced,
    spanEfficiency,
    clAlphaPerRad,
    alphaInducedAvgDeg: (alphaInducedSum / n) * (180 / Math.PI),
    coefficients: coeffs,
    circulation0: circ0,
    stations,
  };
}

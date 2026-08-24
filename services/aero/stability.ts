// Stability Derivatives and Dynamic Mode Analysis
//
// This module computes the dimensional and non-dimensional stability
// derivatives for a fixed-wing aircraft, then performs eigenvalue analysis
// to identify the classic dynamic modes:
//   • Short-period mode
//   • Phugoid (long-period) mode
//   • Dutch roll
//   • Spiral mode
//   • Roll subsidence
//
// References:
//   Nelson, R.C. "Flight Stability and Automatic Control" (2nd ed., 1998)
//   Etkin, B. & Reid, L.D. "Dynamics of Flight: Stability and Control" (1996)
//   McCormick, B.W. "Aerodynamics, Aeronautics, and Flight Mechanics" (1995)
//   Raymer, D. "Aircraft Design: A Conceptual Approach" (6th ed., 2023)
//
// All quantities are SI unless explicitly stated. Eigenvalue analysis
// uses the characteristic equation of the linearized state-space system.

const PI = Math.PI;

// ---------------------------------------------------------------------------
// Stability Derivative Types
// ---------------------------------------------------------------------------

export interface StabilityDerivatives {
  // === Longitudinal derivatives ===
  /** Lift due to angle of attack: CL_α (per rad) */
  clAlpha: number;
  /** Lift due to pitch rate: CL_q (per rad) */
  clQ: number;
  /** Lift due to elevator: CL_δe (per rad) */
  clDeltaE: number;
  /** Drag due to angle of attack: CD_α (per rad) */
  cdAlpha: number;
  /** Pitching moment due to angle of attack: Cm_α (per rad, negative = stable) */
  cmAlpha: number;
  /** Pitching moment due to pitch rate: Cm_q (per rad, negative = damping) */
  cmQ: number;
  /** Pitching moment due to elevator: Cm_δe (per rad) */
  cmDeltaE: number;

  // === Lateral-directional derivatives ===
  /** Side force due to sideslip: CY_β (per rad) */
  cyBeta: number;
  /** Roll moment due to sideslip: Cl_β (per rad, negative = stable dihedral) */
  clBeta: number;
  /** Roll moment due to roll rate: Cl_p (per rad, negative = damping) */
  clP: number;
  /** Roll moment due to rudder: Cl_δr (per rad) */
  clDeltaR: number;
  /** Yaw moment due to sideslip: Cn_β (per rad, positive = weathercock stable) */
  cnBeta: number;
  /** Yaw moment due to yaw rate: Cn_r (per rad, negative = damping) */
  cnR: number;
  /** Yaw moment due to rudder: Cn_δr (per rad) */
  cnDeltaR: number;
}

// ---------------------------------------------------------------------------
// Aircraft Parameters for Stability Analysis
// ---------------------------------------------------------------------------

export interface StabilityAircraftParams {
  massKg: number;
  wingAreaM2: number;
  wingSpanM: number;
  /** Mean aerodynamic chord (m) */
  macM: number;
  /** Moment of inertia about pitch axis (kg·m²) */
  iyyKgM2: number;
  /** Moment of inertia about roll axis (kg·m²) */
  ixxKgM2: number;
  /** Moment of inertia about yaw axis (kg·m²) */
  izzKgM2: number;
  /** Product of inertia (kg·m²) */
  ixzKgM2: number;
  /** Static margin: distance between CG and neutral point, as fraction of MAC */
  staticMargin: number;
  /** Tail volume ratio: V_H = (S_H × l_H) / (S × c̄) */
  tailVolumeH: number;
  /** Vertical tail volume ratio: V_V = (S_V × l_V) / (S × b) */
  tailVolumeV: number;
  /** Dihedral angle (rad) */
  dihedralRad: number;
  /** Sweep angle at quarter-chord (rad) */
  sweepQuarterRad: number;
  /** Section lift curve slope (per rad, typically 2π) */
  clAlphaSection: number;
  /** Oswald efficiency */
  oswaldE: number;
  /** Aspect ratio */
  aspectRatio: number;
}

// ---------------------------------------------------------------------------
// Compute Stability Derivatives
// ---------------------------------------------------------------------------

export function computeStabilityDerivatives(
  params: StabilityAircraftParams,
  clAlphaWing: number = 2 * PI,
): StabilityDerivatives {
  const { staticMargin, tailVolumeH, tailVolumeV, dihedralRad, sweepQuarterRad } = params;

  // Longitudinal derivatives (from Nelson Ch. 4, Anderson Ch. 5)
  // CL_α ≈ a_w + a_h × (S_H/S) × η_h ≈ clAlphaWing for typical configs
  const clAlpha = clAlphaWing * (1 + 0.1);  // wing + tail contribution (~10% boost)
  const clQ = 2 * tailVolumeH * clAlpha * 0.7;  // CL_q ≈ 2 × V_H × a_h × η_h
  const clDeltaE = -clAlpha * tailVolumeH * 0.7;  // CL_δe

  // CD_α ≈ 2 × CD0 × α + CL_α × CL/(π × e × AR)  — simplified
  const cdAlpha = 0.05;  // typical value (small, positive)

  // Cm_α = -SM × CL_α  (negative = statically stable)
  const cmAlpha = -staticMargin * clAlpha;
  // Cm_q = -2 × V_H × a_h × η_h × (l_H/c̄)  — pitch damping
  const cmQ = -2 * tailVolumeH * clAlphaWing * 0.7;
  // Cm_δe = -V_H × a_h × η_h  — elevator power
  const cmDeltaE = -tailVolumeH * clAlphaWing * 0.7;

  // Lateral-directional derivatives (from Nelson Ch. 6)
  // CY_β ≈ -K_n × a_v × (S_V/S) ≈ -0.5 to -1.0 for conventional config
  const cyBeta = -0.8;
  // Cl_β ≈ -0.0005 to -0.001 per degree  (negative = stable dihedral effect)
  const clBeta = -dihedralRad * 0.02 + sweepQuarterRad * 0.01;  // dihedral + sweep
  // Cl_p ≈ -CL/4  (roll damping, always negative)
  const clP = -clAlphaWing / 4;
  const clDeltaR = 0.04;  // typical rudder roll authority
  // Cn_β > 0 = weathercock stable (positive = nose into sideslip)
  const cnBeta = tailVolumeV * clAlphaWing * 0.7;  // V_V × a_v × η_v
  // Cn_r < 0 = yaw damping (negative)
  const cnR = -2 * tailVolumeV * clAlphaWing * 0.5;  // yaw damping from vertical tail
  const cnDeltaR = -tailVolumeV * clAlphaWing * 0.7;  // rudder yaw authority

  return {
    clAlpha, clQ, clDeltaE,
    cdAlpha,
    cmAlpha, cmQ, cmDeltaE,
    cyBeta, clBeta, clP, clDeltaR,
    cnBeta, cnR, cnDeltaR,
  };
}

// ---------------------------------------------------------------------------
// Eigenvalue / Mode Analysis
// ---------------------------------------------------------------------------

export interface DynamicMode {
  /** Mode name */
  name: string;
  /** Eigenvalue: λ = σ ± iω  (real + imaginary) */
  realPart: number;
  imagPart: number;
  /** Damping ratio: ζ = -σ / |λ| */
  dampingRatio: number;
  /** Natural frequency: ω_n = |λ| (rad/s) */
  naturalFreq: number;
  /** Period: T = 2π/ω (s) */
  period: number;
  /** Time to half/double amplitude (s) */
  timeToHalfDouble: number;
  /** Whether the mode is stable (all real parts negative) */
  stable: boolean;
  /** Physical description */
  description: string;
}

export interface EigenvalueResult {
  /** All dynamic modes identified */
  modes: DynamicMode[];
  /** Whether the overall aircraft is dynamically stable */
  stable: boolean;
  /** Characteristic equation coefficients */
  coefficients: number[];
  warnings: string[];
}

/**
 * Perform eigenvalue analysis on the linearized longitudinal and lateral
 * state-space systems to identify dynamic modes.
 *
 * Longitudinal states: [u, w, q, θ]  (forward velocity, vertical velocity,
 * pitch rate, pitch angle)
 *
 * Lateral states: [v, p, r, φ]  (lateral velocity, roll rate, yaw rate,
 * bank angle)
 */
export function computeEigenvalues(
  params: StabilityAircraftParams,
  derivatives: StabilityDerivatives,
  airspeedMs: number,
  altitudeM: number = 0,
): EigenvalueResult {
  const warnings: string[] = [];
  const { massKg, wingAreaM2, wingSpanM, macM, iyyKgM2, ixxKgM2, izzKgM2, ixzKgM2 } = params;
  const V = Math.max(airspeedMs, 1);  // guard against V = 0

  // ISA sea-level density (simplified — use atmosphere module for accuracy)
  const rho = 1.225 * Math.exp(-altitudeM / 8500);
  const q = 0.5 * rho * V * V;
  const S = wingAreaM2;
  const b = wingSpanM;
  const c = macM;
  const W = massKg * 9.80665;

  // =====================================================================
  // LONGITUDINAL EIGENVALUE ANALYSIS (Nelson Ch. 4)
  // =====================================================================
  // State-space: x_dot = A × x,  x = [u, w, q, θ]
  //
  // The A matrix elements:
  //   X_u, X_w, X_q, X_θ
  //   Z_u, Z_w, Z_q, Z_θ
  //   M_u, M_w, M_q, M_θ

  // Dimensional stability derivatives
  const Xu = (q * S / (massKg * V)) * (2 * derivatives.cdAlpha);  // X_u ≈ -2D/(mV)
  const Zw = (q * S / (massKg * V)) * (-derivatives.clAlpha);    // Z_w ≈ -L_α/(mV)
  const Zq = (q * S * c / (massKg * V * 2)) * derivatives.clQ;  // Z_q
  const Mu = (q * S * c / (iyyKgM2 * V)) * (2 * derivatives.cmAlpha);  // M_u
  const Mw = (q * S * c / (iyyKgM2 * V)) * derivatives.cmAlpha;  // M_w
  const Mq = (q * S * c * c / (iyyKgM2 * V * 2)) * derivatives.cmQ;  // M_q

  // Characteristic equation: s⁴ + a₃s³ + a₂s² + a₁s + a₀ = 0
  // For the longitudinal system (Nelson Eq. 4-48)
  const a3 = -(Xu + Zw + Mq);
  const a2 = Xu * Zw - Xu * Mq + Zw * Mq - Mw * Zq - Mu * 0;
  const a1 = Xu * (Mw * Zq - Zw * Mq) + Zw * (Mu * 0 - Xu * Mq) + Mw * (Xu * 0 - Zw * 0);
  const a0 = 0;  // simplified: no gravity coupling in short-term

  // Solve quartic s⁴ + a₃s³ + a₂s² + a₁s + a₀ = 0
  // Use simplified extraction: identify short-period and phugoid from dominant poles
  const longCoeffs = [1, a3, a2, a1, a0];

  // Short-period approximation (Nelson §4.7):
  // λ_sp² ≈ M_q × Z_w / V - M_w  (simplified)
  const spDiscriminant = Mq * Zw / V - Mw;
  const spReal = spDiscriminant < 0 ? Math.sqrt(-spDiscriminant) : 0;
  const spImag = spDiscriminant > 0 ? Math.sqrt(spDiscriminant) : 0;

  // Phugoid approximation (Nelson §4.7):
  // λ_ph ≈ ± i × g/V × √(2 × CL/(CD × π × e × AR))
  const k = 1 / (PI * params.oswaldE * params.aspectRatio);
  const clCruise = W / (q * S);
  const ldCruise = clCruise / (0.01 + k * clCruise * clCruise);
  const phugoidFreq = (9.80665 / V) * Math.sqrt(2 / ldCruise);
  const phugoidDamping = -derivatives.cdAlpha * q * S / (2 * massKg * V * phugoidFreq);

  const longModes: DynamicMode[] = [
    {
      name: 'Short Period',
      realPart: spReal < 0 ? -Mq * 0.5 : 0,  // approximate damping
      imagPart: spImag,
      dampingRatio: spImag > 0 ? Math.abs(Mq * 0.5) / Math.sqrt(spReal * spReal + spImag * spImag + 0.01) : 0,
      naturalFreq: Math.sqrt(Math.abs(spDiscriminant) + Mq * Mq * 0.25),
      period: spImag > 0 ? (2 * PI) / spImag : 0,
      timeToHalfDouble: spReal > 0 ? Math.LN2 / spReal : spReal < 0 ? -Math.LN2 / spReal : Infinity,
      stable: spReal <= 0,
      description: 'Rapid pitch oscillation (1-3 s period). Controlled by pitch stiffness (Cm_α) and pitch damping (Cm_q). High Cm_α and Cm_q → well-damped.',
    },
    {
      name: 'Phugoid',
      realPart: phugoidDamping,
      imagPart: phugoidFreq,
      dampingRatio: phugoidFreq > 0 ? -phugoidDamping / phugoidFreq : 0,
      naturalFreq: phugoidFreq,
      period: phugoidFreq > 0 ? (2 * PI) / phugoidFreq : 0,
      timeToHalfDouble: phugoidDamping > 0 ? -Math.LN2 / phugoidDamping : phugoidDamping < 0 ? Math.LN2 / phugoidDamping : Infinity,
      stable: phugoidDamping <= 0,
      description: 'Slow altitude-speed exchange (30-100 s period). KE ↔ PE swap. Controlled by L/D ratio. Lightly damped in most aircraft.',
    },
  ];

  // =====================================================================
  // LATERAL-DIRECTIONAL EIGENVALUE ANALYSIS (Nelson Ch. 6)
  // =====================================================================

  // Dutch roll approximation (Nelson Eq. 6-25):
  // ω_dr² ≈ Cn_β × q × S × b / (izz)
  const drFreqSq = derivatives.cnBeta * q * S * b / izzKgM2;
  const drFreq = drFreqSq > 0 ? Math.sqrt(drFreqSq) : 0.1;
  const drDamping = derivatives.cnR * q * S * b * b / (2 * V * izzKgM2);

  // Roll subsidence (Nelson Eq. 6-23):
  // λ_roll ≈ Cl_p × q × S × b² / (2 × V × ixx)
  const rollEigenvalue = derivatives.clP * q * S * b * b / (2 * V * ixxKgM2);

  // Spiral mode (Nelson Eq. 6-27):
  // λ_spiral ≈ g × (Cn_β × Cl_p) / (Cl_β × Cn_r × V)  — approximate
  const spiralNum = 9.80665 * derivatives.cnBeta * derivatives.clP;
  const spiralDen = derivatives.clBeta * derivatives.cnR * V;
  const spiralEigenvalue = spiralDen !== 0 ? spiralNum / spiralDen : 0;

  const latModes: DynamicMode[] = [
    {
      name: 'Dutch Roll',
      realPart: drDamping,
      imagPart: drFreq,
      dampingRatio: drFreq > 0 ? -drDamping / drFreq : 0,
      naturalFreq: drFreq,
      period: drFreq > 0 ? (2 * PI) / drFreq : 0,
      timeToHalfDouble: drDamping < 0 ? Math.LN2 / (-drDamping) : drDamping > 0 ? -Math.LN2 / drDamping : Infinity,
      stable: drDamping <= 0,
      description: 'Coupled yaw-roll oscillation (1-3 s). Controlled by weathercock stability (Cn_β) and yaw damping (Cn_r). High Cn_β/Cn_r → well-damped.',
    },
    {
      name: 'Roll Subsidence',
      realPart: rollEigenvalue,
      imagPart: 0,
      dampingRatio: 1,
      naturalFreq: Math.abs(rollEigenvalue),
      period: 0,
      timeToHalfDouble: rollEigenvalue < 0 ? -Math.LN2 / rollEigenvalue : Infinity,
      stable: rollEigenvalue <= 0,
      description: 'Rapid roll damping (< 1 s). Always stable for conventional aircraft. Controlled by Cl_p (roll damping derivative).',
    },
    {
      name: 'Spiral',
      realPart: spiralEigenvalue,
      imagPart: 0,
      dampingRatio: 1,
      naturalFreq: Math.abs(spiralEigenvalue),
      period: 0,
      timeToHalfDouble: spiralEigenvalue > 0 ? Math.LN2 / spiralEigenvalue : spiralEigenvalue < 0 ? -Math.LN2 / spiralEigenvalue : Infinity,
      stable: spiralEigenvalue <= 0,
      description: 'Slow bank-heading divergence (> 20 s). May be stable or unstable. If unstable, pilot corrects every few turns. Controlled by Cl_β/Cn_β ratio.',
    },
  ];

  const allModes = [...longModes, ...latModes];
  const allStable = allModes.every(m => m.stable);

  if (!allStable) {
    const unstable = allModes.filter(m => !m.stable).map(m => m.name);
    warnings.push(`Unstable modes detected: ${unstable.join(', ')}. Aircraft may require stability augmentation.`);
  }

  return {
    modes: allModes,
    stable: allStable,
    coefficients: longCoeffs,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Predefined aircraft configurations for comparison
// ---------------------------------------------------------------------------

export const AIRCRAFT_STABILITY_CONFIGS: Record<string, {
  name: string;
  params: StabilityAircraftParams;
  description: string;
}> = {
  cessna172: {
    name: 'Cessna 172',
    description: 'Single-engine trainer. High stability, gentle handling. The baseline for all flight dynamics courses.',
    params: {
      massKg: 1043,
      wingAreaM2: 16.17,
      wingSpanM: 11.0,
      macM: 1.49,
      iyyKgM2: 1285,
      ixxKgM2: 1285,
      izzKgM2: 1825,
      ixzKgM2: 0,
      staticMargin: 0.12,
      tailVolumeH: 0.55,
      tailVolumeV: 0.045,
      dihedralRad: 0.052,
      sweepQuarterRad: 0.017,
      clAlphaSection: 2 * PI,
      oswaldE: 0.74,
      aspectRatio: 7.48,
    },
  },
  f16: {
    name: 'F-16 Fighting Falcon',
    description: 'Relaxed static stability, fly-by-wire. Negative static margin → unstable in open loop, controlled by FBW.',
    params: {
      massKg: 8570,
      wingAreaM2: 27.87,
      wingSpanM: 9.96,
      macM: 3.45,
      iyyKgM2: 25000,
      ixxKgM2: 12875,
      izzKgM2: 23000,
      ixzKgM2: 2500,
      staticMargin: -0.03,  // NEGATIVE — intentionally unstable
      tailVolumeH: 0.35,
      tailVolumeV: 0.032,
      dihedralRad: 0.035,
      sweepQuarterRad: 0.122,
      clAlphaSection: 2 * PI,
      oswaldE: 0.8,
      aspectRatio: 3.56,
    },
  },
  boeing737: {
    name: 'Boeing 737-800',
    description: 'Large twin-engine airliner. Highly stable, designed for passenger comfort and hands-off flying.',
    params: {
      massKg: 70000,
      wingAreaM2: 124.6,
      wingSpanM: 35.8,
      macM: 4.0,
      iyyKgM2: 2_500_000,
      ixxKgM2: 800_000,
      izzKgM2: 3_000_000,
      ixzKgM2: 50_000,
      staticMargin: 0.15,
      tailVolumeH: 0.65,
      tailVolumeV: 0.06,
      dihedralRad: 0.044,
      sweepQuarterRad: 0.131,
      clAlphaSection: 2 * PI,
      oswaldE: 0.82,
      aspectRatio: 10.2,
    },
  },
  glider: {
    name: 'Schleicher ASK 21 Glider',
    description: 'Training glider. Very high aspect ratio, minimal drag. Maximum L/D for energy management.',
    params: {
      massKg: 514,
      wingAreaM2: 17.5,
      wingSpanM: 17.0,
      macM: 1.35,
      iyyKgM2: 700,
      ixxKgM2: 350,
      izzKgM2: 1000,
      ixzKgM2: 0,
      staticMargin: 0.10,
      tailVolumeH: 0.50,
      tailVolumeV: 0.038,
      dihedralRad: 0.052,
      sweepQuarterRad: 0.009,
      clAlphaSection: 2 * PI,
      oswaldE: 0.92,
      aspectRatio: 16.5,
    },
  },
};

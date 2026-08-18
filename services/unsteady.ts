// Flight Ops — Unsteady aerodynamics module.
//
// Self-contained, dependency-free implementation of the classical linear
// unsteady-aerodynamics models, built for any platform (web, iOS, Android):
//
//   1. Bessel functions J0, J1, Y0, Y1 (power series for small arguments,
//      asymptotic expansions for large ones — Abramowitz & Stegun 9.1, 9.2).
//   2. Theodorsen's function C(k) = H1⁽²⁾(k) / [H1⁽²⁾(k) + i·H0⁽²⁾(k)]
//      (Theodorsen, NACA TR 496, 1935).
//   3. Wagner's indicial-response function Φ(s) (Wagner, ZAMM 5:17–35, 1925):
//      - the classic Jones two-exponential approximation (NACA TR 681, 1940),
//      - Garrick's algebraic approximation (NACA TR 629, 1938),
//      - the EXACT function by numerical inversion of the Fourier pair
//        (Garrick 1938; Peters' recommended integral, as used by Dawson &
//        Brunton, arXiv:2104.15122, 2021).
//   4. Theodorsen harmonic lift for plunging and quarter-chord pitching,
//      split into circulatory and non-circulatory (apparent-mass) parts.
//   5. Duhamel superposition for arbitrary angle-of-attack histories, whose
//      harmonic steady state must reproduce the Theodorsen result
//      (Garrick's reciprocal relation).
//
// Conventions (documented, do not change silently)
// ------------------------------------------------
// - SI units; angles in degrees at the API boundary, radians internally.
// - Reduced frequency k = ω·b/V with half-chord b = c/2.
// - Reduced time s = 2·V·t/c = V·t/b (one unit = one half-chord of travel).
// - C(k) = F + iG, with F(0)=1, F(∞)=1/2, G(0)=G(∞)=0 (G < 0 for small k:
//   the circulatory lift lags the motion).
// - Φ(0⁺) = 1/2, Φ(∞) = 1.
// - Harmonic lift conventions: L positive up, h positive DOWN, α positive
//   nose-up, pitch axis at the quarter-chord. The overall sign is chosen so
//   that nose-up α produces positive quasi-steady lift; amplitudes and phase
//   lags are unaffected by this choice.
//
// Validation anchors (regression-tested in tests/unsteady.test.ts)
// - Bessel Wronskian J0·Y1 − J1·Y0 = 2/(π·x) and published zeros.
// - C(k) limits and monotonic |C|.
// - Φ(s): exact limits, Sears large-time asymptotic Φ ≈ 1 − 1/s,
//   Jones within ~1% of exact (Dawson & Brunton 2021), Garrick within ~2%.
// - Duhamel harmonic steady state ↔ Theodorsen C(k) (Garrick's relation).

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PI = Math.PI;
const EULER_GAMMA = 0.5772156649015329;
const BESSEL_CUTOFF = 8; // series below, asymptotic above
const TWO_OVER_PI = 2 / PI;

export const JONES_WAGNER = { c1: 0.165, lambda1: 0.0455, c2: 0.335, lambda2: 0.3 };

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`unsteady: ${name} must be finite, got ${value}`);
}

function assertPositive(name: string, value: number): void {
  assertFinite(name, value);
  if (value <= 0) throw new Error(`unsteady: ${name} must be positive, got ${value}`);
}

// ---------------------------------------------------------------------------
// Bessel functions (real order 0, 1)
// ---------------------------------------------------------------------------

interface BesselAsymptotic {
  p0: number;
  q0: number;
  p1: number;
  q1: number;
}

// P/Q polynomials of A&S 9.2.9–9.2.10 with μ = 4ν², 6 terms each:
//   P_ν(x) = Σ_{k≥0} (−1)^k · Π_{j=0}^{2k−1}(μ−(2j+1)²) / ((2k)! (8x)^{2k})
//   Q_ν(x) = Σ_{k≥1} (−1)^{k+1} · Π_{j=0}^{2k−2}(μ−(2j+1)²) / ((2k−1)! (8x)^{2k−1})
// Six terms keep the neglected-term error below ~1e-13 at the x = 8 cutoff.
function besselPQ(x: number): BesselAsymptotic {
  const pq = (mu: number) => {
    let p = 1;
    let q = 0;
    const inv8x = 1 / (8 * x);
    let fact = 1;
    let pow = 1; // (8x)^{2k} for P
    for (let k = 1; k <= 6; k += 1) {
      let num = 1;
      for (let j = 0; j < 2 * k; j += 1) num *= mu - (2 * j + 1) * (2 * j + 1);
      fact *= 2 * k * (2 * k - 1);
      pow *= inv8x * inv8x;
      p += (k % 2 === 1 ? -1 : 1) * (num / fact) * pow;
    }
    fact = 1;
    pow = inv8x;
    for (let k = 1; k <= 6; k += 1) {
      let num = 1;
      for (let j = 0; j < 2 * k - 1; j += 1) num *= mu - (2 * j + 1) * (2 * j + 1);
      fact *= 2 * k - 1;
      if (k > 1) fact *= 2 * k - 2;
      q += (k % 2 === 1 ? 1 : -1) * (num / fact) * pow;
      pow *= inv8x * inv8x;
    }
    return { p, q };
  };
  const p0q0 = pq(0);
  const p1q1 = pq(4);
  return { p0: p0q0.p, q0: p0q0.q, p1: p1q1.p, q1: p1q1.q };
}

function besselAsymptotic(x: number): { j0: number; y0: number; j1: number; y1: number } {
  const { p0, q0, p1, q1 } = besselPQ(x);
  const s = Math.sqrt(TWO_OVER_PI / x);
  const x4 = x - PI / 4;
  const x34 = x - (3 * PI) / 4;
  const cos4 = Math.cos(x4);
  const sin4 = Math.sin(x4);
  const cos34 = Math.cos(x34);
  const sin34 = Math.sin(x34);
  return {
    j0: s * (p0 * cos4 - q0 * sin4),
    y0: s * (p0 * sin4 + q0 * cos4),
    j1: s * (p1 * cos34 - q1 * sin34),
    y1: s * (p1 * sin34 + q1 * cos34),
  };
}

/** J0(x) — series A&S 9.1.10 (x ≤ 8), asymptotic A&S 9.2.5 (x > 8). */
export function besselJ0(x: number): number {
  assertFinite('besselJ0 x', x);
  const ax = Math.abs(x);
  if (ax <= BESSEL_CUTOFF) {
    let term = 1;
    let sum = 1;
    const x2 = -x * x / 4;
    for (let m = 1; m <= 60; m += 1) {
      term *= x2 / (m * m);
      sum += term;
      if (Math.abs(term) < 1e-18 * Math.abs(sum)) break;
    }
    return sum;
  }
  return besselAsymptotic(ax).j0;
}

/** J1(x) — series A&S 9.1.11 (x ≤ 8), asymptotic A&S 9.2.5 (x > 8). */
export function besselJ1(x: number): number {
  assertFinite('besselJ1 x', x);
  const ax = Math.abs(x);
  if (ax <= BESSEL_CUTOFF) {
    let term = x / 2;
    let sum = term;
    const x2 = -x * x / 4;
    for (let m = 1; m <= 60; m += 1) {
      term *= x2 / (m * (m + 1));
      sum += term;
      if (Math.abs(term) < 1e-18 * Math.abs(sum)) break;
    }
    return sum;
  }
  return Math.sign(x || 1) * besselAsymptotic(ax).j1;
}

/** Y0(x), x > 0 — series A&S 9.1.13 (x ≤ 8), asymptotic A&S 9.2.5 (x > 8). */
export function besselY0(x: number): number {
  assertPositive('besselY0 x', x);
  if (x <= BESSEL_CUTOFF) {
    const j0 = besselJ0(x);
    let sum = 0;
    let term = 1;
    let harmonic = 0;
    const x2 = x * x / 4;
    for (let m = 1; m <= 60; m += 1) {
      term *= x2 / (m * m);
      harmonic += 1 / m;
      sum += (m % 2 === 1 ? 1 : -1) * harmonic * term;
      if (Math.abs(term * harmonic) < 1e-18 * (Math.abs(sum) + 1)) break;
    }
    return TWO_OVER_PI * (Math.log(x / 2) + EULER_GAMMA) * j0 + TWO_OVER_PI * sum;
  }
  return besselAsymptotic(x).y0;
}

/** Y1(x), x > 0 — series A&S 9.1.14 (x ≤ 8), asymptotic A&S 9.2.5 (x > 8). */
export function besselY1(x: number): number {
  assertPositive('besselY1 x', x);
  if (x <= BESSEL_CUTOFF) {
    const j1 = besselJ1(x);
    const x2 = x * x / 4;
    // Σ (−1)^m (H_m + H_{m+1}) (x/2)^{2m+1} / (m!(m+1)!)
    let sum = 0;
    let term = x / 2; // (x/2)^{2m+1}/(m!(m+1)!) at m = 0
    let hPrev = 0; // H_0
    let hCurr = 1; // H_1
    for (let m = 0; m <= 60; m += 1) {
      const coeff = hPrev + hCurr; // H_m + H_{m+1}
      sum += (m % 2 === 1 ? -1 : 1) * coeff * term;
      // advance to m + 1
      term *= x2 / ((m + 1) * (m + 2));
      hPrev = hCurr;
      hCurr += 1 / (m + 2);
      if (Math.abs(coeff * term) < 1e-18 * (Math.abs(sum) + 1)) break;
    }
    return TWO_OVER_PI * (Math.log(x / 2) + EULER_GAMMA) * j1 - 2 / (PI * x) - sum / PI;
  }
  return besselAsymptotic(x).y1;
}

// ---------------------------------------------------------------------------
// Theodorsen function
// ---------------------------------------------------------------------------

export interface TheodorsenResult {
  /** real part F */
  f: number;
  /** imaginary part G */
  g: number;
  /** magnitude |C(k)| */
  magnitude: number;
  /** phase of C(k), degrees (negative = circulatory lift lags the motion) */
  phaseDeg: number;
}

/**
 * Theodorsen's function C(k) = F + iG via Hankel functions of the second kind
 * (Theodorsen, NACA TR 496, 1935):
 *
 *   C(k) = H1⁽²⁾(k) / [H1⁽²⁾(k) + i·H0⁽²⁾(k)],   H_ν⁽²⁾ = J_ν − i·Y_ν
 *
 * Separating real/imaginary parts (with den = (J1+Y0)² + (J0−Y1)²):
 *
 *   F = [J1·(J1+Y0) + Y1·(Y1−J0)] / den
 *   G = −[Y1·Y0 + J1·J0] / den
 *
 * k is the half-chord reduced frequency k = ω·b/V. Valid for k > 0; the
 * limits C(0) = 1 (quasi-steady) and C(∞) = 1/2 (high frequency) are exact.
 */
export function theodorsen(k: number): TheodorsenResult {
  assertPositive('reduced frequency k', k);
  const j0 = besselJ0(k);
  const j1 = besselJ1(k);
  const y0 = besselY0(k);
  const y1 = besselY1(k);

  const den = (j1 + y0) * (j1 + y0) + (j0 - y1) * (j0 - y1);
  const f = (j1 * (j1 + y0) + y1 * (y1 - j0)) / den;
  const g = -(y1 * y0 + j1 * j0) / den;

  return {
    f,
    g,
    magnitude: Math.hypot(f, g),
    phaseDeg: (Math.atan2(g, f) * 180) / PI,
  };
}

/** Theodorsen C(k) curve over a k-range (log-spaced, 1e-3 … 1e3 by default). */
export function theodorsenCurve(
  kMin = 1e-3,
  kMax = 1e3,
  points = 40,
): { k: number; f: number; g: number; magnitude: number; phaseDeg: number }[] {
  assertPositive('kMin', kMin);
  assertPositive('kMax', kMax);
  if (kMin >= kMax) throw new Error(`unsteady: kMin (${kMin}) must be < kMax (${kMax})`);
  const out: ReturnType<typeof theodorsenCurve> = [];
  const logMin = Math.log10(kMin);
  const logMax = Math.log10(kMax);
  for (let i = 0; i < points; i += 1) {
    const k = Math.pow(10, logMin + ((logMax - logMin) * i) / (points - 1));
    const c = theodorsen(k);
    out.push({ k, f: c.f, g: c.g, magnitude: c.magnitude, phaseDeg: c.phaseDeg });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Wagner function
// ---------------------------------------------------------------------------

/**
 * Jones's two-exponential approximation (NACA TR 681, 1940):
 *   Φ(s) = 1 − 0.165·e^(−0.0455·s) − 0.335·e^(−0.3·s)
 * Max absolute error vs the exact function < 1% (Dawson & Brunton 2021).
 */
export function wagnerJones(s: number): number {
  assertFinite('wagnerJones s', s);
  if (s < 0) throw new Error(`unsteady: reduced time s must be ≥ 0, got ${s}`);
  return (
    1 -
    JONES_WAGNER.c1 * Math.exp(-JONES_WAGNER.lambda1 * s) -
    JONES_WAGNER.c2 * Math.exp(-JONES_WAGNER.lambda2 * s)
  );
}

/**
 * Garrick's algebraic approximation (NACA TR 629, 1938):
 *   Φ(s) = 1 − 2/(4 + s)
 * Correct asymptotic decay for large s (algebraic, not exponential), but less
 * accurate at intermediate times than Jones (max abs error < 2%).
 */
export function wagnerGarrick(s: number): number {
  assertFinite('wagnerGarrick s', s);
  if (s < 0) throw new Error(`unsteady: reduced time s must be ≥ 0, got ${s}`);
  return 1 - 2 / (4 + s);
}

/**
 * Exact Wagner function by numerical inversion of the Garrick Fourier pair
 * (Garrick, NACA TR 629, 1938; Peters' integral recommended by Dawson &
 * Brunton 2021):
 *
 *   Φ(s) = 1 + (2/π) ∫₀^∞ [(F(k) − 1)/k]·sin(k·s) dk
 *
 * with F(k) = Re C(k). The integral converges conditionally; near s = 0 the
 * dilation limit recovers Φ(0⁺) = 1/2 and for s → ∞ it gives Φ(∞) = 1.
 * Integration: composite Simpson over half-periods of sin(k·s) with a
 * convergence cutoff on the 1/k envelope. Cost ≈ 10–40 ms per s on a phone.
 */
export function wagnerExact(s: number, tolerance = 1e-4): number {
  assertFinite('wagnerExact s', s);
  if (s < 0) throw new Error(`unsteady: reduced time s must be ≥ 0, got ${s}`);
  if (s === 0) return 0.5;

  // Integrate half-period by half-period. With the tail bound
  // |∫_K^∞ (F−1)/k·sin(ks) dk| ≤ 1/(π·K·s) (F → 1/2 asymptotically),
  // K·s = 3200 keeps the truncation error below ~1e-4 for every s.
  // Within each half-period the integral is evaluated with adaptive Simpson,
  // which resolves the slowly-varying envelope (F−1)/k that a fixed grid
  // misses at small s (long half-periods).
  const halfPeriod = PI / s;
  const periods = Math.ceil(3200 / s / halfPeriod) + 1; // K_max·s ≈ 3200
  const perPeriodTol = Math.max(tolerance / periods, 1e-11);
  const f = (k: number): number => {
    // At k = 0 the integrand has a removable singularity: (F−1)·sin(ks)/k → 0.
    if (k === 0) return 0;
    return ((theodorsen(k).f - 1) * Math.sin(k * s)) / k;
  };
  let integral = 0;
  for (let period = 0; period < periods; period += 1) {
    const a = period * halfPeriod;
    integral += adaptiveSimpson(f, a, a + halfPeriod, perPeriodTol, 26);
  }
  void tolerance;
  return 1 + TWO_OVER_PI * integral;
}

/** Adaptive Simpson (recursive) with the standard error estimator. */
function adaptiveSimpson(
  f: (k: number) => number,
  a: number,
  b: number,
  tolerance: number,
  depth: number,
): number {
  const m = (a + b) / 2;
  const fa = f(a);
  const fm = f(m);
  const fb = f(b);
  const whole = ((b - a) / 6) * (fa + 4 * fm + fb);
  const left = ((m - a) / 6) * (fa + 4 * f((a + m) / 2) + fm);
  const right = ((b - m) / 6) * (fm + 4 * f((m + b) / 2) + fb);
  const err = Math.abs(left + right - whole);
  if (depth <= 0 || err <= 15 * tolerance) {
    return left + right + err / 15;
  }
  return (
    adaptiveSimpson(f, a, m, tolerance / 2, depth - 1) +
    adaptiveSimpson(f, m, b, tolerance / 2, depth - 1)
  );
}

/** Exact Φ(s) at the start of the domain (s → 0⁺), analytically = 1/2. */
export function wagnerInitialValue(): number {
  return 0.5;
}

export interface WagnerCurvePoint {
  s: number;
  jones: number;
  garrick: number;
  exact: number;
}

/** Jones / Garrick / exact Wagner curves over s ∈ [sMin, sMax]. */
export function wagnerCurve(
  sMin = 0,
  sMax = 20,
  points = 41,
  exactEvery = 2,
): WagnerCurvePoint[] {
  assertFinite('sMin', sMin);
  assertFinite('sMax', sMax);
  if (sMin < 0 || sMax <= sMin) throw new Error('unsteady: invalid s range');
  const out: WagnerCurvePoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const s = sMin + ((sMax - sMin) * i) / (points - 1);
    let exact = Number.NaN;
    if (s >= 0.05 && i % exactEvery === 0) exact = wagnerExact(s);
    out.push({ s, jones: wagnerJones(s), garrick: wagnerGarrick(s), exact });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Theodorsen harmonic lift (plunge / quarter-chord pitch)
// ---------------------------------------------------------------------------

export interface HarmonicLiftResult {
  /** amplitude of CL per unit input (per h0/b for plunge, per α0 for pitch) */
  amplitude: number;
  /** phase of CL relative to the input, degrees (negative = lag) */
  phaseDeg: number;
  /** circulatory part amplitude (per unit input) */
  circulatoryAmp: number;
  /** non-circulatory (apparent-mass) part amplitude (per unit input) */
  nonCirculatoryAmp: number;
}

/**
 * Theodorsen lift for harmonic PLUNGE h = h0·e^(iωt) (h positive down,
 * L positive up):
 *
 *   CL/(h0/b) = π·k² − 2π·i·k·C(k)
 *
 * The πk² term is the non-circulatory apparent-mass part; −2πik·C(k) is the
 * circulatory part. Quasi-steady limit k → 0: CL → 0 (at peak displacement
 * the plunge rate — and hence the lift — vanishes); k → ∞: apparent-mass
 * dominance, amplitude ~ πk².
 */
export function theodorsenPlungeLift(k: number): HarmonicLiftResult {
  assertPositive('reduced frequency k', k);
  const c = theodorsen(k);
  // CL = πk² + 2πk·G − 2πi·k·F  (from πk² − 2πik(F + iG))
  const re = PI * k * k + 2 * PI * k * c.g;
  const im = -2 * PI * k * c.f;
  const amplitude = Math.hypot(re, im);
  const circulatory = 2 * PI * k * c.magnitude;
  const nonCirculatory = PI * k * k;
  return {
    amplitude,
    phaseDeg: (Math.atan2(im, re) * 180) / PI,
    circulatoryAmp: circulatory,
    nonCirculatoryAmp: nonCirculatory,
  };
}

/**
 * Theodorsen lift for harmonic PITCH α = α0·e^(iωt) about the QUARTER-CHORD
 * (sign chosen so that nose-up α gives positive quasi-steady lift):
 *
 *   CL/α0 = 2π·C(k)·(1 + i·k) + i·π·k
 *
 * Quasi-steady limit k → 0: CL/α0 → 2π with zero phase (thin-airfoil result);
 * k → ∞: apparent-mass dominance, |CL/α0| ~ 2πk, phase → +90°.
 */
export function theodorsenPitchLift(k: number): HarmonicLiftResult {
  assertPositive('reduced frequency k', k);
  const c = theodorsen(k);
  // 2π(F + iG)(1 + ik) = 2π[(F − kG) + i(G + kF)]
  const circRe = 2 * PI * (c.f - k * c.g);
  const circIm = 2 * PI * (c.g + k * c.f);
  const re = circRe; // + iπk has zero real part
  const im = circIm + PI * k;
  return {
    amplitude: Math.hypot(re, im),
    phaseDeg: (Math.atan2(im, re) * 180) / PI,
    circulatoryAmp: 2 * PI * c.magnitude * Math.hypot(1, k),
    nonCirculatoryAmp: PI * k,
  };
}

// ---------------------------------------------------------------------------
// Duhamel superposition (indicial response)
// ---------------------------------------------------------------------------

/**
 * Circulatory CL response to an arbitrary angle-of-attack history α(s)
 * (Duhamel superposition with the Wagner function):
 *
 *   CL(s) = 2π·[α(0⁺)·Φ(s) + ∫₀^s Φ(s − σ)·α'(σ) dσ]
 *
 * For harmonic α = α0·sin(k·s) the steady state must approach the Theodorsen
 * result 2π·|C(k)|·α0·sin(k·s + arg C(k)) (Garrick's reciprocal relation) —
 * enforced by the regression test. Returns the sampled curve plus the
 * measured steady-state amplitude/phase for validation.
 */
export function duhamelHarmonic(
  alpha0Rad: number,
  k: number,
  sMax = 120,
  n = 960,
): {
  curve: { s: number; cl: number }[];
  measuredAmplitude: number;
  measuredPhaseDeg: number;
  theodorsenAmplitude: number;
  theodorsenPhaseDeg: number;
} {
  assertFinite('alpha0Rad', alpha0Rad);
  assertPositive('k', k);
  const ds = sMax / n;
  const curve: { s: number; cl: number }[] = [];
  const phi = new Float64Array(n + 1);
  for (let i = 0; i <= n; i += 1) phi[i] = wagnerJones(i * ds);

  // Closed-form Duhamel convolution for α(s) = α0·sin(k·s) with the Jones
  // kernel Φ(s) = 1 − c1·e^(−λ1 s) − c2·e^(−λ2 s). With
  //   ∫₀^s e^(−λ(s−σ))·cos(kσ)dσ = [λ·cos(ks) + k·sin(ks) − λ·e^(−λs)]/(λ² + k²):
  //   CL/(2π·α0) = sin(ks)
  //     − c1·[λ1·k·cos(ks) + k²·sin(ks) − λ1·k·e^(−λ1 s)]/(λ1² + k²)
  //     − c2·[λ2·k·cos(ks) + k²·sin(ks) − λ2·k·e^(−λ2 s)]/(λ2² + k²)
  // whose steady state is F̃·sin(ks) + G̃·cos(ks) with C̃ = F̃ + iG̃ the
  // Jones-approximated Theodorsen function — the Garrick pair in action.
  const c1 = JONES_WAGNER.c1;
  const c2 = JONES_WAGNER.c2;
  const l1 = JONES_WAGNER.lambda1;
  const l2 = JONES_WAGNER.lambda2;
  const d1 = l1 * l1 + k * k;
  const d2 = l2 * l2 + k * k;
  for (let i = 0; i <= n; i += 1) {
    const s = i * ds;
    const sinKs = Math.sin(k * s);
    const cosKs = Math.cos(k * s);
    const resp =
      sinKs -
      (c1 * (l1 * k * cosKs + k * k * sinKs - l1 * k * Math.exp(-l1 * s))) / d1 -
      (c2 * (l2 * k * cosKs + k * k * sinKs - l2 * k * Math.exp(-l2 * s))) / d2;
    curve.push({ s, cl: 2 * PI * alpha0Rad * resp });
  }

  // Steady-state amplitude/phase from a least-squares harmonic fit over the
  // final two cycles (the slow Jones mode e^(−0.0455·s) has decayed to < 0.5%
  // by s = 120, so the fit is uncontaminated).
  const period = (2 * PI) / k;
  const fitFrom = sMax - 2 * period;
  const fitStart = Math.max(0, Math.ceil(fitFrom / ds));
  let a = 0;
  let b = 0;
  let count = 0;
  for (let i = fitStart; i <= n; i += 1) {
    a += curve[i].cl * Math.sin(k * curve[i].s);
    b += curve[i].cl * Math.cos(k * curve[i].s);
    count += 1;
  }
  a = (2 * a) / count;
  b = (2 * b) / count;

  const c = theodorsen(k);
  return {
    curve,
    measuredAmplitude: Math.hypot(a, b),
    measuredPhaseDeg: (Math.atan2(b, a) * 180) / PI,
    theodorsenAmplitude: 2 * PI * alpha0Rad * c.magnitude,
    theodorsenPhaseDeg: c.phaseDeg,
  };
}

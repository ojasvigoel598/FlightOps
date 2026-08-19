// Powered by OnSpace.AI
// Unsteady thin-airfoil aerodynamics (incompressible, 2-D, small amplitude):
//
//   - Theodorsen's lift-deficiency function C(k). For an airfoil undergoing
//     harmonic motion at reduced frequency k = omega*b/U, the circulatory
//     (wake-induced) lift is the quasi-steady value multiplied by the
//     complex factor C(k), which is < 1 in magnitude (the wake "deficits"
//     the lift) and lags in phase. Exact definition (Theodorsen 1935;
//     Katz & Plotkin ch. 13):
//
//         C(k) = H1^(2)(k) / (H1^(2)(k) + i*H0^(2)(k))
//
//     where Hn^(2) = Jn - i*Yn are Hankel functions of the second kind.
//     Limits: C(0) = 1 (quasi-steady), C(inf) -> 1/2 (half the lift is
//     lost at infinite frequency because the wake cannot develop).
//
//   - Wagner's indicial lift function w(s). The lift ratio after a sudden
//     step in angle of attack, as a function of half-chords travelled
//     s = Ut/b. Exact theory: w(0) = 1/2 (half the lift appears instantly,
//     the rest grows as the wake develops), w(inf) -> 1. The closed-form
//     two-exponential approximation of R.T. Jones (1938) is used here:
//
//         w(s) = 1 - 0.165*exp(-0.0455*s) - 0.335*exp(-0.3*s)
//
//     (accurate to ~1-2% of the exact function for s > ~0.05; the exact
//     function has an infinite initial slope, so the approximation deviates
//     only in a small neighborhood of s = 0.)
//
// Bessel functions J0/J1/Y0/Y1 are computed from the power series of
// Abramowitz & Stegun (9.1.10-9.1.11). The series converge rapidly for the
// reduced-frequency range used in practice (k <= 10) and the log-term
// cancellation in Yn is benign there. The implementation is validated
// against scipy.special.hankel2 in scripts/validate_aero.py.
//
// Conventions: b = half-chord, U = freestream speed, s = Ut/b,
// k = omega*b/U, harmonic motion e^{i*omega*t}.

export interface Complex {
  re: number;
  im: number;
}

const EULER_GAMMA = 0.5772156649015329;

/** Harmonic number H_n = sum_{k=1..n} 1/k (H_0 = 0). */
function harmonic(n: number): number {
  let h = 0;
  for (let i = 1; i <= n; i += 1) h += 1 / i;
  return h;
}

/** J0(x) = sum_{k=0}^inf (-1)^k (x/2)^{2k} / (k!)^2 */
function besselJ0(x: number): number {
  const h2 = 0.25 * x * x;
  let sum = 0;
  let term = 1; // k = 0
  for (let k = 0; k < 200; k += 1) {
    sum += term;
    term *= -h2 / ((k + 1) * (k + 1));
    if (Math.abs(term) < 1e-18 * Math.abs(sum) + 1e-300) break;
  }
  return sum;
}

/** J1(x) = (x/2) * sum_{k=0}^inf (-1)^k (x/2)^{2k} / (k! (k+1)!) */
function besselJ1(x: number): number {
  const half = 0.5 * x;
  const h2 = half * half;
  let sum = 0;
  let term = 1; // k = 0
  for (let k = 0; k < 200; k += 1) {
    sum += term;
    term *= -h2 / ((k + 1) * (k + 2));
    if (Math.abs(term) < 1e-18 * Math.abs(sum) + 1e-300) break;
  }
  return half * sum;
}

/** Y0(x) = (2/pi) [ (ln(x/2) + gamma) J0(x) + sum_{k>=1} (-1)^{k+1} H_k (x/2)^{2k}/(k!)^2 ] */
function besselY0(x: number): number {
  const half = 0.5 * x;
  const h2 = half * half;
  const ln = Math.log(half);
  let s = 0;
  let term = h2; // k = 1: (x/2)^2 / (1!)^2, sign +, H_1 = 1
  for (let k = 1; k < 200; k += 1) {
    s += term * harmonic(k);
    term *= -h2 / ((k + 1) * (k + 1));
    if (Math.abs(term * harmonic(k + 1)) < 1e-18 * (Math.abs(s) + 1) + 1e-300) break;
  }
  return (2 / Math.PI) * ((ln + EULER_GAMMA) * besselJ0(x) + s);
}

/** Y1(x) = (2/pi) [ (ln(x/2) + gamma) J1(x) - 1/x - (1/2) sum_{k>=0} (-1)^k (H_k + H_{k+1}) (x/2)^{2k+1}/(k!(k+1)!) ] */
function besselY1(x: number): number {
  const half = 0.5 * x;
  const h2 = half * half;
  const ln = Math.log(half);
  let s = 0;
  let term = half; // k = 0: (x/2) / (0! 1!), H_0 + H_1 = 1
  for (let k = 0; k < 200; k += 1) {
    s += term * (harmonic(k) + harmonic(k + 1));
    term *= -h2 / ((k + 1) * (k + 2));
    if (
      Math.abs(term * (harmonic(k + 1) + harmonic(k + 2))) <
      1e-18 * (Math.abs(s) + 1) + 1e-300
    ) {
      break;
    }
  }
  return (2 / Math.PI) * ((ln + EULER_GAMMA) * besselJ1(x) - 1 / x - 0.5 * s);
}

function cDiv(a: Complex, b: Complex): Complex {
  const den = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / den,
    im: (a.im * b.re - a.re * b.im) / den,
  };
}

/** Hankel function of the second kind Hn^(2)(x) = Jn(x) - i*Yn(x). */
function hankel2(n: 0 | 1, x: number): Complex {
  return n === 0
    ? { re: besselJ0(x), im: -besselY0(x) }
    : { re: besselJ1(x), im: -besselY1(x) };
}

/**
 * Theodorsen's lift-deficiency function C(k), k > 0 (reduced frequency).
 * Returns the complex factor multiplying the quasi-steady circulatory
 * lift for harmonic motion: |C| < 1 (deficiency), arg(C) < 0 (phase lag).
 */
export function theodorsen(k: number): Complex {
  if (!(k > 0) || !Number.isFinite(k)) {
    throw new Error('theodorsen: reduced frequency k must be a finite positive number');
  }
  const h1 = hankel2(1, k);
  const h0 = hankel2(0, k);
  // C = H1 / (H1 + i*H0); i*H0 = { re: -H0.im, im: H0.re }.
  const den = { re: h1.re - h0.im, im: h1.im + h0.re };
  return cDiv(h1, den);
}

/**
 * Wagner's indicial lift function w(s) via R.T. Jones' two-exponential
 * approximation. s >= 0 is the distance travelled in half-chords (Ut/b).
 * w(0) = 0.5, w(inf) -> 1.
 */
export function wagnerJones(s: number): number {
  if (!(s >= 0) || !Number.isFinite(s)) {
    throw new Error('wagnerJones: s must be a finite non-negative number');
  }
  return 1 - 0.165 * Math.exp(-0.0455 * s) - 0.335 * Math.exp(-0.3 * s);
}

/**
 * Lift-deficiency ratio and phase lag of the circulatory lift for harmonic
 * motion at reduced frequency k. ratio = |C(k)| (1 at k = 0, -> 1/2 as
 * k -> inf); phaseDeg < 0 is the lag of the lift behind the quasi-steady
 * value.
 */
export function theodorsenLiftDeficiency(
  k: number,
): { ratio: number; phaseDeg: number } {
  const c = theodorsen(k);
  return {
    ratio: Math.hypot(c.re, c.im),
    phaseDeg: (Math.atan2(c.im, c.re) * 180) / Math.PI,
  };
}

/**
 * Total lift amplitude for a pure harmonic plunge h = h0*e^{i*omega*t},
 * nondimensionalized by pi*rho*b^2*omega^2*h0 (added-mass + circulatory):
 *
 *   L / (pi rho b^2 omega^2 h) = -1 - 2*i*C(k)/k
 *
 * At small k the circulatory term dominates and |L| ~ 2*pi*rho*U*b*omega*h
 * (the quasi-steady plunge lift); at large k the added-mass term dominates
 * and |L| -> pi*rho*b^2*omega^2*h (the fluid "sloshes" without a wake).
 * Requires k > 0.
 */
export function plungeLiftAmplitude(k: number): Complex {
  const c = theodorsen(k);
  // -2*i*C/k = { 2*Im(C)/k, -2*Re(C)/k }
  return { re: -1 + (2 * c.im) / k, im: (-2 * c.re) / k };
}

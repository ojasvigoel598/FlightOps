// Validation + regression tests for services/unsteady.ts.
//
// Anchors (primary/secondary literature):
// - Bessel Wronskian J1·Y0 − J0·Y1 = 2/(πx) (A&S 9.1.16) and published zeros.
// - Theodorsen C(k) limits: C(0) = 1, C(∞) = 1/2 (Theodorsen, NACA TR 496).
// - Wagner Φ(s): exact limits Φ(0⁺) = 1/2, Φ(∞) = 1 (Wagner 1925); von
//   Kármán–Sears small-time series Φ ≈ 1/2 + s/8 (Sears 1938); Sears
//   large-time asymptotic Φ ≈ 1 − 1/s; Jones approx within 1% of exact
//   (Dawson & Brunton 2021, arXiv:2104.15122); Garrick approx within 2%.
// - Duhamel harmonic steady state must match the (Jones-approximated)
//   Theodorsen function — Garrick's reciprocal relation (NACA TR 629).

import { describe, expect, it } from 'vitest';

import {
  JONES_WAGNER,
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
  duhamelHarmonic,
  theodorsen,
  theodorsenCurve,
  theodorsenPitchLift,
  theodorsenPlungeLift,
  wagnerExact,
  wagnerGarrick,
  wagnerInitialValue,
  wagnerJones,
} from '@/services/unsteady';

describe('Bessel functions', () => {
  it('satisfies the Wronskian J1·Y0 − J0·Y1 = 2/(πx) across the series/asymptotic split', () => {
    for (const x of [0.1, 0.5, 2, 5, 7, 8, 9, 20, 100, 1000]) {
      const w = besselJ1(x) * besselY0(x) - besselJ0(x) * besselY1(x);
      expect(w).toBeCloseTo(2 / (Math.PI * x), 9);
    }
  });

  it('reproduces the published zeros to high precision', () => {
    expect(besselJ0(2.4048255577)).toBeCloseTo(0, 8);
    expect(besselJ1(3.8317059702)).toBeCloseTo(0, 8);
    expect(besselY0(0.8935769663)).toBeCloseTo(0, 8);
    expect(besselY1(2.1971413260)).toBeCloseTo(0, 8);
  });

  it('reproduces reference values at x = 10 (asymptotic regime)', () => {
    expect(besselJ0(10)).toBeCloseTo(-0.2459357645, 7);
    expect(besselY0(10)).toBeCloseTo(0.0556711673, 7);
    expect(besselJ1(10)).toBeCloseTo(0.0434727462, 7);
    expect(besselY1(10)).toBeCloseTo(0.2490154242, 7);
  });

  it('has the correct small-x leading behaviour', () => {
    expect(besselJ0(0)).toBe(1);
    expect(besselJ1(0)).toBe(0);
    // Y1(x) ~ −2/(πx)
    expect(besselY1(1e-4) * Math.PI * 1e-4 / -2).toBeCloseTo(1, 4);
  });

  it('rejects non-positive arguments for Y', () => {
    expect(() => besselY0(0)).toThrow();
    expect(() => besselY1(-1)).toThrow();
  });
});

describe('Theodorsen function C(k)', () => {
  it('has the exact quasi-steady limit C(0) = 1 with the linear small-k approach 1 − F ~ (π/2)k', () => {
    const c = theodorsen(1e-4);
    // The true small-k behaviour is 1 − F ≈ (π/2)·k (NOT an O(k²) approach).
    expect(c.f).toBeCloseTo(1 - (Math.PI / 2) * 1e-4, 5);
    expect(c.magnitude).toBeGreaterThan(0.9998);
    expect(c.magnitude).toBeLessThan(1);
  });

  it('has the exact high-frequency limit C(∞) = 1/2', () => {
    const c = theodorsen(1000);
    expect(c.f).toBeCloseTo(0.5, 4);
    expect(c.magnitude).toBeCloseTo(0.5, 4);
  });

  it('matches the classical table values at k = 0.5 (F ≈ 0.598, G ≈ −0.151)', () => {
    const c = theodorsen(0.5);
    expect(c.f).toBeCloseTo(0.5979, 3);
    expect(c.g).toBeCloseTo(-0.1507, 3);
    expect(c.magnitude).toBeCloseTo(0.6166, 3);
  });

  it('has a monotone-decreasing magnitude and a phase lag bounded by ~15°', () => {
    const curve = theodorsenCurve(1e-3, 1e3, 24);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i].magnitude).toBeLessThanOrEqual(curve[i - 1].magnitude + 1e-6);
      expect(curve[i].phaseDeg).toBeLessThanOrEqual(0);
      expect(curve[i].phaseDeg).toBeGreaterThan(-16);
    }
  });

  it('rejects invalid reduced frequencies', () => {
    expect(() => theodorsen(0)).toThrow();
    expect(() => theodorsen(Number.NaN)).toThrow();
  });
});

describe('Wagner function Φ(s)', () => {
  it('has the exact initial value Φ(0⁺) = 1/2', () => {
    expect(wagnerInitialValue()).toBe(0.5);
    expect(wagnerJones(0)).toBeCloseTo(0.5, 9);
    expect(wagnerGarrick(0)).toBeCloseTo(0.5, 9);
    expect(wagnerExact(0)).toBeCloseTo(0.5, 6);
  });

  it('approaches 1 monotonically from below', () => {
    let prev = 0;
    for (const s of [0, 0.5, 1, 2, 5, 10, 20, 50]) {
      const v = wagnerJones(s);
      expect(v).toBeGreaterThan(prev);
      expect(v).toBeLessThan(1);
      prev = v;
    }
    expect(wagnerJones(50)).toBeCloseTo(0.99, 1);
  });

  it('exact values match the von Kármán–Sears small-time series', () => {
    // Φ ≈ 1/2 + s/8 (Sears 1938 series) at tiny s
    const s = 0.05;
    expect(wagnerExact(s)).toBeCloseTo(0.5 + s / 8, 2);
  });

  it('exact values match the Sears large-time asymptotic Φ ≈ 1 − 1/s − 2·ln(2s)/s² + 2/s²', () => {
    // Two-term Sears expansion (Sears 1938, eq. 67): at s = 20 it gives
    // 1 − 0.05 − 2·ln(40)/400 + 2/400 = 0.9366; the true value is 0.9368.
    const s = 20;
    const twoTerm = 1 - 1 / s - (2 * Math.log(2 * s)) / (s * s) + 2 / (s * s);
    expect(wagnerExact(s)).toBeCloseTo(twoTerm, 2);
    // Leading order still brackets the value.
    expect(wagnerExact(20)).toBeGreaterThan(0.92);
    expect(wagnerExact(20)).toBeLessThan(0.95);
  });

  it('exact, Jones and Garrick agree within their published error bounds', () => {
    let maxJonesErr = 0;
    let maxGarrickErr = 0;
    for (const s of [0.1, 0.5, 1, 2, 5, 10, 20]) {
      const exact = wagnerExact(s);
      maxJonesErr = Math.max(maxJonesErr, Math.abs(exact - wagnerJones(s)));
      maxGarrickErr = Math.max(maxGarrickErr, Math.abs(exact - wagnerGarrick(s)));
    }
    // Dawson & Brunton 2021: Jones max abs error < 1%, Garrick < 2% (their
    // quoted figures; our sampled maxima are ≈0.0066 and ≈0.020).
    expect(maxJonesErr).toBeLessThan(0.01);
    expect(maxGarrickErr).toBeLessThan(0.025);
  });

  it('uses the published Jones coefficients', () => {
    expect(JONES_WAGNER.c1).toBe(0.165);
    expect(JONES_WAGNER.lambda1).toBe(0.0455);
    expect(JONES_WAGNER.c2).toBe(0.335);
    expect(JONES_WAGNER.lambda2).toBe(0.3);
  });

  it('rejects negative reduced times', () => {
    expect(() => wagnerJones(-1)).toThrow();
    expect(() => wagnerExact(-1)).toThrow();
  });
});

describe('Theodorsen harmonic lift', () => {
  it('pure plunge: quasi-steady limit CL → 0 as k → 0', () => {
    const l = theodorsenPlungeLift(1e-3);
    expect(l.amplitude).toBeLessThan(0.01);
  });

  it('pure plunge: apparent-mass term dominates at high frequency (|CL| ~ πk²)', () => {
    const l = theodorsenPlungeLift(10);
    expect(l.nonCirculatoryAmp).toBeCloseTo(Math.PI * 100, 9);
    expect(l.amplitude / (Math.PI * 100)).toBeCloseTo(1, 1);
  });

  it('pure pitch about quarter-chord: quasi-steady limit |CL/α| → 2π with zero phase', () => {
    const l = theodorsenPitchLift(1e-3);
    expect(l.amplitude).toBeCloseTo(2 * Math.PI, 1);
    expect(Math.abs(l.phaseDeg)).toBeLessThan(5);
  });

  it('pure pitch: apparent mass dominates at high frequency (|CL/α| ~ 2πk, +90°)', () => {
    const l = theodorsenPitchLift(10);
    expect(l.amplitude).toBeGreaterThan(50);
    expect(l.nonCirculatoryAmp).toBeCloseTo(Math.PI * 10, 9);
  });
});

describe('Duhamel superposition ↔ Theodorsen (Garrick reciprocal relation)', () => {
  it('harmonic steady state matches the Jones-approximated Theodorsen amplitude', () => {
    // The Duhamel convolution uses the Jones Wagner kernel, whose Laplace
    // transform is the Jones-approximated C̃(k) — so the steady state must
    // match 2π·α0·|C̃(k)|, which itself is within ~1% of 2π·α0·|C(k)|.
    for (const k of [0.1, 0.5, 1.0]) {
      const d = duhamelHarmonic(0.1, k);
      expect(d.measuredAmplitude / d.theodorsenAmplitude).toBeGreaterThan(0.94);
      expect(d.measuredAmplitude / d.theodorsenAmplitude).toBeLessThan(1.05);
      expect(Math.abs(d.measuredPhaseDeg - d.theodorsenPhaseDeg)).toBeLessThan(4);
    }
  });

  it('is independent of the integration resolution', () => {
    const a = duhamelHarmonic(0.1, 0.5, 120, 480);
    const b = duhamelHarmonic(0.1, 0.5, 120, 1920);
    expect(a.measuredAmplitude / b.measuredAmplitude).toBeCloseTo(1, 2);
  });
});

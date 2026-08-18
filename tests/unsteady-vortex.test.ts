// Regression tests for services/unsteady-vortex.ts.
//
// The discrete unsteady vortex method (camber-line bound vortices + Kelvin
// shed wake, Katz & Plotkin ch. 13.6) must:
// - conserve total circulation exactly (Kelvin, machine precision),
// - track the exact Wagner function Φ(s) for the step response at s ≳ 2,
// - reach the same long-time value as the exact Wagner function (the wake
//   transient is algebraic, so Φ(20) ≈ 0.937 — NOT 2πα yet).

import { describe, expect, it } from 'vitest';

import { wagnerExact } from '@/services/unsteady';
import { unsteadyVortexStepResponse } from '@/services/unsteady-vortex';

const ALPHA_DEG = 5;
const ALPHA_RAD = (ALPHA_DEG * Math.PI) / 180;
const CL_STEADY = 2 * Math.PI * ALPHA_RAD;

function run() {
  return unsteadyVortexStepResponse(ALPHA_DEG, { nPanels: 16, dtReduced: 0.05, steps: 400 });
}

function stepAt(result: ReturnType<typeof run>, s: number) {
  const step = result.steps.find((x) => Math.abs(x.s - s) < 0.026);
  if (!step) throw new Error(`no step at s=${s}`);
  return step;
}

describe('discrete unsteady vortex method', () => {
  it('conserves total circulation (Kelvin) to machine precision', () => {
    const r = run();
    expect(r.maxKelvinResidual).toBeLessThan(1e-12);
    expect(r.steps.every((s) => Math.abs(s.kelvinResidual) < 1e-12)).toBe(true);
  });

  it('produces a positive-lift step response for positive angle of attack', () => {
    const r = run();
    expect(r.steps.every((s) => s.cl > 0)).toBe(true);
    expect(r.wake.every((w) => w.circulation > 0)).toBe(true); // starting vortex
    expect(r.wake.reduce((sum, w) => sum + w.circulation, 0)).toBeGreaterThan(0);
  });

  it('tracks the exact Wagner function for s ≥ 2 (documented early-time lag)', () => {
    const r = run();
    // The discrete point-vortex wake lags the exact sheet at small s (see the
    // module docs); the lag decays with s: ~8% at s=2, ~4% at s=5, ~1% at s=10.
    const tolerances: [number, number][] = [
      [2, 0.1],
      [5, 0.05],
      [10, 0.03],
    ];
    for (const [s, tol] of tolerances) {
      const ratio = stepAt(r, s).cl / CL_STEADY;
      expect(Math.abs(ratio - wagnerExact(s))).toBeLessThan(tol);
    }
  });

  it('matches the exact Wagner long-time value (algebraic transient)', () => {
    const r = run();
    const ratio = stepAt(r, 20).cl / CL_STEADY;
    expect(ratio).toBeCloseTo(wagnerExact(20), 2); // within ~1%
    // The transient is NOT finished at s = 20 (Φ(20) ≈ 0.937 < 1).
    expect(ratio).toBeLessThan(0.97);
  });

  it('responds monotonically after the initial transient', () => {
    const r = run();
    let prev = 0;
    for (const s of r.steps) {
      if (s.s < 1) continue;
      expect(s.cl).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s.cl;
    }
  });

  it('is anti-symmetric in angle of attack', () => {
    const up = unsteadyVortexStepResponse(3, { dtReduced: 0.05, steps: 200 });
    const down = unsteadyVortexStepResponse(-3, { dtReduced: 0.05, steps: 200 });
    for (let i = 0; i < up.steps.length; i += 1) {
      expect(up.steps[i].cl + down.steps[i].cl).toBeCloseTo(0, 9);
    }
  });

  it('converges to the same long-time value with a finer step', () => {
    const coarse = unsteadyVortexStepResponse(ALPHA_DEG, { nPanels: 16, dtReduced: 0.05, steps: 400 });
    const fine = unsteadyVortexStepResponse(ALPHA_DEG, { nPanels: 32, dtReduced: 0.02, steps: 1000 });
    expect(stepAt(coarse, 20).cl).toBeCloseTo(stepAt(fine, 20).cl, 2);
  });

  it('rejects invalid configuration', () => {
    expect(() => unsteadyVortexStepResponse(5, { nPanels: 2 })).toThrow();
    expect(() => unsteadyVortexStepResponse(5, { dtReduced: 2 })).toThrow();
    expect(() => unsteadyVortexStepResponse(Number.NaN)).toThrow();
  });
});

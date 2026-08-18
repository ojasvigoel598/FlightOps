// Regression/sanity tests for the game simulation model. These assert the
// contract the UI depends on (positive costs, non-negative stats, upgrade
// effects, feasibility), not physical fidelity — the engineering-grade
// physics lives in services/aerodynamics.ts.

import { describe, expect, it } from 'vitest';

import { DEFAULT_DESIGN, STARTING_COMPANY } from '@/constants/config';
import { computeVehicleStats, ratingLabel } from '@/services/simulation';

const baseContract = { payloadKg: 1200, distanceKm: 1200 };

describe('computeVehicleStats', () => {
  it('produces positive, finite values for the default design', () => {
    const s = computeVehicleStats(DEFAULT_DESIGN, baseContract.payloadKg, baseContract.distanceKm);
    expect(s.cost).toBeGreaterThan(0);
    expect(s.weightKg).toBeGreaterThan(0);
    expect(s.fuelBurnPerKm).toBeGreaterThan(0);
    expect(s.rangeKm).toBeGreaterThan(0);
    expect(Number.isFinite(s.safety)).toBe(true);
    expect(s.aeroEfficiency).toBeGreaterThanOrEqual(0);
    expect(s.aeroEfficiency).toBeLessThanOrEqual(100);
    expect(s.reliability).toBeGreaterThanOrEqual(0);
    expect(s.reliability).toBeLessThanOrEqual(99);
  });

  it('is feasible for short hops and infeasible for extreme ranges', () => {
    const easy = computeVehicleStats(DEFAULT_DESIGN, 500, 400);
    const hard = computeVehicleStats(DEFAULT_DESIGN, 10_000, 40_000);
    expect(easy.feasible).toBe(true);
    expect(hard.feasible).toBe(false);
    expect(hard.reservePct).toBeLessThan(0);
  });

  it('applies upgrade effects', () => {
    const plain = computeVehicleStats(DEFAULT_DESIGN, baseContract.payloadKg, baseContract.distanceKm);
    const precision = computeVehicleStats(DEFAULT_DESIGN, baseContract.payloadKg, baseContract.distanceKm, [
      'precision-machining',
    ]);
    const laminar = computeVehicleStats(DEFAULT_DESIGN, baseContract.payloadKg, baseContract.distanceKm, [
      'laminar-wings',
    ]);
    expect(precision.reliability).toBeGreaterThan(plain.reliability);
    expect(laminar.aeroEfficiency).toBeGreaterThan(plain.aeroEfficiency);
  });

  it('safety is never NaN and never exceeds 100', () => {
    for (const payload of [0, 300, 5000, 20_000]) {
      for (const distance of [100, 1000, 10_000]) {
        const s = computeVehicleStats(DEFAULT_DESIGN, payload, distance);
        expect(Number.isFinite(s.safety)).toBe(true);
        expect(s.safety).toBeGreaterThanOrEqual(0);
        expect(s.safety).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('ratingLabel', () => {
  it('maps scores to consistent qualitative labels', () => {
    expect(ratingLabel(90)).toBe('Excellent');
    expect(ratingLabel(70)).toBe('Good');
    expect(ratingLabel(55)).toBe('Fair');
    expect(ratingLabel(40)).toBe('Marginal');
    expect(ratingLabel(10)).toBe('Poor');
  });
});

describe('STARTING_COMPANY', () => {
  it('starts a new company solvent and at level 1', () => {
    expect(STARTING_COMPANY.money).toBeGreaterThan(0);
    expect(STARTING_COMPANY.level).toBe(1);
    expect(STARTING_COMPANY.xp).toBe(0);
  });
});

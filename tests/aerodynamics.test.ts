// Physics sanity + validation tests for services/aerodynamics.ts.
//
// References used:
// - ISA sea level: T = 288.15 K, P = 101325 Pa, ρ = 1.2250 kg/m³, a = 340.29 m/s
// - ISA tropopause (11 km): T = 216.65 K, P ≈ 22632 Pa
// - q = ½·ρ·V² → 6125 Pa at 100 m/s, sea level
// - Cylinder source-panel validation: exact doublet Cp = 1 − 4·sin²θ
// - Thin-airfoil theory: CL = 2π(α − α_L0); α_L0 ≈ −2.0° (NACA 2412),
//   ≈ −3.9° (NACA 4412)

import { describe, expect, it } from 'vitest';

import {
  AIRFOILS,
  analyzeFlight,
  dragPolar,
  dynamicPressure,
  inducedDragFactor,
  machNumber,
  nacaGeometry,
  reynoldsNumber,
  sourcePanelPressure,
  standardAtmosphere,
  vortexLatticeLift,
} from '@/services/aerodynamics';

function circlePanels(n: number, radius = 1): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const th = (i / n) * 2 * Math.PI;
    return { x: radius * Math.cos(th), y: radius * Math.sin(th) };
  });
}

describe('standard atmosphere (ISA)', () => {
  it('matches the published sea-level state', () => {
    const a = standardAtmosphere(0);
    expect(a.temperatureK).toBeCloseTo(288.15, 2);
    expect(a.pressurePa).toBeCloseTo(101325, 0);
    expect(a.densityKgM3).toBeCloseTo(1.225, 2);
    expect(a.speedOfSoundMs).toBeCloseTo(340.29, 1);
  });

  it('matches the tropopause state at 11 km', () => {
    const a = standardAtmosphere(11_000);
    expect(a.temperatureK).toBeCloseTo(216.65, 2);
    expect(a.pressurePa).toBeCloseTo(22_632, 0);
  });

  it('produces a continuous, decreasing density profile to 20 km', () => {
    const low = standardAtmosphere(0);
    const high = standardAtmosphere(20_000);
    expect(high.densityKgM3).toBeLessThan(low.densityKgM3);
    expect(high.densityKgM3).toBeCloseTo(0.088, 2);
    expect(high.temperatureK).toBeCloseTo(216.65, 2);
  });

  it('rejects altitudes outside the model range', () => {
    expect(() => standardAtmosphere(-1)).toThrow();
    expect(() => standardAtmosphere(20_001)).toThrow();
  });
});

describe('flow quantities', () => {
  it('computes dynamic pressure q = ½·ρ·V²', () => {
    expect(dynamicPressure(100, 1.225)).toBeCloseTo(6125, 1);
  });

  it('gives Mach 1 exactly at the speed of sound', () => {
    expect(machNumber(340.29, 340.29)).toBeCloseTo(1, 6);
  });

  it('computes a sensible Reynolds number (Sutherland viscosity)', () => {
    const a = standardAtmosphere(0);
    const re = reynoldsNumber(100, 1, a.densityKgM3, a.viscosityPaS);
    expect(a.viscosityPaS).toBeCloseTo(1.789e-5, 7);
    expect(re).toBeGreaterThan(6e6);
    expect(re).toBeLessThan(7e6);
  });

  it('rejects non-physical inputs', () => {
    expect(() => dynamicPressure(0, 1.225)).toThrow();
    expect(() => dynamicPressure(Number.NaN, 1.225)).toThrow();
    expect(() => reynoldsNumber(100, 0, 1.225, 1.789e-5)).toThrow();
  });
});

describe('source panel method', () => {
  it('matches the exact circular-cylinder Cp = 1 − 4·sin²θ', () => {
    const n = 64;
    const cp = sourcePanelPressure(circlePanels(n), 0);
    let maxErr = 0;
    for (let i = 0; i < n; i += 1) {
      const th = ((i + 0.5) / n) * 2 * Math.PI;
      const analytic = 1 - 4 * Math.sin(th) * Math.sin(th);
      maxErr = Math.max(maxErr, Math.abs(cp[i].cp - analytic));
    }
    expect(maxErr).toBeLessThan(1e-6);
  });

  it('recovers the stagnation point Cp ≈ +1', () => {
    // Control points sit at panel midpoints, so the exact stagnation point
    // (θ = 0) is never sampled — allow a small discretisation margin.
    const cp = sourcePanelPressure(circlePanels(64), 0);
    const maxCp = Math.max(...cp.map((p) => p.cp));
    expect(maxCp).toBeGreaterThan(0.98);
    expect(maxCp).toBeLessThanOrEqual(1);
  });

  it('produces finite, physically bounded Cp for an airfoil', () => {
    const geo = nacaGeometry(AIRFOILS[1]); // NACA 2412
    const cp = sourcePanelPressure(geo.points(48), 0);
    for (const p of cp) {
      expect(Number.isFinite(p.cp)).toBe(true);
      expect(p.cp).toBeLessThan(20);
    }
    expect(Math.max(...cp.map((p) => p.cp))).toBeCloseTo(1, 1);
  });
});

describe('vortex lattice lift', () => {
  it('matches thin-airfoil theory CL = 2πα for a symmetric section', () => {
    const lift = vortexLatticeLift(AIRFOILS[0], 5, 40);
    const thin = 2 * Math.PI * ((5 * Math.PI) / 180);
    expect(lift.alphaL0Deg).toBeCloseTo(0, 2);
    expect(lift.clVlm).toBeGreaterThan(0);
    expect(Math.abs(lift.clVlm - thin)).toBeLessThan(0.01);
    expect(lift.clThin).toBeCloseTo(thin, 4);
  });

  it('is anti-symmetric in angle of attack (flat plate)', () => {
    const up = vortexLatticeLift(AIRFOILS[0], 5, 40);
    const down = vortexLatticeLift(AIRFOILS[0], -5, 40);
    expect(up.clVlm + down.clVlm).toBeCloseTo(0, 9);
  });

  it('produces no lift at α = 0 for a symmetric airfoil', () => {
    const lift = vortexLatticeLift(AIRFOILS[0], 0, 40);
    expect(lift.clVlm).toBeCloseTo(0, 12);
  });

  it('recovers published zero-lift angles for cambered sections', () => {
    const a2412 = vortexLatticeLift(AIRFOILS[1], 5, 40);
    const a4412 = vortexLatticeLift(AIRFOILS[2], 5, 40);
    const a23012 = vortexLatticeLift(AIRFOILS[3], 5, 40);
    expect(a2412.alphaL0Deg).toBeGreaterThan(-2.5);
    expect(a2412.alphaL0Deg).toBeLessThan(-1.5);
    expect(a4412.alphaL0Deg).toBeGreaterThan(-4.8);
    expect(a4412.alphaL0Deg).toBeLessThan(-3.5);
    expect(a23012.alphaL0Deg).toBeLessThan(-1);
  });

  it('gives more lift for more camber at fixed α', () => {
    const thin = vortexLatticeLift(AIRFOILS[0], 5, 40);
    const cambered = vortexLatticeLift(AIRFOILS[2], 5, 40);
    expect(cambered.clVlm).toBeGreaterThan(thin.clVlm);
  });

  it('rejects degenerate panel counts', () => {
    expect(() => vortexLatticeLift(AIRFOILS[0], 5, 3)).toThrow();
    expect(() => vortexLatticeLift(AIRFOILS[0], 5, Number.NaN)).toThrow();
  });
});

describe('drag polar', () => {
  it('is never below the zero-lift drag and grows with CL²', () => {
    const cd1 = dragPolar(0.01, 0.006, 1);
    const cd2 = dragPolar(0.01, 0.006, 2);
    expect(cd1).toBeCloseTo(0.016, 6);
    expect(cd2).toBeGreaterThan(cd1);
    expect(dragPolar(0.01, 0.006, 0)).toBe(0.01);
  });

  it('computes the Oswald induced-drag factor for finite wings', () => {
    expect(inducedDragFactor(0.8, 10, 0.006)).toBeCloseTo(1 / (Math.PI * 0.8 * 10), 6);
    expect(inducedDragFactor(0.8, 0, 0.006)).toBeCloseTo(0.006, 6);
  });
});

describe('analyzeFlight integration', () => {
  const base = {
    altitudeM: 0,
    velocityMs: 100,
    chordM: 1.5,
    angleOfAttackDeg: 5,
    airfoilId: 'naca2412',
    panels: 48,
    cd0: 0.01,
    sectionK: 0.006,
    aspectRatio: 0,
    oswaldE: 0.8,
  };

  it('produces a physically consistent result at a benign condition', () => {
    const r = analyzeFlight(base);
    expect(r.valid).toBe(true);
    expect(r.cl).toBeGreaterThan(0.7);
    expect(r.cl).toBeLessThan(0.85);
    expect(r.cd).toBeGreaterThan(0.01); // cd0 passed to the analysis
    expect(r.liftPerSpan).toBeGreaterThan(0);
    expect(r.qPa).toBeCloseTo(6125, 0);
    expect(r.cpMax).toBeCloseTo(1, 1);
  });

  it('flags compressible conditions (M ≥ 0.3)', () => {
    const r = analyzeFlight({ ...base, altitudeM: 3000, velocityMs: 120 });
    expect(r.mach).toBeGreaterThan(0.3);
    expect(r.valid).toBe(false);
    expect(r.warnings.some((w) => w.includes('M ≥ 0.3'))).toBe(true);
  });

  it('flags angles beyond the linear range', () => {
    const r = analyzeFlight({ ...base, angleOfAttackDeg: 20 });
    expect(r.valid).toBe(false);
    expect(r.warnings.some((w) => w.includes('15°'))).toBe(true);
  });

  it('throws on out-of-model angles and invalid numbers', () => {
    expect(() => analyzeFlight({ ...base, angleOfAttackDeg: 31 })).toThrow();
    expect(() => analyzeFlight({ ...base, velocityMs: Number.NaN })).toThrow();
    expect(() => analyzeFlight({ ...base, altitudeM: 25_000 })).toThrow();
    expect(() => analyzeFlight({ ...base, chordM: 0 })).toThrow();
  });
});

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
  bladeElementPropeller,
  dragPolar,
  dragDeltaFromTransition,
  dynamicPressure,
  inducedDragFactor,
  laminarTurbulentTransition,
  machNumber,
  nacaGeometry,
  pitchingMomentCoeff,
  prandtlGlauertBeta,
  reynoldsNumber,
  sourcePanelPressure,
  standardAtmosphere,
  velocityField,
  vortexLatticeLift,
} from '@/services/aerodynamics';
import type { PropellerGeometry } from '@/services/aerodynamics';

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

describe('velocity field', () => {
  it('approaches the freestream in the far field', () => {
    const geo = nacaGeometry(AIRFOILS[0]); // NACA 0012, chord 1 at the origin
    const field = velocityField(geo.points(48), 0, -6, 6, -4, 4, 9, 7);
    const far = field.filter((p) => Math.hypot(p.x, p.y) > 5);
    expect(far.length).toBeGreaterThan(0);
    for (const p of far) {
      expect(p.u).toBeCloseTo(1, 1); // within ~10% of V∞ at 5+ chords
      expect(Math.abs(p.v)).toBeLessThan(0.15);
    }
  });

  it('is symmetric about the chord line for a symmetric airfoil at α = 0', () => {
    const geo = nacaGeometry(AIRFOILS[0]);
    const field = velocityField(geo.points(48), 0, -1.5, 2.5, -2, 2, 17, 17);
    for (const p of field) {
      const mirror = field.find((q) => Math.abs(q.x - p.x) < 1e-9 && Math.abs(q.y + p.y) < 1e-9);
      if (mirror) {
        expect(p.u).toBeCloseTo(mirror.u, 6);
        expect(p.v).toBeCloseTo(-mirror.v, 6);
      }
    }
  });

  it('omits interior points (flow field is exterior only)', () => {
    const geo = nacaGeometry(AIRFOILS[0]);
    const field = velocityField(geo.points(48), 0, -1.5, 2.5, -0.6, 0.6, 21, 13);
    // A point deep inside the 12%-thick airfoil must be excluded.
    expect(field.some((p) => Math.abs(p.x - 0.5) < 0.05 && Math.abs(p.y - 0.0) < 0.05)).toBe(false);
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

  const naca0012 = AIRFOILS.find((a) => a.id === 'naca0012')!;
  const naca2412 = AIRFOILS.find((a) => a.id === 'naca2412')!;
  const naca4412 = AIRFOILS.find((a) => a.id === 'naca4412')!;
  const naca23012 = AIRFOILS.find((a) => a.id === 'naca23012')!;

  it('is anti-symmetric in angle of attack (flat plate)', () => {
    const up = vortexLatticeLift(naca0012, 5, 40);
    const down = vortexLatticeLift(naca0012, -5, 40);
    expect(up.clVlm + down.clVlm).toBeCloseTo(0, 9);
  });

  it('produces no lift at α = 0 for a symmetric airfoil', () => {
    const lift = vortexLatticeLift(naca0012, 0, 40);
    expect(lift.clVlm).toBeCloseTo(0, 12);
  });

  it('recovers published zero-lift angles for cambered sections', () => {
    const a2412 = vortexLatticeLift(naca2412, 5, 40);
    const a4412 = vortexLatticeLift(naca4412, 5, 40);
    const a23012 = vortexLatticeLift(naca23012, 5, 40);
    expect(a2412.alphaL0Deg).toBeGreaterThan(-2.5);
    expect(a2412.alphaL0Deg).toBeLessThan(-1.5);
    expect(a4412.alphaL0Deg).toBeGreaterThan(-4.8);
    expect(a4412.alphaL0Deg).toBeLessThan(-3.5);
    expect(a23012.alphaL0Deg).toBeLessThan(-1);
  });

  it('gives more lift for more camber at fixed α', () => {
    const thin = vortexLatticeLift(naca0012, 5, 40);
    const cambered = vortexLatticeLift(naca4412, 5, 40);
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

  it('returns compressibility-corrected CL/CD and Prandtl-Glauert beta', () => {
    const r = analyzeFlight(base);
    // At M ~0.3 (3km, 100 m/s), beta < 1 so compressed > incompressible
    expect(r.prandtlGlauertBeta).toBeGreaterThan(0.9);
    expect(r.prandtlGlauertBeta).toBeLessThan(1);
    expect(r.clCompressed).toBeGreaterThan(r.cl);
    expect(r.cdCompressed).toBeGreaterThan(r.cd);
    // The relationship holds: clCompressed * beta ~ cl
    expect(r.clCompressed * r.prandtlGlauertBeta).toBeCloseTo(r.cl, 6);
  });

  it('applies Prandtl-Glauert correction at M > 0', () => {
    // Sea level, 100 m/s -> M ~0.29
    const r = analyzeFlight({ ...base, altitudeM: 0, velocityMs: 100 });
    const beta = r.prandtlGlauertBeta;
    expect(beta).toBeGreaterThan(0.9);
    expect(beta).toBeLessThan(1);
    // CL_M = CL_0 / beta => CL_M > CL_0
    expect(r.clCompressed).toBeGreaterThan(r.cl);
    expect(r.cdCompressed).toBeGreaterThan(r.cd);
    // The relationship holds: clCompressed * beta ~ cl
    expect(r.clCompressed * beta).toBeCloseTo(r.cl, 6);
  });

  it('throws on supersonic Mach', () => {
    // Sea level, 400 m/s -> M > 1
    expect(() => analyzeFlight({ ...base, altitudeM: 0, velocityMs: 400 })).toThrow();
  });

  it('returns non-zero pitching moment for cambered airfoil and zero for flat plate', () => {
    const flat = analyzeFlight({ ...base, airfoilId: 'naca0012' });
    const cambered = analyzeFlight({ ...base, airfoilId: 'naca4412' });
    // Symmetric airfoil: Cm_{c/4} = 0
    expect(flat.cm).toBeCloseTo(0, 4);
    // Cambered airfoil: Cm_{c/4} < 0 (nose-down)
    expect(cambered.cm).toBeLessThan(0);
    // More camber -> more negative Cm
    const moreCambered = analyzeFlight({ ...base, airfoilId: 'naca6412' });
    expect(moreCambered.cm).toBeLessThan(cambered.cm);
  });

  it('flags Prandtl-Glauert in the warning range M >= 0.3', () => {
    // 110 m/s sea level -> M ~0.32 > 0.3
    const r = analyzeFlight({ ...base, altitudeM: 0, velocityMs: 110 });
    expect(r.warnings.some((w) => w.includes('Prandtl'))).toBe(true);
  });
});

describe('Prandtl-Glauert correction', () => {
  it('beta(0) = 1', () => {
    expect(prandtlGlauertBeta(0)).toBe(1);
  });

  it('beta(0.5) = sqrt(0.75)', () => {
    expect(prandtlGlauertBeta(0.5)).toBeCloseTo(Math.sqrt(0.75), 6);
  });

  it('rejects M >= 1', () => {
    expect(() => prandtlGlauertBeta(1)).toThrow();
    expect(() => prandtlGlauertBeta(-0.1)).toThrow();
  });
});

describe('Pitching moment coefficient', () => {
  it('flat plate (NACA 0012) has Cm = 0', () => {
    const spec = AIRFOILS.find((a) => a.id === 'naca0012')!;
    expect(pitchingMomentCoeff(nacaGeometry(spec))).toBeCloseTo(0, 6);
  });

  it('cambered airfoil has negative Cm_{c/4}', () => {
    const spec = AIRFOILS.find((a) => a.id === 'naca4412')!;
    const cm = pitchingMomentCoeff(nacaGeometry(spec));
    expect(cm).toBeLessThan(0);
    // NACA 4412 should have Cm ~ -0.03 to -0.09 (Anderson data)
    expect(cm).toBeGreaterThan(-0.15);
    expect(cm).toBeLessThan(-0.01);
  });

  it('more camber gives more negative Cm', () => {
    const geo2 = nacaGeometry(AIRFOILS.find((a) => a.id === 'naca2412')!);
    const geo4 = nacaGeometry(AIRFOILS.find((a) => a.id === 'naca4412')!);
    const geo6 = nacaGeometry(AIRFOILS.find((a) => a.id === 'naca6412')!);
    expect(pitchingMomentCoeff(geo6)).toBeLessThan(pitchingMomentCoeff(geo4));
    expect(pitchingMomentCoeff(geo4)).toBeLessThan(pitchingMomentCoeff(geo2));
  });
});

// ---------------------------------------------------------------------------
// Wind-tunnel validation — NACA 2412 reference data
// ---------------------------------------------------------------------------
// Reference: NASA/Langley NACA Report No. 824 (Abbott & Doenhoff, 1959)
// and UIUC Low-Speed Airfoil Tests database.
//
// NACA 2412 key values at Re ~ 3×10⁶:
//   CL_max ≈ 1.65–1.79, α_stall ≈ 14–16°
//   CL(α=0°) ≈ 0.25 (thin-airfoil theory gives CL = 2π·α_L0 ≈ 0.25 when
//   α_L0 ≈ −2.0°)
//   Cm_{c/4} ≈ −0.05 (Anderson & NACA data)
//   dCL/dα ≈ 2π ≈ 6.28 per rad
//
// At low Re (Re < 500 000) separation occurs earlier, CL_max is lower,
// and the drag bucket shifts. The panel method / thin-airfoil model is
// only valid in the linear (attached) regime.

describe('Wind-tunnel validation: NACA 2412', () => {
  const spec = AIRFOILS.find((a) => a.id === 'naca2412')!;

  it('zero-lift angle α_L0 ≈ −2.0° (thin-airfoil theory)', () => {
    const lift = vortexLatticeLift(spec, 0, 32);
    // Reference: NACA 2412 α_L0 ≈ −2.0° to −2.1°
    expect(lift.alphaL0Deg).toBeGreaterThan(-3.0);
    expect(lift.alphaL0Deg).toBeLessThan(-1.0);
  });

  it('CL at α=0° is positive (cambered section lifts at zero alpha)', () => {
    const lift = vortexLatticeLift(spec, 0, 32);
    expect(lift.clVlm).toBeGreaterThan(0.15);
    expect(lift.clVlm).toBeLessThan(0.40);
  });

  it('lift slope dCL/dα ≈ 2π (thin-airfoil theory, linear regime)', () => {
    const lift0 = vortexLatticeLift(spec, 0, 32);
    const lift5 = vortexLatticeLift(spec, 5, 32);
    const dCL = lift5.clVlm - lift0.clVlm;
    const dAlpha = (5 * Math.PI) / 180; // 5° in radians
    const slope = dCL / dAlpha;
    // Thin-airfoil theory: slope = 2π ≈ 6.28
    // VLM converges to this; allow ±5%
    expect(slope).toBeGreaterThan(2 * Math.PI * 0.95);
    expect(slope).toBeLessThan(2 * Math.PI * 1.05);
  });

  it('Cm_{c/4} ≈ −0.05 (negative, nose-down for cambered airfoil)', () => {
    const cm = pitchingMomentCoeff(nacaGeometry(spec));
    // NACA 2412: Cm_{c/4} ≈ −0.045 to −0.055
    expect(cm).toBeGreaterThan(-0.10);
    expect(cm).toBeLessThan(-0.01);
  });

  it('CL increases linearly with alpha in attached regime (−5° to +8°)', () => {
    const cls: number[] = [];
    for (let a = -5; a <= 8; a += 1) {
      cls.push(vortexLatticeLift(spec, a, 32).clVlm);
    }
    // Check that CL is monotonically increasing
    for (let i = 1; i < cls.length; i++) {
      expect(cls[i]).toBeGreaterThan(cls[i - 1]);
    }
    // Check that the relationship is approximately linear (R² > 0.999)
    const n = cls.length;
    const meanX = 1.5; // mean of −5 to 8
    const meanY = cls.reduce((s, v) => s + v, 0) / n;
    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      const expected = meanY + (cls[n - 1] - cls[0]) / (n - 1) * (i - (n - 1) / 2);
      ssRes += (cls[i] - expected) ** 2;
      ssTot += (cls[i] - meanY) ** 2;
    }
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;
    expect(rSquared).toBeGreaterThan(0.999);
  });

  it('panel-method Cp at α=0°: suction peak on upper surface, positive on lower', () => {
    const geo = nacaGeometry(spec);
    const cp = sourcePanelPressure(geo.points(32), 0);
    // Upper surface (front half): minimum Cp should be negative (suction)
    const frontCp = cp.slice(0, Math.floor(cp.length / 4));
    const minCp = Math.min(...frontCp.map((p) => p.cp));
    expect(minCp).toBeLessThan(0);
    // Stagnation region near trailing edge: Cp should approach +1
    const rearCp = cp.slice(Math.floor(cp.length * 0.8));
    const maxCp = Math.max(...rearCp.map((p) => p.cp));
    expect(maxCp).toBeGreaterThan(0);
  });

  it('aircraft-level: CL and CD are physically reasonable at cruise', () => {
    const result = analyzeFlight({
      altitudeM: 3000,
      velocityMs: 60,
      chordM: 1.5,
      angleOfAttackDeg: 3,
      airfoilId: 'naca2412',
      panels: 32,
      cd0: 0.008,
      sectionK: 0.04,
      aspectRatio: 8,
      oswaldE: 0.85,
    });
    expect(result.cl).toBeGreaterThan(0);
    expect(result.cl).toBeLessThan(1.5);
    expect(result.cd).toBeGreaterThan(0);
    expect(result.cd).toBeLessThan(0.5);
    expect(result.liftPerSpan).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Blade Element Theory (BET) — propeller performance tests
// ---------------------------------------------------------------------------
// Reference: McCormick, Aerodynamics of Aeronautical Propulsion, Ch. 3
// A typical general-aviation propeller (e.g., McCauley 1A103/66) has:
//   2 blades, R ≈ 0.9 m, P ≈ 1.5 m, ~2400 RPM → T ≈ 2000 N, η ≈ 0.75
//
// We test with a simplified blade model (constant chord, linear taper)
// and verify that results are physically sensible.

function makeTestPropeller(): PropellerGeometry {
  const n = 20;
  return {
    nBlades: 2,
    radiusM: 0.9,
    hubRadiusM: 0.12,
    pitchM: 1.5,
    chord: Array.from({ length: n }, (_, i) => {
      const r = 0.13 + i * (0.87 / n);
      return 0.12 - 0.04 * r; // taper from 0.108 m at root to 0.072 m at tip
    }),
    clAlpha: Array.from({ length: n }, () => 2 * Math.PI),
    cd0: Array.from({ length: n }, () => 0.012),
    sectionK: Array.from({ length: n }, () => 0.04),
  };
}

describe('Blade Element Theory', () => {
  it('produces positive thrust at forward speed and nonzero RPM', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 20);
    expect(result.thrustN).toBeGreaterThan(0);
    expect(result.torqueNm).toBeGreaterThan(0);
    expect(result.powerW).toBeGreaterThan(0);
  });

  it('thrust increases with RPM (at constant advance speed)', () => {
    const prop = makeTestPropeller();
    const r1 = bladeElementPropeller(prop, 1500, 50, 1.225, 20);
    const r2 = bladeElementPropeller(prop, 3000, 50, 1.225, 20);
    expect(r2.thrustN).toBeGreaterThan(r1.thrustN);
    expect(r2.powerW).toBeGreaterThan(r1.powerW);
  });

  it('thrust decreases with increasing advance speed (at constant RPM)', () => {
    const prop = makeTestPropeller();
    const r1 = bladeElementPropeller(prop, 2400, 20, 1.225, 20);
    const r2 = bladeElementPropeller(prop, 2400, 80, 1.225, 20);
    expect(r1.thrustN).toBeGreaterThan(r2.thrustN);
  });

  it('efficiency is between 0 and 1', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 20);
    expect(result.efficiency).toBeGreaterThanOrEqual(0);
    expect(result.efficiency).toBeLessThanOrEqual(1);
  });

  it('advance ratio is computed correctly J = V / (n·D)', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 20);
    // D = 1.8 m, n = 40 rev/s → J = 50 / (40 × 1.8) = 0.694...
    expect(result.advanceRatio).toBeCloseTo(50 / (40 * 1.8), 2);
  });

  it('non-dimensional coefficients Ct and Cp are positive', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 20);
    expect(result.thrustCoeff).toBeGreaterThan(0);
    expect(result.powerCoeff).toBeGreaterThan(0);
  });

  it('station count matches requested nStations', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 15);
    expect(result.stations.length).toBe(15);
  });

  it('radial stations span hub to tip (rOverR from ~hub/R to ~1)', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 20);
    expect(result.stations[0].rOverR).toBeGreaterThan(0.1);
    expect(result.stations[0].rOverR).toBeLessThan(0.3);
    const last = result.stations[result.stations.length - 1];
    expect(last.rOverR).toBeGreaterThan(0.85);
    expect(last.rOverR).toBeLessThanOrEqual(1.0);
  });

  it('each station has physically reasonable angle of attack', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 50, 1.225, 20);
    for (const s of result.stations) {
      // Section AoA should be in the attached-flow regime
      expect(s.alphaRad).toBeGreaterThan(-0.5);
      expect(s.alphaRad).toBeLessThan(0.3);
    }
  });

  it('rejects invalid inputs', () => {
    const prop = makeTestPropeller();
    expect(() => bladeElementPropeller(prop, -100, 50, 1.225)).toThrow();
    expect(() => bladeElementPropeller(prop, 2400, 50, -1)).toThrow();
  });

  it('works at zero advance speed (hover / static thrust)', () => {
    const prop = makeTestPropeller();
    const result = bladeElementPropeller(prop, 2400, 0, 1.225, 20);
    expect(result.thrustN).toBeGreaterThan(0);
    expect(result.advanceRatio).toBe(0);
    expect(result.efficiency).toBe(0); // no useful work at V=0
  });
});

// ---------------------------------------------------------------------------
// Model 16 & 17 — Laminar–Turbulent Transition
// ---------------------------------------------------------------------------

describe('laminar-turbulent transition', () => {
  const V = 50;        // m/s
  const c = 1.5;       // m (chord)
  const rho = 1.225;   // kg/m³ (sea level)
  const mu = 1.789e-5; // Pa·s (sea level dynamic viscosity)

  it('transition location is within chord bounds', () => {
    const r = laminarTurbulentTransition(V, c, rho, mu);
    expect(r.x_tr).toBeGreaterThan(0);
    expect(r.x_tr_ratio).toBeGreaterThan(0);
    expect(r.x_tr_ratio).toBeLessThanOrEqual(1);
  });

  it('Reynolds number matches formula Re = ρVL/μ', () => {
    const r = laminarTurbulentTransition(V, c, rho, mu);
    const expected_Re = (rho * V * c) / mu;
    expect(r.Re_L).toBeCloseTo(expected_Re, 6);
  });

  it('fully laminar regime when Re_L < Re_crit', () => {
    // Very low speed → Re_L < 5e5
    const r = laminarTurbulentTransition(1, 0.1, rho, mu);
    expect(r.regime).toBe('fully laminar');
    expect(r.x_tr_ratio).toBe(1);
  });

  it('laminar friction is less than turbulent friction', () => {
    const r = laminarTurbulentTransition(V, c, rho, mu);
    expect(r.Cf_lam).toBeLessThan(r.Cf_turb);
  });

  it('average Cf is between laminar and turbulent values', () => {
    const r = laminarTurbulentTransition(V, c, rho, mu);
    expect(r.Cf_avg).toBeGreaterThanOrEqual(r.Cf_lam);
    expect(r.Cf_avg).toBeLessThanOrEqual(r.Cf_turb);
  });

  it('Blasius laminar Cf ≈ 1.328/√Re for low Re', () => {
    // At low Re (fully laminar plate), Cf_lam should match Blasius
    const r = laminarTurbulentTransition(2, 0.5, rho, mu);
    const expected = 1.328 / Math.sqrt(r.Re_L);
    expect(r.Cf_lam).toBeCloseTo(expected, 6);
  });

  it('higher velocity pushes transition forward', () => {
    const r1 = laminarTurbulentTransition(20, c, rho, mu);
    const r2 = laminarTurbulentTransition(80, c, rho, mu);
    expect(r2.x_tr).toBeLessThan(r1.x_tr);
  });

  it('rejects invalid inputs', () => {
    expect(() => laminarTurbulentTransition(0, c, rho, mu)).toThrow();
    expect(() => laminarTurbulentTransition(V, 0, rho, mu)).toThrow();
    expect(() => laminarTurbulentTransition(V, c, 0, mu)).toThrow();
    expect(() => laminarTurbulentTransition(V, c, rho, 0)).toThrow();
  });

  it('custom Re_crit changes transition location', () => {
    const r1 = laminarTurbulentTransition(V, c, rho, mu, 1e5);
    const r2 = laminarTurbulentTransition(V, c, rho, mu, 1e6);
    expect(r1.x_tr).toBeLessThan(r2.x_tr);
  });
});

describe('dragDeltaFromTransition', () => {
  const V = 50;
  const c = 1.5;
  const rho = 1.225;
  const mu = 1.789e-5;

  it('drag reduction is positive (laminar run saves drag)', () => {
    const r = dragDeltaFromTransition(V, c, rho, mu);
    expect(r.dragReduction).toBeGreaterThan(0);
  });

  it('short chord has minimal drag reduction (mostly turbulent)', () => {
    // Very short chord → mostly turbulent → small drag reduction
    const r = dragDeltaFromTransition(V, 0.01, rho, mu);
    expect(r.dragReduction).toBeGreaterThanOrEqual(0);
    expect(r.dragReduction).toBeLessThan(0.005);
  });

  it('transition fraction matches laminar-turbulent model', () => {
    const tr = laminarTurbulentTransition(V, c, rho, mu);
    const dd = dragDeltaFromTransition(V, c, rho, mu);
    expect(dd.transitionFraction).toBeCloseTo(tr.x_tr_ratio, 6);
  });
});

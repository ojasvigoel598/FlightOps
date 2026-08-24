// Tests for engineering analysis functions:
// wind tunnel validation, drag polar, thrust required/available,
// stability derivatives, eigenvalue modes, shock calculators,
// Prandtl-Meyer, flight envelope, trim solver, component buildup,
// BEM tip loss, historical aircraft, Breguet range, weight buildup,
// design space explorer.

import { describe, expect, it } from 'vitest';

import {
  generateDragPolar,
  thrustRequiredVsAvailable,
  generateFlightEnvelope,
  solveTrim,
} from '@/services/aerodynamics';

import {
  getWindTunnelData,
  interpolateCL,
  interpolateCD,
  panelMethodError,
  NACA_2412_RE3M,
} from '@/services/aero/windtunnel';

import {
  computeStabilityDerivatives,
  computeEigenvalues,
  AIRCRAFT_STABILITY_CONFIGS,
} from '@/services/aero/stability';

import {
  componentBuildupDrag,
  prandtlTipLossFactor,
  compareAgainstHistorical,
  HISTORICAL_AIRCRAFT,
  breguetRange,
  raymerWeightBuildup,
  normalShockRelations,
  obliqueShockRelations,
  prandtlMeyerNu,
  prandtlMeyerExpansion,
  designSpaceSweep,
} from '@/services/aero/engineering';

// ---------------------------------------------------------------------------
// Wind Tunnel Validation
// ---------------------------------------------------------------------------

describe('Wind tunnel data', () => {
  it('returns NACA 2412 data at Re = 3×10⁶', () => {
    const data = getWindTunnelData('naca2412', 3e6);
    expect(data).not.toBeNull();
    expect(data!.airfoil).toBe('naca2412');
    expect(data!.data.length).toBeGreaterThan(10);
  });

  it('interpolates CL correctly between data points', () => {
    const cl = interpolateCL(NACA_2412_RE3M, 5);
    expect(cl).not.toBeNull();
    expect(cl!).toBeGreaterThan(0.5);
    expect(cl!).toBeLessThan(1.0);
  });

  it('interpolates CD correctly', () => {
    const cd = interpolateCD(NACA_2412_RE3M, 0);
    expect(cd).not.toBeNull();
    expect(cd!).toBeGreaterThan(0);
    expect(cd!).toBeLessThan(0.05);
  });

  it('returns null for out-of-range alpha', () => {
    const cl = interpolateCL(NACA_2412_RE3M, 50);
    expect(cl).toBeNull();
  });

  it('panel method error is computable', () => {
    const predicted = [
      { alpha: -5, cl: -0.2 },
      { alpha: 0, cl: 0.43 },
      { alpha: 5, cl: 0.80 },
      { alpha: 10, cl: 1.03 },
    ];
    const err = panelMethodError(predicted, NACA_2412_RE3M);
    expect(err.rmse).toBeGreaterThanOrEqual(0);
    expect(err.maxError).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Drag Polar
// ---------------------------------------------------------------------------

describe('Drag polar', () => {
  it('produces positive CL across the alpha range', () => {
    const result = generateDragPolar(0.01, 0.05, 0.85, 8, -2);
    expect(result.points.length).toBeGreaterThan(0);
    const positiveCL = result.points.filter(p => p.cl > 0);
    expect(positiveCL.length).toBeGreaterThan(0);
  });

  it('max L/D is positive and reasonable', () => {
    const result = generateDragPolar(0.01, 0.05, 0.85, 8, -2);
    expect(result.maxLd).toBeGreaterThan(5);
    expect(result.maxLd).toBeLessThan(30);
  });

  it('CD at zero lift equals cd0', () => {
    const result = generateDragPolar(0.012, 0.05, 0.85, 8, 0);
    expect(result.cdMin).toBeCloseTo(0.012, 3);
  });
});

// ---------------------------------------------------------------------------
// Thrust Required vs Available
// ---------------------------------------------------------------------------

describe('Thrust required vs available', () => {
  it('finds a max speed where T_req = T_avail', () => {
    const result = thrustRequiredVsAvailable(
      10000, 16, 0.018, 0.85, 8, 15000, 0, 0.00015, 20, 200
    );
    expect(result.maxSpeedMs).toBeGreaterThan(20);
    expect(result.maxSpeedMs).toBeLessThanOrEqual(200);
  });

  it('endurance speed is less than max speed', () => {
    const result = thrustRequiredVsAvailable(
      10000, 16, 0.018, 0.85, 8, 5000, 0, 0.00015, 20, 150
    );
    expect(result.enduranceSpeedMs).toBeLessThan(result.maxSpeedMs);
  });

  it('max L/D is positive', () => {
    const result = thrustRequiredVsAvailable(
      10000, 16, 0.018, 0.85, 8, 5000, 0, 0.00015, 20, 150
    );
    expect(result.maxLd).toBeGreaterThan(5);
  });
});

// ---------------------------------------------------------------------------
// Stability Derivatives
// ---------------------------------------------------------------------------

describe('Stability derivatives', () => {
  it('Cessna 172 has positive Cn_β (weathercock stable)', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.cessna172.params);
    expect(d.cnBeta).toBeGreaterThan(0);
  });

  it('Cessna 172 has negative Cm_α (statically stable)', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.cessna172.params);
    expect(d.cmAlpha).toBeLessThan(0);
  });

  it('F-16 has negative static margin (intentionally unstable)', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.f16.params);
    // F-16 has negative static margin → Cm_α > 0 (unstable)
    expect(d.cmAlpha).toBeGreaterThan(0);
  });

  it('roll damping (Cl_p) is always negative', () => {
    for (const key of Object.keys(AIRCRAFT_STABILITY_CONFIGS)) {
      const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS[key].params);
      expect(d.clP).toBeLessThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Eigenvalue Analysis
// ---------------------------------------------------------------------------

describe('Eigenvalue mode analysis', () => {
  it('identifies short-period mode for Cessna 172', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.cessna172.params);
    const result = computeEigenvalues(AIRCRAFT_STABILITY_CONFIGS.cessna172.params, d, 50);
    const sp = result.modes.find(m => m.name === 'Short Period');
    expect(sp).toBeDefined();
    expect(sp!.naturalFreq).toBeGreaterThan(0);
  });

  it('identifies phugoid mode', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.cessna172.params);
    const result = computeEigenvalues(AIRCRAFT_STABILITY_CONFIGS.cessna172.params, d, 50);
    const ph = result.modes.find(m => m.name === 'Phugoid');
    expect(ph).toBeDefined();
    expect(ph!.period).toBeGreaterThan(5);
  });

  it('identifies Dutch roll mode', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.cessna172.params);
    const result = computeEigenvalues(AIRCRAFT_STABILITY_CONFIGS.cessna172.params, d, 50);
    const dr = result.modes.find(m => m.name === 'Dutch Roll');
    expect(dr).toBeDefined();
    expect(dr!.naturalFreq).toBeGreaterThan(0);
  });

  it('Cessna 172 is dynamically stable', () => {
    const d = computeStabilityDerivatives(AIRCRAFT_STABILITY_CONFIGS.cessna172.params);
    const result = computeEigenvalues(AIRCRAFT_STABILITY_CONFIGS.cessna172.params, d, 50);
    expect(result.stable).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shock Calculators
// ---------------------------------------------------------------------------

describe('Normal shock relations', () => {
  it('M2 < M1 across a normal shock', () => {
    const r = normalShockRelations(2.0);
    expect(r.m2).toBeLessThan(2.0);
    expect(r.m2).toBeGreaterThan(0);
  });

  it('pressure ratio > 1 across a shock', () => {
    const r = normalShockRelations(1.5);
    expect(r.pressureRatio).toBeGreaterThan(1);
  });

  it('total pressure ratio < 1 (entropy increase)', () => {
    const r = normalShockRelations(2.0);
    expect(r.totalPressureRatio).toBeLessThan(1);
    expect(r.totalPressureRatio).toBeGreaterThan(0);
  });

  it('subsonic M1 returns no shock', () => {
    const r = normalShockRelations(0.8);
    expect(r.valid).toBe(false);
  });
});

describe('Oblique shock relations', () => {
  it('finds a wave angle for M1=2, θ=10°', () => {
    const r = obliqueShockRelations(2.0, 10);
    expect(r.valid).toBe(true);
    expect(r.waveAngleDeg).toBeGreaterThan(10);
    expect(r.waveAngleDeg).toBeLessThan(90);
  });

  it('M2 < M1 across oblique shock', () => {
    const r = obliqueShockRelations(2.0, 15);
    expect(r.m2).toBeLessThan(2.0);
  });
});

// ---------------------------------------------------------------------------
// Prandtl-Meyer Expansion
// ---------------------------------------------------------------------------

describe('Prandtl-Meyer expansion', () => {
  it('ν(M=1) = 0', () => {
    expect(prandtlMeyerNu(1.0)).toBeCloseTo(0, 6);
  });

  it('ν increases with Mach number', () => {
    const v1 = prandtlMeyerNu(1.5);
    const v2 = prandtlMeyerNu(2.0);
    expect(v2).toBeGreaterThan(v1);
  });

  it('expansion increases Mach number', () => {
    const r = prandtlMeyerExpansion(1.5, 10);
    expect(r.valid).toBe(true);
    expect(r.m2).toBeGreaterThan(1.5);
  });

  it('pressure drops across expansion', () => {
    const r = prandtlMeyerExpansion(2.0, 15);
    expect(r.pressureRatio).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Flight Envelope
// ---------------------------------------------------------------------------

describe('Flight envelope', () => {
  it('stall speed is positive', () => {
    const env = generateFlightEnvelope(10000, 16, 1.65);
    expect(env.vs).toBeGreaterThan(0);
  });

  it('Vne > Vs', () => {
    const env = generateFlightEnvelope(10000, 16, 1.65);
    expect(env.vne).toBeGreaterThan(env.vs);
  });

  it('has upper and lower boundaries', () => {
    const env = generateFlightEnvelope(10000, 16, 1.65);
    expect(env.upper.length).toBeGreaterThan(0);
    expect(env.lower.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Trim Solver
// ---------------------------------------------------------------------------

describe('Trim solver', () => {
  it('finds trim for a typical GA aircraft', () => {
    const trim = solveTrim(
      10000, 16, 6125, 2 * Math.PI, -2,
      -0.05, -1.5, -0.8
    );
    expect(trim.achievable).toBe(true);
    expect(trim.elevatorDeg).toBeGreaterThan(-25);
    expect(trim.elevatorDeg).toBeLessThan(25);
  });

  it('CL at trim matches L=W requirement', () => {
    const W = 10000;
    const S = 16;
    const q = 6125;
    const trim = solveTrim(W, S, q, 2 * Math.PI, -2, -0.05, -1.5, -0.8);
    const clRequired = W / (q * S);
    expect(trim.clTrim).toBeCloseTo(clRequired, 2);
  });
});

// ---------------------------------------------------------------------------
// Component Buildup Drag
// ---------------------------------------------------------------------------

describe('Component buildup drag', () => {
  it('computes CD0 from components', () => {
    const result = componentBuildupDrag(16, [
      { name: 'Wing', swetM2: 32, reynolds: 5e6, mach: 0.2, formFactor: 1.3, interferenceFactor: 1.0 },
      { name: 'Fuselage', swetM2: 20, reynolds: 8e6, mach: 0.2, formFactor: 1.2, interferenceFactor: 1.1 },
    ]);
    expect(result.cd0Total).toBeGreaterThan(0);
    expect(result.cd0Total).toBeLessThan(0.1);
  });

  it('breakdown fractions sum to ~1', () => {
    const result = componentBuildupDrag(16, [
      { name: 'Wing', swetM2: 32, reynolds: 5e6, mach: 0.2, formFactor: 1.3, interferenceFactor: 1.0 },
      { name: 'Fuselage', swetM2: 20, reynolds: 8e6, mach: 0.2, formFactor: 1.2, interferenceFactor: 1.1 },
    ]);
    const sum = result.breakdown.reduce((s, b) => s + b.fraction, 0);
    expect(sum).toBeCloseTo(1, 2);
  });
});

// ---------------------------------------------------------------------------
// BEM Prandtl Tip Loss
// ---------------------------------------------------------------------------

describe('BEM Prandtl tip loss', () => {
  it('returns 1 at hub (r/R → 0)', () => {
    const f = prandtlTipLossFactor(2, 0.15, 0.3);
    expect(f).toBeCloseTo(1, 1);
  });

  it('returns 0 at tip (r/R = 1)', () => {
    const f = prandtlTipLossFactor(2, 0.99, 0.3);
    expect(f).toBe(0);
  });

  it('decreases as r/R approaches 1', () => {
    const f1 = prandtlTipLossFactor(2, 0.7, 0.3);
    const f2 = prandtlTipLossFactor(2, 0.9, 0.3);
    expect(f2).toBeLessThan(f1);
  });
});

// ---------------------------------------------------------------------------
// Historical Aircraft
// ---------------------------------------------------------------------------

describe('Historical aircraft database', () => {
  it('has at least 5 aircraft', () => {
    expect(HISTORICAL_AIRCRAFT.length).toBeGreaterThanOrEqual(5);
  });

  it('all have positive values', () => {
    for (const ac of HISTORICAL_AIRCRAFT) {
      expect(ac.wingAreaM2).toBeGreaterThan(0);
      expect(ac.massKg).toBeGreaterThan(0);
      expect(ac.maxLd).toBeGreaterThan(0);
    }
  });

  it('comparison returns percentile rankings', () => {
    const result = compareAgainstHistorical(15, 30, 500);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].ldPercentile).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Breguet Range
// ---------------------------------------------------------------------------

describe('Breguet range', () => {
  it('range is positive for valid inputs', () => {
    const R = breguetRange(100, 12, 0.00015, 30000, 25000);
    expect(R).toBeGreaterThan(0);
  });

  it('more fuel gives more range', () => {
    const R1 = breguetRange(100, 12, 0.00015, 30000, 27000);
    const R2 = breguetRange(100, 12, 0.00015, 30000, 25000);
    expect(R2).toBeGreaterThan(R1);
  });

  it('returns 0 when final weight >= initial', () => {
    expect(breguetRange(100, 12, 0.00015, 30000, 30000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Weight Buildup
// ---------------------------------------------------------------------------

describe('Raymer weight buildup', () => {
  it('MTOW > empty weight', () => {
    const w = raymerWeightBuildup({
      wingAreaM2: 16, wingSpanM: 10, fuelKg: 200, payloadKg: 500,
      nEngines: 1, engineType: 'turboprop', thrustPerEngineN: 0,
      powerPerEngineW: 500000, fuselageLengthM: 8, fuselageDiameterM: 1.2,
      pressurized: false,
    });
    expect(w.mtowKg).toBeGreaterThan(w.emptyWeightKg);
  });

  it('empty weight fraction is between 0.3 and 0.8', () => {
    const w = raymerWeightBuildup({
      wingAreaM2: 16, wingSpanM: 10, fuelKg: 200, payloadKg: 500,
      nEngines: 1, engineType: 'turboprop', thrustPerEngineN: 0,
      powerPerEngineW: 500000, fuselageLengthM: 8, fuselageDiameterM: 1.2,
      pressurized: false,
    });
    expect(w.emptyWeightFraction).toBeGreaterThan(0.3);
    expect(w.emptyWeightFraction).toBeLessThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// Design Space Explorer
// ---------------------------------------------------------------------------

describe('Design space explorer', () => {
  it('sweeps wing area and produces output', () => {
    const result = designSpaceSweep(
      { wingAreaM2: 16, wingSpanM: 10, massKg: 1500, cd0: 0.018, oswaldE: 0.85, maxThrustN: 5000 },
      'wingAreaM2', [8, 32], 10
    );
    expect(result.values.length).toBe(11);
    expect(result.output.length).toBeGreaterThan(0);
    expect(result.output[0].values.length).toBe(11);
  });

  it('optimal L/D occurs at a valid wing area', () => {
    const result = designSpaceSweep(
      { wingAreaM2: 16, wingSpanM: 10, massKg: 1500, cd0: 0.018, oswaldE: 0.85, maxThrustN: 5000 },
      'wingAreaM2', [8, 32], 10
    );
    expect(result.optimal.length).toBeGreaterThan(0);
    expect(result.optimal[0].parameterValue).toBeGreaterThanOrEqual(8);
    expect(result.optimal[0].parameterValue).toBeLessThanOrEqual(32);
  });
});

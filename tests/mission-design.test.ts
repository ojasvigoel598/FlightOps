// Tests for services/mission-design.ts and services/aircraft-config.ts

import { describe, expect, it } from 'vitest';

import {
  computeMassBreakdown,
  computePerformance,
  defaultFuselageConfig,
  defaultPropulsionConfig,
  defaultTailConfig,
  defaultWingConfig,
} from '@/services/aircraft-config';
import {
  computeMissionRequirements,
  PRESET_MISSIONS,
  scoreMission,
} from '@/services/mission-design';

describe('Preset missions', () => {
  it('has all 8 mission types', () => {
    const types = Object.keys(PRESET_MISSIONS);
    expect(types).toHaveLength(8);
    expect(types).toContain('trainer');
    expect(types).toContain('regional-passenger');
    expect(types).toContain('long-range');
    expect(types).toContain('cargo');
    expect(types).toContain('surveillance');
    expect(types).toContain('high-speed');
    expect(types).toContain('agricultural');
    expect(types).toContain('custom');
  });

  it('has positive values for all required fields', () => {
    for (const mission of Object.values(PRESET_MISSIONS)) {
      expect(mission.rangeKm).toBeGreaterThan(0);
      expect(mission.enduranceMin).toBeGreaterThan(0);
      expect(mission.cruiseSpeedMs).toBeGreaterThan(0);
      expect(mission.altitudeM).toBeGreaterThanOrEqual(0);
      expect(mission.payloadKg).toBeGreaterThanOrEqual(0);
      expect(mission.reserveFraction).toBeGreaterThan(0);
      expect(mission.reserveFraction).toBeLessThan(1);
    }
  });
});

describe('computeMissionRequirements', () => {
  it('returns valid requirements for the trainer mission', () => {
    const req = computeMissionRequirements(PRESET_MISSIONS.trainer);
    expect(req.targetMassKg).toBeGreaterThan(0);
    expect(req.fuelMassKg).toBeGreaterThan(0);
    expect(req.requiredClCruise).toBeGreaterThan(0);
    expect(req.requiredLdCruise).toBeGreaterThan(0);
    expect(req.cruiseReynolds).toBeGreaterThan(1e4);
  });

  it('long-range mission requires more fuel', () => {
    const trainer = computeMissionRequirements(PRESET_MISSIONS.trainer);
    const longRange = computeMissionRequirements(PRESET_MISSIONS['long-range']);
    expect(longRange.fuelMassKg).toBeGreaterThan(trainer.fuelMassKg);
  });

  it('cargo mission handles large payload', () => {
    const req = computeMissionRequirements(PRESET_MISSIONS.cargo);
    expect(req.targetMassKg).toBeGreaterThan(5000);
  });

  it('surveillance UAV is light', () => {
    const req = computeMissionRequirements(PRESET_MISSIONS.surveillance);
    expect(req.targetMassKg).toBeLessThan(1000);
  });
});

describe('scoreMission', () => {
  it('gives high score when stats meet requirements', () => {
    const req = computeMissionRequirements(PRESET_MISSIONS.trainer);
    const score = scoreMission(req, {
      rangeKm: 300,
      weightKg: req.targetMassKg * 0.9,
      aeroEfficiency: 85,
      safety: 80,
      reliability: 90,
      feasible: true,
    });
    expect(score.overall).toBeGreaterThan(70);
    expect(score.feasible).toBe(true);
  });

  it('gives low score when aircraft is too heavy', () => {
    const req = computeMissionRequirements(PRESET_MISSIONS.trainer);
    const score = scoreMission(req, {
      rangeKm: 100,
      weightKg: req.targetMassKg * 1.5,
      aeroEfficiency: 40,
      safety: 30,
      reliability: 50,
      feasible: false,
    });
    expect(score.overall).toBeLessThan(60);
    expect(score.feasible).toBe(false);
  });
});

describe('Aircraft configuration defaults', () => {
  it('default wing has sensible geometry', () => {
    const wing = defaultWingConfig();
    expect(wing.spanM).toBeGreaterThan(0);
    expect(wing.areaM2).toBeGreaterThan(0);
    expect(wing.taperRatio).toBeGreaterThan(0);
    expect(wing.taperRatio).toBeLessThanOrEqual(1);
  });

  it('default tail has conventional configuration', () => {
    const tail = defaultTailConfig();
    expect(tail.configuration).toBe('conventional');
    expect(tail.htAreaM2).toBeGreaterThan(0);
    expect(tail.vtAreaM2).toBeGreaterThan(0);
    expect(tail.tailArmM).toBeGreaterThan(0);
  });

  it('default propulsion is turboprop', () => {
    const prop = defaultPropulsionConfig();
    expect(prop.type).toBe('turboprop');
    expect(prop.count).toBeGreaterThan(0);
    expect(prop.powerW).toBeGreaterThan(0);
    expect(prop.propEfficiency).toBeGreaterThan(0);
    expect(prop.propEfficiency).toBeLessThanOrEqual(1);
  });
});

describe('computeMassBreakdown', () => {
  it('total mass equals sum of components', () => {
    const wing = defaultWingConfig();
    const tail = defaultTailConfig();
    const fuselage = defaultFuselageConfig();
    const prop = defaultPropulsionConfig();
    const mass = computeMassBreakdown(wing, tail, fuselage, prop, 200, 500);

    const sum = mass.wingKg + mass.fuselageKg + mass.tailKg + mass.landingGearKg +
      mass.propulsionKg + mass.systemsKg + mass.fuelKg + mass.payloadKg;

    expect(mass.emptyMassKg).toBeCloseTo(sum - mass.fuelKg - mass.payloadKg, 0);
    expect(mass.mtomKg).toBeCloseTo(mass.emptyMassKg + mass.fuelKg + mass.payloadKg, 0);
  });

  it('CG is within the fuselage', () => {
    const mass = computeMassBreakdown(
      defaultWingConfig(), defaultTailConfig(), defaultFuselageConfig(),
      defaultPropulsionConfig(), 200, 500,
    );
    expect(mass.cgPositionM).toBeGreaterThan(0);
    expect(mass.cgPositionM).toBeLessThan(defaultFuselageConfig().lengthM);
  });
});

describe('computePerformance', () => {
  it('returns valid performance numbers', () => {
    const perf = computePerformance({
      name: 'test',
      wing: defaultWingConfig(),
      tail: defaultTailConfig(),
      fuselage: defaultFuselageConfig(),
      propulsion: defaultPropulsionConfig(),
      mass: computeMassBreakdown(
        defaultWingConfig(), defaultTailConfig(), defaultFuselageConfig(),
        defaultPropulsionConfig(), 200, 500,
      ),
    });

    expect(perf.aspectRatio).toBeGreaterThan(2);
    expect(perf.aspectRatio).toBeLessThan(20);
    expect(perf.cd0).toBeGreaterThan(0);
    expect(perf.cd0).toBeLessThan(0.1);
    expect(perf.maxLd).toBeGreaterThan(5);
    expect(perf.stallSpeedMs).toBeGreaterThan(10);
    expect(perf.stallSpeedMs).toBeLessThan(100);
    expect(perf.cruiseSpeedMs).toBeGreaterThan(20);
    expect(perf.rangeKm).toBeGreaterThan(0);
    expect(perf.enduranceMin).toBeGreaterThan(0);
  });

  it('higher aspect ratio gives better L/D', () => {
    const baseWing = defaultWingConfig();
    const shortWing = { ...baseWing, spanM: 8, areaM2: 16 }; // AR = 4
    const longWing = { ...baseWing, spanM: 14, areaM2: 16 }; // AR = 12.25

    const base = computePerformance({
      name: 'short', wing: shortWing, tail: defaultTailConfig(),
      fuselage: defaultFuselageConfig(), propulsion: defaultPropulsionConfig(),
      mass: computeMassBreakdown(shortWing, defaultTailConfig(), defaultFuselageConfig(),
        defaultPropulsionConfig(), 200, 500),
    });
    const improved = computePerformance({
      name: 'long', wing: longWing, tail: defaultTailConfig(),
      fuselage: defaultFuselageConfig(), propulsion: defaultPropulsionConfig(),
      mass: computeMassBreakdown(longWing, defaultTailConfig(), defaultFuselageConfig(),
        defaultPropulsionConfig(), 200, 500),
    });

    expect(improved.maxLd).toBeGreaterThan(base.maxLd);
  });
});

// Tests for services/aero-credits.ts

import { describe, expect, it } from 'vitest';

import {
  canUnlockTier,
  compareDesigns,
  computeReward,
  getAllExplanationKeys,
  getExplanation,
  initialCreditState,
  TECH_TIERS,
  unlockTier,
} from '@/services/aero-credits';

describe('Tech tiers', () => {
  it('has 8 tiers', () => {
    expect(TECH_TIERS).toHaveLength(8);
  });

  it('basic-analysis is free and has no prerequisites', () => {
    const basic = TECH_TIERS.find((t) => t.id === 'basic-analysis')!;
    expect(basic.cost).toBe(0);
    expect(basic.requires).toHaveLength(0);
  });

  it('vlm requires lifting-line', () => {
    const vlm = TECH_TIERS.find((t) => t.id === 'vlm')!;
    expect(vlm.requires).toContain('lifting-line');
  });
});

describe('Credit state', () => {
  it('starts with basic-analysis unlocked', () => {
    const state = initialCreditState();
    expect(state.unlockedTiers).toContain('basic-analysis');
    expect(state.credits).toBe(0);
  });

  it('can unlock a free tier immediately', () => {
    const state = initialCreditState();
    expect(canUnlockTier(state, 'basic-analysis')).toBe(false); // already unlocked
  });

  it('cannot unlock without prerequisites', () => {
    const state = initialCreditState();
    expect(canUnlockTier(state, 'vlm')).toBe(false); // needs lifting-line
  });

  it('can unlock when prerequisites met and credits sufficient', () => {
    const state = { ...initialCreditState(), credits: 500, unlockedTiers: ['basic-analysis'] };
    expect(canUnlockTier(state, 'lifting-line')).toBe(true);
  });

  it('cannot unlock without enough credits', () => {
    const state = { ...initialCreditState(), credits: 100, unlockedTiers: ['basic-analysis'] };
    expect(canUnlockTier(state, 'lifting-line')).toBe(false);
  });

  it('unlockTier deducts credits and adds tier', () => {
    const state = { ...initialCreditState(), credits: 500, unlockedTiers: ['basic-analysis'] };
    const newState = unlockTier(state, 'lifting-line');
    expect(newState).not.toBeNull();
    expect(newState!.credits).toBe(0);
    expect(newState!.unlockedTiers).toContain('lifting-line');
  });

  it('unlockTier returns null when cannot unlock', () => {
    const state = initialCreditState();
    expect(unlockTier(state, 'vlm')).toBeNull();
  });
});

describe('Mission rewards', () => {
  it('gives zero for failed mission', () => {
    const reward = computeReward({
      rangeKm: 100, requiredRangeKm: 500, ld: 10, safety: 80, payloadKg: 200, feasible: false, stallSpeedMs: 30,
    });
    expect(reward.totalReward).toBe(0);
  });

  it('gives base reward for completing a feasible mission', () => {
    const reward = computeReward({
      rangeKm: 500, requiredRangeKm: 500, ld: 10, safety: 80, payloadKg: 200, feasible: true, stallSpeedMs: 30,
    });
    expect(reward.totalReward).toBeGreaterThan(100);
    expect(reward.reasons.length).toBeGreaterThan(0);
  });

  it('rewards higher L/D more', () => {
    const low = computeReward({
      rangeKm: 500, requiredRangeKm: 500, ld: 8, safety: 80, payloadKg: 200, feasible: true, stallSpeedMs: 30,
    });
    const high = computeReward({
      rangeKm: 500, requiredRangeKm: 500, ld: 15, safety: 80, payloadKg: 200, feasible: true, stallSpeedMs: 30,
    });
    expect(high.totalReward).toBeGreaterThan(low.totalReward);
  });

  it('rewards range completion', () => {
    const partial = computeReward({
      rangeKm: 400, requiredRangeKm: 500, ld: 10, safety: 80, payloadKg: 200, feasible: true, stallSpeedMs: 30,
    });
    const full = computeReward({
      rangeKm: 500, requiredRangeKm: 500, ld: 10, safety: 80, payloadKg: 200, feasible: true, stallSpeedMs: 30,
    });
    expect(full.totalReward).toBeGreaterThan(partial.totalReward);
  });
});

describe('Design comparison', () => {
  it('positive improvement when new design is better', () => {
    const old = { rangeKm: 300, maxLd: 8, stallSpeedMs: 35, cd0: 0.02 };
    const new_ = { rangeKm: 500, maxLd: 12, stallSpeedMs: 25, cd0: 0.015 };
    const comp = compareDesigns(old, new_);
    expect(comp.improvement).toBeGreaterThan(0);
    expect(comp.changes.length).toBeGreaterThan(0);
  });

  it('negative when design gets worse', () => {
    const old = { rangeKm: 500, maxLd: 12, stallSpeedMs: 25, cd0: 0.015 };
    const new_ = { rangeKm: 300, maxLd: 8, stallSpeedMs: 35, cd0: 0.02 };
    const comp = compareDesigns(old, new_);
    expect(comp.improvement).toBeLessThan(0);
  });
});

describe('Educational explanations', () => {
  it('has explanations for key concepts', () => {
    const keys = getAllExplanationKeys();
    expect(keys).toContain('aspectRatio');
    expect(keys).toContain('wingLoading');
    expect(keys).toContain('staticMargin');
    expect(keys).toContain('lOverD');
    expect(keys).toContain('stallSpeed');
  });

  it('each explanation has all fields', () => {
    for (const key of getAllExplanationKeys()) {
      const exp = getExplanation(key)!;
      expect(exp.title.length).toBeGreaterThan(0);
      expect(exp.simple.length).toBeGreaterThan(0);
      expect(exp.engineering.length).toBeGreaterThan(0);
      expect(exp.whatToChange.length).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown key', () => {
    expect(getExplanation('nonexistent')).toBeNull();
  });
});

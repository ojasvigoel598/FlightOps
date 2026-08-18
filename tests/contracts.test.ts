import { describe, expect, it } from 'vitest';

import { generateContracts } from '@/services/contracts';

describe('generateContracts', () => {
  it('is deterministic for a fixed seed', () => {
    const a = generateContracts(1, 12345);
    const b = generateContracts(1, 12345);
    expect(a).toEqual(b);
  });

  it('varies with the seed', () => {
    const a = generateContracts(1, 12345);
    const b = generateContracts(1, 54321);
    expect(a).not.toEqual(b);
  });

  it('produces physically sane contracts', () => {
    for (const c of generateContracts(1, 999, 8)) {
      expect(c.payloadKg).toBeGreaterThan(0);
      expect(c.distanceKm).toBeGreaterThan(0);
      expect(c.reward).toBeGreaterThan(0);
      expect(['Routine', 'Standard', 'Demanding', 'Critical']).toContain(c.difficulty);
      expect(c.client.length).toBeGreaterThan(0);
      expect(c.title.length).toBeGreaterThan(0);
    }
  });

  it('scales difficulty with level', () => {
    const low = generateContracts(1, 7);
    const high = generateContracts(8, 7);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(high.map((c) => c.payloadKg))).toBeGreaterThan(avg(low.map((c) => c.payloadKg)));
  });
});

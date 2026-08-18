import { describe, expect, it } from 'vitest';

import { clamp, lerp, round } from '@/utils/math';

describe('clamp', () => {
  it('passes values inside the range through unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clips below and above the range', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('is deterministic for inverted bounds (degenerate input)', () => {
    expect(clamp(50, 100, 0)).toBe(0);
  });
});

describe('round', () => {
  it('rounds to the requested decimals', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.236, 2)).toBe(1.24);
    expect(round(0.5, 0)).toBe(1);
  });

  it('defaults to integers', () => {
    expect(round(1.7)).toBe(2);
  });

  it('handles negative values', () => {
    expect(round(-1.234, 2)).toBe(-1.23);
  });
});

describe('lerp', () => {
  it('interpolates linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
});

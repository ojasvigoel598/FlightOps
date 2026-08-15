// Powered by OnSpace.AI
// Small pure math helpers.

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, decimals = 0): number => {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Powered by OnSpace.AI
// Deterministic seeded pseudo-random generator (mulberry32).
// Given the same seed, a mission always produces reproducible outcomes.

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

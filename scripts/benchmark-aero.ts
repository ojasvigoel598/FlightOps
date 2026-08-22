/**
 * Aerodynamics Engine Performance Benchmark
 *
 * Measures execution time for core aero computations.
 * Run: npx tsx scripts/benchmark-aero.ts
 */

import { standardAtmosphere, bladeElementPropeller } from '../services/aerodynamics';
import { generateAirfoil } from '../services/aero/airfoil';
import { buildPanels, solvePanelMethod } from '../services/aero/panel';

function benchmark(name: string, fn: () => void, iterations = 100): number {
  for (let i = 0; i < 10; i++) fn(); // warm up
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  console.log(`  ${name}: median=${median.toFixed(2)}ms  p95=${p95.toFixed(2)}ms  p99=${p99.toFixed(2)}ms`);
  return median;
}

console.log('=== FlightOps Aerodynamics Engine Benchmark ===\n');

console.log('1. ISA Atmosphere');
benchmark('standardAtmosphere(0)', () => standardAtmosphere(0));
benchmark('standardAtmosphere(10000)', () => standardAtmosphere(10000));

console.log('\n2. Airfoil Geometry');
benchmark('generateAirfoil("2412", 64)', () => generateAirfoil('2412', 64));
benchmark('generateAirfoil("2412", 128)', () => generateAirfoil('2412', 128));

console.log('\n3. Panel Method');
const pts64 = generateAirfoil('2412', 64);
const geo64 = buildPanels(pts64);
benchmark('buildPanels(64)', () => buildPanels(pts64));
benchmark('solvePanelMethod(64, α=5°)', () => solvePanelMethod(geo64, 5));

const pts128 = generateAirfoil('2412', 128);
const geo128 = buildPanels(pts128);
benchmark('buildPanels(128)', () => buildPanels(pts128));
benchmark('solvePanelMethod(128, α=5°)', () => solvePanelMethod(geo128, 5));

console.log('\n4. Lift curve sweep (31 angles)');
benchmark('lift curve 128 panels', () => {
  const g = buildPanels(pts128);
  for (let a = -15; a <= 15; a += 1) solvePanelMethod(g, a);
});

console.log('\n5. Blade Element Theory');
const nStations = 20;
const betInput = {
  nBlades: 2, radiusM: 0.9, hubRadiusM: 0.12, pitchM: 1.5,
  chord: Array.from({ length: nStations }, (_, i) => 0.12 * (1 - 0.3 * (i + 1) / nStations)),
  clAlpha: Array(nStations).fill(2 * Math.PI),
  cd0: Array(nStations).fill(0.012),
  sectionK: Array(nStations).fill(0.04),
};
benchmark('BET (20 stations, 2400 RPM, 50 m/s)', () => bladeElementPropeller(betInput, 2400, 50, 1.225));

console.log('\n=== Done ===');

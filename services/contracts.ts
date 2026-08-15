// Powered by OnSpace.AI
// Contract generation. Deterministic per seed.

import type { Contract, Difficulty } from '@/types/game';
import { makeRng, pick, randInt, type Rng } from './rng';
import { round } from '@/utils/math';

const CLIENTS = [
  'SkyFreight Ltd',
  'Orbital Systems',
  'MediRelief Intl',
  'GeoSurvey Group',
  'Northwind Cargo',
  'Aster Dynamics',
  'Helios Logistics',
  'Meridian Air',
];

const CARGO = [
  'field hospital kit',
  'survey drones',
  'relief supplies',
  'satellite parts',
  'mining equipment',
  'comms array',
  'research payload',
  'spare turbines',
];

function difficultyFor(reservePressure: number): Difficulty {
  if (reservePressure < 0.3) return 'Routine';
  if (reservePressure < 0.55) return 'Standard';
  if (reservePressure < 0.8) return 'Demanding';
  return 'Critical';
}

function buildContract(level: number, seed: number): Contract {
  const r: Rng = makeRng(seed);
  const tier = Math.max(1, level + randInt(r, -1, 1));
  const payloadKg = round(300 + r() * (tier * 550) + 200, -1);
  const distanceKm = round(600 + r() * (tier * 850) + 300, -1);

  const reservePressure = r();
  const difficulty = difficultyFor(reservePressure);
  const diffBonus = { Routine: 0, Standard: 1.5, Demanding: 3, Critical: 5 }[difficulty];

  const reward = round(
    4 + (distanceKm / 1000) * 2.6 + (payloadKg / 1000) * 3.2 + tier + diffBonus,
    1,
  );

  const client = pick(r, CLIENTS);
  const cargo = pick(r, CARGO);
  const title = `Deliver ${cargo}`;

  return {
    id: `c-${seed}`,
    seed,
    title,
    client,
    payloadKg,
    distanceKm,
    reward,
    tier,
    difficulty,
  };
}

export function generateContracts(level: number, seedBase: number, count = 4): Contract[] {
  const r = makeRng(seedBase);
  return Array.from({ length: count }, () => buildContract(level, Math.floor(r() * 1e9)));
}

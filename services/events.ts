// Failure engine: event pool + weighted selection + outcome resolver.
// Pure functions driven by a seeded Rng for reproducibility.

import type { MissionEvent, Resolution, Telemetry, VehicleStats } from '@/types/game';
import type { Rng } from './rng';

export const EVENTS: MissionEvent[] = [
  {
    id: 'crosswind',
    title: 'Crosswind Alert',
    icon: 'weather-windy',
    band: ['takeoff', 'descent'],
    description: 'Severe crosswind gusts are pushing the airframe off centreline.',
    diagnosis: 'Low-speed handling determines how safely you can hold the line.',
    recommended: 'reduce',
    options: [
      { key: 'continue', label: 'Push through', hint: 'Fast, but risky if handling is weak' },
      { key: 'reduce', label: 'Reduce speed', hint: 'Safer control, small time cost' },
      { key: 'divert', label: 'Divert', hint: 'Avoid it, burns fuel & time' },
      { key: 'abort', label: 'Abort mission', hint: 'Safe on the ground, contract lost' },
    ],
  },
  {
    id: 'engine-vibration',
    title: 'Engine Vibration',
    icon: 'engine',
    band: ['cruise'],
    description: 'Vibration sensors are spiking on the main engine.',
    diagnosis: 'Untreated vibration cuts efficiency and raises fuel burn.',
    recommended: 'reduce-throttle',
    options: [
      { key: 'reduce-throttle', label: 'Reduce throttle', hint: 'Eases load, protects the engine' },
      { key: 'maintain', label: 'Maintain power', hint: 'Keep pace, risk a cascade' },
      { key: 'restart', label: 'In-flight restart', hint: 'Gamble to clear the fault' },
      { key: 'shutdown', label: 'Shut engine down', hint: 'Drastic, big performance hit' },
    ],
  },
  {
    id: 'fuel-leak',
    title: 'Fuel Leak',
    icon: 'gas-station-off',
    band: ['cruise'],
    description: 'Fuel pressure is dropping faster than planned burn.',
    diagnosis: 'Low reserves make a leak far more dangerous.',
    recommended: 'isolate',
    options: [
      { key: 'isolate', label: 'Isolate tank', hint: 'Stops the leak, lose some fuel' },
      { key: 'continue', label: 'Continue', hint: 'Ignore it, keeps draining' },
      { key: 'divert', label: 'Divert', hint: 'Safe, heavy fuel & time cost' },
      { key: 'reduce-speed', label: 'Reduce speed', hint: 'Slows the loss a little' },
    ],
  },
  {
    id: 'bird-strike',
    title: 'Bird Strike',
    icon: 'bird',
    band: ['takeoff'],
    description: 'A flock crossed the climb path and struck the airframe.',
    diagnosis: 'Impact damage may hide inside the intake.',
    recommended: 'reduce-altitude',
    options: [
      { key: 'continue', label: 'Continue climb', hint: 'Ignore it, gamble on damage' },
      { key: 'reduce-altitude', label: 'Level off', hint: 'Ease load, quick check' },
      { key: 'return', label: 'Return to field', hint: 'Very safe, big penalty' },
      { key: 'inspect', label: 'Run diagnostics', hint: 'Costs time, confirms status' },
    ],
  },
  {
    id: 'icing',
    title: 'Airframe Icing',
    icon: 'snowflake',
    band: ['takeoff', 'cruise'],
    description: 'Ice is accreting on the wings and sensors.',
    diagnosis: 'Ice adds weight and destroys lift if ignored.',
    recommended: 'anti-ice',
    options: [
      { key: 'anti-ice', label: 'Anti-ice on', hint: 'Clears ice, small fuel cost' },
      { key: 'descend', label: 'Descend to warm air', hint: 'Safe, costs fuel & time' },
      { key: 'continue', label: 'Continue', hint: 'Risk a lift loss' },
      { key: 'divert', label: 'Divert', hint: 'Escape the icing band' },
    ],
  },
  {
    id: 'turbulence',
    title: 'Severe Turbulence',
    icon: 'sine-wave',
    band: ['cruise'],
    description: 'Clear-air turbulence is stressing the airframe.',
    diagnosis: 'High speed in turbulence risks structural loads.',
    recommended: 'reduce-speed',
    options: [
      { key: 'reduce-speed', label: 'Slow to rough-air speed', hint: 'Protects the airframe' },
      { key: 'maintain', label: 'Maintain', hint: 'Keep pace, risk stress damage' },
      { key: 'change-alt', label: 'Change altitude', hint: 'Seek smooth air, costs fuel' },
      { key: 'continue', label: 'Ride it out', hint: 'Minor risk' },
    ],
  },
  {
    id: 'hydraulic',
    title: 'Hydraulic Warning',
    icon: 'water-alert',
    band: ['cruise', 'descent'],
    description: 'Hydraulic pressure is falling on the primary system.',
    diagnosis: 'Control authority weakens as pressure drops.',
    recommended: 'manual',
    options: [
      { key: 'manual', label: 'Manual reversion', hint: 'Reliable backup control' },
      { key: 'continue', label: 'Continue', hint: 'Risk losing control authority' },
      { key: 'divert', label: 'Divert', hint: 'Safe, costs fuel & time' },
      { key: 'troubleshoot', label: 'Troubleshoot', hint: 'Time cost, might fix it' },
    ],
  },
];

// How likely each event is, given the current design weaknesses.
function eventWeight(ev: MissionEvent, stats: VehicleStats): number {
  switch (ev.id) {
    case 'crosswind':
      return 1 + (100 - stats.lowSpeed) / 40;
    case 'engine-vibration':
      return 1 + (100 - stats.reliability) / 30;
    case 'fuel-leak':
      return 1 + Math.max(0, (60 - stats.reservePct) / 40);
    case 'bird-strike':
      return 0.8;
    case 'icing':
      return 1;
    case 'turbulence':
      return 1;
    case 'hydraulic':
      return 0.9 + (100 - stats.reliability) / 60;
    default:
      return 1;
  }
}

export function pickEvent(
  rng: Rng,
  band: 'takeoff' | 'cruise' | 'descent',
  stats: VehicleStats,
  excludeIds: string[],
): MissionEvent | null {
  const pool = EVENTS.filter((e) => e.band.includes(band) && !excludeIds.includes(e.id));
  if (pool.length === 0) return null;

  const weights = pool.map((e) => eventWeight(e, stats));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

// Resolve a player choice into telemetry deltas + a narrative message.
export function resolveOption(
  eventId: string,
  optionKey: string,
  rng: Rng,
  stats: VehicleStats,
): Resolution {
  const handlingSafe = stats.lowSpeed >= 75;

  switch (`${eventId}:${optionKey}`) {
    // Crosswind
    case 'crosswind:continue':
      if (handlingSafe || !chance(rng, 0.5)) {
        return { deltas: { progress: 4 }, message: 'You held the centreline and pressed on.' };
      }
      return {
        deltas: { integrity: -22 },
        message: 'The gust slammed the gear sideways — structural damage taken.',
      };
    case 'crosswind:reduce':
      return { deltas: { fuel: -3, progress: -3 }, message: 'Slower approach, full control kept.' };
    case 'crosswind:divert':
      return { deltas: { fuel: -12, progress: -8 }, message: 'Diverted around the front, fuel spent.' };
    case 'crosswind:abort':
      return { deltas: {}, message: 'You aborted safely on the ground.', abort: true };

    // Engine vibration
    case 'engine-vibration:reduce-throttle':
      return { deltas: { engine: 8, fuel: -2 }, message: 'Load eased, vibration settled.' };
    case 'engine-vibration:maintain':
      if (chance(rng, 0.5)) {
        return {
          deltas: { engine: -26, burnMod: 0.35 },
          message: 'Vibration cascaded — efficiency dropped and fuel burn spiked.',
        };
      }
      return { deltas: { progress: 3 }, message: 'It held together this time.' };
    case 'engine-vibration:restart':
      if (chance(rng, 0.55)) {
        return { deltas: { engine: 16 }, message: 'Clean restart cleared the fault.' };
      }
      return { deltas: { engine: -20, burnMod: 0.2 }, message: 'Restart failed, damage worsened.' };
    case 'engine-vibration:shutdown':
      return {
        deltas: { engine: 5, burnMod: 0.5, progress: -6, fuel: -6 },
        message: 'Engine secured — flying degraded on reduced power.',
      };

    // Fuel leak
    case 'fuel-leak:isolate':
      return { deltas: { fuel: -8 }, message: 'Tank isolated, leak stopped.' };
    case 'fuel-leak:continue':
      return { deltas: { fuel: -6, burnMod: 0.4 }, message: 'Leak keeps draining the tanks.' };
    case 'fuel-leak:divert':
      return { deltas: { fuel: -15, progress: -10 }, message: 'Diverted to protect the mission.' };
    case 'fuel-leak:reduce-speed':
      return { deltas: { fuel: -4, progress: -6, burnMod: 0.1 }, message: 'Slowed to limit the loss.' };

    // Bird strike
    case 'bird-strike:continue':
      if (chance(rng, 0.45)) {
        return { deltas: { engine: -20, integrity: -10 }, message: 'Ingested debris damaged the engine.' };
      }
      return { deltas: { progress: 3 }, message: 'No lasting damage detected.' };
    case 'bird-strike:reduce-altitude':
      return { deltas: { fuel: -3, progress: -4 }, message: 'Levelled off, systems nominal.' };
    case 'bird-strike:return':
      return { deltas: { fuel: -12, progress: -16 }, message: 'Returned, inspected, relaunched — costly.' };
    case 'bird-strike:inspect':
      return { deltas: { progress: -5 }, message: 'Diagnostics clean, continuing.' };

    // Icing
    case 'icing:anti-ice':
      return { deltas: { fuel: -5 }, message: 'Anti-ice cleared the surfaces.' };
    case 'icing:descend':
      return { deltas: { fuel: -8, progress: -3 }, message: 'Warm air melted the ice.' };
    case 'icing:continue':
      if (chance(rng, 0.5)) {
        return { deltas: { integrity: -18, engine: -8 }, message: 'Ice destroyed lift — hard hit taken.' };
      }
      return { deltas: {}, message: 'You slipped out of the icing band in time.' };
    case 'icing:divert':
      return { deltas: { fuel: -14, progress: -10 }, message: 'Diverted clear of the icing.' };

    // Turbulence
    case 'turbulence:reduce-speed':
      return { deltas: { progress: -4 }, message: 'Rough-air speed protected the airframe.' };
    case 'turbulence:maintain':
      if (chance(rng, 0.4)) {
        return { deltas: { integrity: -14 }, message: 'A jolt overstressed the wing spar.' };
      }
      return { deltas: { progress: 3 }, message: 'Pushed through without damage.' };
    case 'turbulence:change-alt':
      return { deltas: { fuel: -5 }, message: 'Found smoother air at a new level.' };
    case 'turbulence:continue':
      if (chance(rng, 0.25)) {
        return { deltas: { integrity: -8 }, message: 'Minor stress damage from the ride.' };
      }
      return { deltas: {}, message: 'It settled down quickly.' };

    // Hydraulic
    case 'hydraulic:manual':
      return { deltas: { integrity: -4, progress: -3 }, message: 'Manual reversion — control restored.' };
    case 'hydraulic:continue':
      if (chance(rng, 0.45)) {
        return { deltas: { integrity: -24 }, message: 'Control authority failed — heavy damage.' };
      }
      return { deltas: { progress: 3 }, message: 'Pressure held, for now.' };
    case 'hydraulic:divert':
      return { deltas: { fuel: -12, progress: -8 }, message: 'Diverted to a longer, safer runway.' };
    case 'hydraulic:troubleshoot':
      if (chance(rng, 0.6)) {
        return { deltas: { fuel: -6, progress: -6 }, message: 'Reset the pump — pressure recovered.' };
      }
      return { deltas: { fuel: -6, progress: -6, integrity: -10 }, message: 'Troubleshooting failed, damage grew.' };

    default:
      return { deltas: { progress: 2 }, message: 'Situation managed.' };
  }
}

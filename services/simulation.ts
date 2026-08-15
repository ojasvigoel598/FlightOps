// Powered by OnSpace.AI
// Physics / simulation engine. Pure functions, no React.
// Converts a design + contract into human-readable vehicle stats.

import { AIRFRAME, BURN_BASE, ENGINES, FUELS, WINGS } from '@/constants/config';
import type { Design, VehicleStats } from '@/types/game';
import { clamp, round } from '@/utils/math';

export function computeVehicleStats(
  design: Design,
  payloadKg: number,
  distanceKm: number,
  upgrades: string[] = [],
): VehicleStats {
  const w = WINGS[design.wing];
  const e = ENGINES[design.engine];
  const f = FUELS[design.fuel];

  const hasComposite = upgrades.includes('composite-airframe');
  const hasLaminar = upgrades.includes('laminar-wings');
  const hasPrecision = upgrades.includes('precision-machining');

  const airframeWeight = AIRFRAME.weightKg * (hasComposite ? 0.88 : 1);
  const fuelWeight = f.capacityKg;
  const weightKg = airframeWeight + w.weightKg + e.weightKg + fuelWeight + payloadKg;

  const cost = round(AIRFRAME.cost + w.cost + e.cost + f.cost, 1);

  // Aerodynamic efficiency drops as the vehicle grows heavier.
  const weightPenalty = Math.max(0, (weightKg - 8000) / 500);
  const aeroEfficiency = clamp(w.aero + (hasLaminar ? 6 : 0) - weightPenalty, 30, 100);

  const reliability = clamp(e.reliability + (hasPrecision ? 6 : 0), 0, 99);

  // Fuel burn scales with engine, drag and weight.
  const fuelBurnPerKm = BURN_BASE * e.burn * w.drag * (weightKg / 8000);
  const rangeKm = fuelWeight / fuelBurnPerKm;
  const reservePct = ((rangeKm - distanceKm) / distanceKm) * 100;
  const lowSpeed = w.lowSpeed;

  const feasible = rangeKm > distanceKm;
  const safety = clamp(
    0.4 * reliability + 0.3 * clamp(50 + reservePct / 2, 0, 100) + 0.3 * lowSpeed,
    0,
    100,
  );

  return {
    cost,
    weightKg: round(weightKg),
    fuelCapacityKg: fuelWeight,
    fuelBurnPerKm: round(fuelBurnPerKm, 3),
    rangeKm: round(rangeKm),
    aeroEfficiency: round(aeroEfficiency),
    lowSpeed: round(lowSpeed),
    reliability: round(reliability),
    reservePct: round(reservePct),
    safety: round(safety),
    feasible,
  };
}

export function ratingLabel(value: number): string {
  if (value >= 85) return 'Excellent';
  if (value >= 70) return 'Good';
  if (value >= 55) return 'Fair';
  if (value >= 40) return 'Marginal';
  return 'Poor';
}

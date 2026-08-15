// Powered by OnSpace.AI
// Shared game domain types for FLIGHT OPS.

export type WingId = 'short' | 'standard' | 'long';
export type EngineId = 'efficient' | 'balanced' | 'powerful';
export type FuelId = 'small' | 'medium' | 'large';

export interface Design {
  wing: WingId;
  engine: EngineId;
  fuel: FuelId;
}

export interface VehicleStats {
  cost: number; // £M
  weightKg: number;
  fuelCapacityKg: number;
  fuelBurnPerKm: number;
  rangeKm: number;
  aeroEfficiency: number; // 0-100
  lowSpeed: number; // 0-100
  reliability: number; // 0-100
  reservePct: number; // %
  safety: number; // 0-100
  feasible: boolean;
}

export type Difficulty = 'Routine' | 'Standard' | 'Demanding' | 'Critical';

export interface Contract {
  id: string;
  seed: number;
  title: string;
  client: string;
  payloadKg: number;
  distanceKm: number;
  reward: number; // £M
  tier: number;
  difficulty: Difficulty;
}

export interface Telemetry {
  progress: number; // 0-100
  fuel: number; // 0-100
  integrity: number; // 0-100
  engineHealth: number; // 0-100
  burnModifier: number;
}

export interface EventOption {
  key: string;
  label: string;
  hint: string;
}

export interface MissionEvent {
  id: string;
  title: string;
  icon: string;
  band: Array<'takeoff' | 'cruise' | 'descent'>;
  description: string;
  diagnosis: string;
  recommended: string;
  options: EventOption[];
}

export interface Resolution {
  deltas: {
    fuel?: number;
    integrity?: number;
    engine?: number;
    burnMod?: number;
    progress?: number;
  };
  message: string;
  abort?: boolean;
}

export interface MissionResult {
  contractId: string;
  contractTitle: string;
  success: boolean;
  reward: number;
  cost: number;
  net: number;
  xp: number;
  summary: string;
  log: string[];
  telemetry: Telemetry;
}

export interface Company {
  money: number;
  xp: number;
  level: number;
  engineers: number;
  missionsCompleted: number;
  missionsFailed: number;
  upgrades: string[];
}

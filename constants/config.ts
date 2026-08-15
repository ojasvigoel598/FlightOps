// Powered by OnSpace.AI
// Static game configuration: parts, airframe, upgrades, tuning constants.

import type { EngineId, FuelId, WingId } from '@/types/game';

export interface WingSpec {
  id: WingId;
  name: string;
  cost: number; // £M
  weightKg: number;
  drag: number; // multiplier
  aero: number; // cruise efficiency baseline
  lowSpeed: number; // low-speed handling / landing margin
  tag: string;
  icon: string;
  pros: string[];
  cons: string[];
}

export interface EngineSpec {
  id: EngineId;
  name: string;
  cost: number;
  weightKg: number;
  burn: number; // burn factor
  reliability: number;
  tag: string;
  icon: string;
  pros: string[];
  cons: string[];
}

export interface FuelSpec {
  id: FuelId;
  name: string;
  cost: number;
  capacityKg: number;
  tag: string;
  icon: string;
  pros: string[];
  cons: string[];
}

export const AIRFRAME = { cost: 1.8, weightKg: 2800 };

// Base fuel burn coefficient (kg/km) before part / weight scaling.
export const BURN_BASE = 1.5;

export const WINGS: Record<WingId, WingSpec> = {
  short: {
    id: 'short',
    name: 'Short',
    cost: 0.6,
    weightKg: 280,
    drag: 0.88,
    aero: 88,
    lowSpeed: 58,
    tag: 'Clean & fast',
    icon: 'airplane',
    pros: ['Low drag', 'Cheap', 'Lightweight'],
    cons: ['Weak low-speed lift', 'Needs long runway'],
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    cost: 1.0,
    weightKg: 460,
    drag: 1.0,
    aero: 80,
    lowSpeed: 78,
    tag: 'Balanced',
    icon: 'airplane',
    pros: ['Well rounded', 'Predictable', 'Good margins'],
    cons: ['Master of none'],
  },
  long: {
    id: 'long',
    name: 'Long',
    cost: 1.8,
    weightKg: 760,
    drag: 1.16,
    aero: 70,
    lowSpeed: 93,
    tag: 'High lift',
    icon: 'airplane',
    pros: ['Great low-speed lift', 'Short landings', 'Stable'],
    cons: ['More drag', 'Expensive', 'Heavy'],
  },
};

export const ENGINES: Record<EngineId, EngineSpec> = {
  efficient: {
    id: 'efficient',
    name: 'Efficient',
    cost: 1.2,
    weightKg: 560,
    burn: 0.76,
    reliability: 90,
    tag: 'Low burn',
    icon: 'leaf',
    pros: ['Low fuel burn', 'Very reliable', 'Great range'],
    cons: ['Low thrust', 'Sluggish climb'],
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    cost: 1.8,
    weightKg: 720,
    burn: 1.0,
    reliability: 82,
    tag: 'All-round',
    icon: 'cog',
    pros: ['Solid thrust', 'Fair economy'],
    cons: ['No standout strength'],
  },
  powerful: {
    id: 'powerful',
    name: 'Powerful',
    cost: 2.6,
    weightKg: 940,
    burn: 1.34,
    reliability: 71,
    tag: 'High thrust',
    icon: 'rocket',
    pros: ['High thrust', 'Fast climb', 'Heavy payloads'],
    cons: ['Thirsty', 'Less reliable', 'Runs hot'],
  },
};

export const FUELS: Record<FuelId, FuelSpec> = {
  small: {
    id: 'small',
    name: 'Small',
    cost: 0.3,
    capacityKg: 1300,
    tag: 'Minimal',
    icon: 'gas-station',
    pros: ['Lightweight', 'Cheap'],
    cons: ['Little reserve', 'No margin for events'],
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    cost: 0.6,
    capacityKg: 2400,
    tag: 'Standard',
    icon: 'gas-station',
    pros: ['Healthy reserve', 'Flexible'],
    cons: ['Added weight'],
  },
  large: {
    id: 'large',
    name: 'Large',
    cost: 1.0,
    capacityKg: 3800,
    tag: 'Long range',
    icon: 'gas-station',
    pros: ['Huge range', 'Safe reserve'],
    cons: ['Very heavy', 'Expensive', 'Higher burn'],
  },
};

export interface UpgradeSpec {
  id: string;
  name: string;
  desc: string;
  cost: number;
  icon: string;
}

export const UPGRADES: UpgradeSpec[] = [
  {
    id: 'precision-machining',
    name: 'Precision Machining',
    desc: '+6 reliability on every engine.',
    cost: 2.5,
    icon: 'tools',
  },
  {
    id: 'composite-airframe',
    name: 'Composite Airframe',
    desc: '-12% airframe weight for better range.',
    cost: 3.0,
    icon: 'layers-triple',
  },
  {
    id: 'laminar-wings',
    name: 'Laminar Flow Wings',
    desc: '+6 aerodynamic efficiency.',
    cost: 2.8,
    icon: 'weather-windy',
  },
  {
    id: 'ai-copilot',
    name: 'AI Co-Pilot',
    desc: 'Predictive diagnostics highlight the safest call.',
    cost: 3.5,
    icon: 'robot',
  },
];

export const DEFAULT_DESIGN = {
  wing: 'standard' as WingId,
  engine: 'efficient' as EngineId,
  fuel: 'medium' as FuelId,
};

export const STARTING_COMPANY = {
  money: 5,
  xp: 0,
  level: 1,
  engineers: 3,
  missionsCompleted: 0,
  missionsFailed: 0,
  upgrades: [] as string[],
};

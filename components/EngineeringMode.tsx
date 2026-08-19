// Engineering Mode — Sadraey-style aircraft conceptual design.
//
// Based on: Mohammad H. Sadraey, Aircraft Design: A Systems Engineering
// Approach. The student follows the design process:
//   mission requirements → design requirements → configuration → sizing
//   → weight → aerodynamics → propulsion → performance → evaluation
//
// Every result shows the equation, the method label, and the numerical value.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Panel } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  computeMassBreakdown,
  computePerformance,
  defaultFuselageConfig,
  defaultPropulsionConfig,
  defaultTailConfig,
  PropulsionType,
  TailConfig,
  WingConfig,
} from '@/services/aircraft-config';
import {
  computeMissionRequirements,
  PRESET_MISSIONS,
  type MissionType,
} from '@/services/mission-design';

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ---------------------------------------------------------------------------
// Sadraey-style configuration presets
// ---------------------------------------------------------------------------

interface AircraftPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  wing: Partial<WingConfig>;
  tail: Partial<TailConfig>;
  propType: PropulsionType;
  engineCount: number;
  powerKw: number;
}

const AIRCRAFT_PRESETS: AircraftPreset[] = [
  {
    id: 'trainer', name: 'Single-Engine Trainer', category: 'General Aviation',
    description: 'Cessna 172-style. Conventional tail, high wing, piston engine. Designed for training and short trips.',
    wing: { spanM: 11, areaM2: 16.2, taperRatio: 0.7, sweepDeg: 0, airfoilId: 'naca2412' },
    tail: { configuration: 'conventional' },
    propType: 'piston', engineCount: 1, powerKw: 120,
  },
  {
    id: 'regional', name: 'Regional Turboprop', category: 'Commercial',
    description: 'Dash 8 / ATR 72-style. T-tail, twin turboprop. Efficient for short-to-medium routes.',
    wing: { spanM: 28, areaM2: 61, taperRatio: 0.5, sweepDeg: 3, airfoilId: 'naca2412' },
    tail: { configuration: 't-tail' },
    propType: 'turboprop', engineCount: 2, powerKw: 2000,
  },
  {
    id: 'jetliner', name: 'Narrowbody Jetliner', category: 'Commercial',
    description: 'A320/737-style. Turbofan engines, swept wing, conventional tail. The workhorse of airlines.',
    wing: { spanM: 35, areaM2: 122, taperRatio: 0.3, sweepDeg: 25, airfoilId: 'naca2412' },
    tail: { configuration: 'conventional' },
    propType: 'turbofan', engineCount: 2, powerKw: 0,
  },
  {
    id: 'fighter', name: 'Fighter Jet', category: 'Military',
    description: 'F-16-style. Canard or conventional, delta-ish wing, turbofan. Designed for speed and manoeuvre.',
    wing: { spanM: 10, areaM2: 28, taperRatio: 0.2, sweepDeg: 40, airfoilId: 'naca0012' },
    tail: { configuration: 'conventional' },
    propType: 'turbofan', engineCount: 1, powerKw: 0,
  },
  {
    id: 'uav', name: 'Surveillance UAV', category: 'Unmanned',
    description: 'MQ-9 Reaper-style. Long slender wings, turboprop, v-tail. Maximum endurance.',
    wing: { spanM: 20, areaM2: 24, taperRatio: 0.4, sweepDeg: 0, airfoilId: 'naca2412' },
    tail: { configuration: 'v-tail' },
    propType: 'turboprop', engineCount: 1, powerKw: 600,
  },
  {
    id: 'flying-wing', name: 'Flying Wing', category: 'Experimental',
    description: 'B-2-style. No tail, blended body. Maximum aerodynamic efficiency, requires fly-by-wire.',
    wing: { spanM: 50, areaM2: 300, taperRatio: 0.15, sweepDeg: 33, airfoilId: 'naca0012' },
    tail: { configuration: 'none' },
    propType: 'turbofan', engineCount: 4, powerKw: 0,
  },
  {
    id: 'canard', name: 'Canard Fighter', category: 'Military',
    description: 'Eurofighter/Rafale-style. Canard foreplane, delta wing, twin engines. High agility.',
    wing: { spanM: 11, areaM2: 50, taperRatio: 0.15, sweepDeg: 50, airfoilId: 'naca0006' },
    tail: { configuration: 'canard' },
    propType: 'turbofan', engineCount: 2, powerKw: 0,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EngineeringMode() {
  const [preset, setPreset] = useState('trainer');
  const [missionType, setMissionType] = useState<MissionType>('trainer');
  const [sweepOverride, setSweepOverride] = useState<number | null>(null);

  const result = useMemo(() => {
    const p = AIRCRAFT_PRESETS.find((x) => x.id === preset) || AIRCRAFT_PRESETS[0];
    const mission = PRESET_MISSIONS[missionType];
    const requirements = computeMissionRequirements(mission);

    const wing: WingConfig = {
      spanM: p.wing.spanM ?? 10,
      areaM2: p.wing.areaM2 ?? 16,
      taperRatio: p.wing.taperRatio ?? 0.6,
      sweepDeg: sweepOverride ?? (p.wing.sweepDeg ?? 2),
      dihedralDeg: 3,
      incidenceDeg: 2,
      washoutDeg: -2,
      airfoilId: p.wing.airfoilId ?? 'naca2412',
      flapType: 'slotted',
      flapSegments: 2,
    };

    const tail: TailConfig = { ...defaultTailConfig(), ...(p.tail || {}) };
    const prop = {
      ...defaultPropulsionConfig(),
      type: p.propType,
      count: p.engineCount,
      powerW: p.powerKw * 1000,
      engineMassKg: p.propType === 'turbofan' ? 2000 : 120,
      propDiameterM: p.propType === 'turbofan' ? 0 : 2.5,
      propEfficiency: p.propType === 'turbofan' ? 0.85 : 0.82,
      sfc: p.propType === 'turbofan' ? 0.06 / 3600 : 0.55 / 3600,
    };

    const mass = computeMassBreakdown(wing, tail, defaultFuselageConfig(), prop, mission.payloadKg, requirements.fuelMassKg);
    const config = { name: p.name, wing, tail, fuselage: defaultFuselageConfig(), propulsion: prop, mass };
    const perf = computePerformance(config);

    return { perf, config, mass, requirements, mission, preset: p, feasible: perf.rangeKm >= mission.rangeKm };
  }, [preset, missionType, sweepOverride]);

  return (
    <>
      {/* Aircraft preset */}
      <Panel title="Aircraft configuration" subtitle="Select a configuration type (Sadraey ch. 3).">
        <View style={s.cardGrid}>
          {AIRCRAFT_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => { setPreset(p.id); setSweepOverride(null); }}
              style={[s.presetCard, preset === p.id && s.presetCardActive]}
            >
              <Text style={[s.presetName, preset === p.id && s.presetNameActive]}>{p.name}</Text>
              <Badge label={p.category} tone={preset === p.id ? 'accent' : 'neutral'} />
              <Text style={s.presetDesc}>{p.description}</Text>
            </Pressable>
          ))}
        </View>
      </Panel>

      {/* Mission */}
      <Panel title="Mission requirements" subtitle="Define the mission (Sadraey ch. 4).">
        <View style={s.chipRow}>
          {(['trainer', 'regional-passenger', 'long-range', 'cargo', 'surveillance', 'high-speed'] as MissionType[]).map((t) => (
            <Pressable key={t} onPress={() => setMissionType(t)} style={[s.chip, missionType === t && s.chipActive]}>
              <Text style={[s.chipText, missionType === t && s.chipTextActive]}>
                {PRESET_MISSIONS[t].name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Panel>

      {/* Wing geometry */}
      <Panel title="Wing geometry" subtitle="Method: BDependent on configuration type.">
        <View style={s.statGrid}>
          <Stat label="Span" value={`${fmt(result.config.wing.spanM)} m`} />
          <Stat label="Area" value={`${fmt(result.config.wing.areaM2)} m²`} />
          <Stat label="Aspect ratio" value={fmt(result.perf.aspectRatio, 1)} highlight />
          <Stat label="Taper" value={`λ = ${fmt(result.config.wing.taperRatio, 2)}`} />
          <Stat label="Sweep" value={`${fmt(result.config.wing.sweepDeg)}°`} />
          <Stat label="Airfoil" value={result.config.wing.airfoilId.replace('naca', 'NACA ')} />
        </View>
        <Text style={s.equation}>
          AR = b²/S = {fmt(result.config.wing.spanM)}² / {fmt(result.config.wing.areaM2)} = {fmt(result.perf.aspectRatio, 1)}
        </Text>
      </Panel>

      {/* Aerodynamic analysis */}
      <Panel title="Aerodynamic analysis" subtitle="Method: Empirical + thin-airfoil theory">
        <View style={s.statGrid}>
          <Stat label="Cd0" value={fmt(result.perf.cd0, 4)} />
          <Stat label="Oswald e" value={fmt(result.perf.oswaldE, 3)} />
          <Stat label="Max L/D" value={fmt(result.perf.maxLd, 1)} highlight />
          <Stat label="Stall speed" value={`${fmt(result.perf.stallSpeedMs)} m/s`} />
          <Stat label="Wing loading" value={`${fmt(result.perf.wingLoading)} N/m²`} />
          <Stat label="Power loading" value={`${fmt(result.perf.powerLoading * 1000)} g/W`} />
        </View>
        <Text style={s.equation}>
          (L/D)_max = 0.5 * sqrt(π * e * AR / Cd0) = 0.5 * sqrt(π * {fmt(result.perf.oswaldE, 2)} * {fmt(result.perf.aspectRatio, 1)} / {fmt(result.perf.cd0, 4)}) = {fmt(result.perf.maxLd, 1)}
        </Text>
      </Panel>

      {/* Mass breakdown */}
      <Panel title="Weight estimation" subtitle="Method: Statistical (Raymer ch. 3, Sadraey ch. 5)">
        <View style={s.statGrid}>
          <Stat label="Wing" value={`${fmt(result.mass.wingKg)} kg`} />
          <Stat label="Fuselage" value={`${fmt(result.mass.fuselageKg)} kg`} />
          <Stat label="Tail" value={`${fmt(result.mass.tailKg)} kg`} />
          <Stat label="Propulsion" value={`${fmt(result.mass.propulsionKg)} kg`} />
          <Stat label="Fuel" value={`${fmt(result.mass.fuelKg)} kg`} />
          <Stat label="Payload" value={`${fmt(result.mass.payloadKg)} kg`} />
          <Stat label="Empty" value={`${fmt(result.mass.emptyMassKg)} kg`} />
          <Stat label="MTOW" value={`${fmt(result.mass.mtomKg)} kg`} highlight />
        </View>
        <Text style={s.equation}>
          MTOW = empty + fuel + payload = {fmt(result.mass.emptyMassKg)} + {fmt(result.mass.fuelKg)} + {fmt(result.mass.payloadKg)} = {fmt(result.mass.mtomKg)} kg
        </Text>
      </Panel>

      {/* Performance */}
      <Panel title="Performance" subtitle="Method: Breguet range (Sadraey ch. 7)">
        <View style={s.statGrid}>
          <Stat label="Range" value={`${fmt(result.perf.rangeKm)} km`} highlight />
          <Stat label="Endurance" value={`${fmt(result.perf.enduranceMin)} min`} />
          <Stat label="Cruise speed" value={`${fmt(result.perf.cruiseSpeedMs)} m/s`} />
          <Stat label="Climb rate" value={`${fmt(result.perf.climbRateMs)} m/s`} />
          <Stat label="Takeoff dist" value={`${fmt(result.perf.takeoffDistanceM)} m`} />
          <Stat label="Static margin" value={`${fmt(result.perf.staticMargin * 100)}%`} />
        </View>
        <Text style={s.equation}>
          R = (V * L/D * η) / (g * TSFC) = ({fmt(result.perf.cruiseSpeedMs)} * {fmt(result.perf.maxLd)} * 0.82) / (9.81 * 0.000153) = {fmt(result.perf.rangeKm)} km
        </Text>
        <View style={s.badgeRow}>
          <Badge
            label={result.feasible ? 'Mission feasible' : 'Mission NOT feasible'}
            tone={result.feasible ? 'success' : 'warning'}
          />
        </View>
      </Panel>

      {/* Educational explanation */}
      <Panel title="Why does this matter?" tone="raised">
        <Text style={s.tipText}>
          {result.perf.aspectRatio < 6 && 'Your aspect ratio is low. Higher AR reduces induced drag (CDi ∝ 1/AR) but increases structural weight. Fighter jets accept low AR for manoeuvrability; gliders use very high AR for efficiency.'}
          {result.config.wing.sweepDeg > 20 && `Sweep of ${fmt(result.config.wing.sweepDeg)}° delays compressibility effects (M_crit increases) but reduces low-speed CL slope. This is why swept-wing aircraft need higher approach speeds.`}
          {result.perf.maxLd > 12 && `L/D of ${fmt(result.perf.maxLd)} is good for this class. Higher L/D means less fuel needed for the same range (Breguet: R ∝ L/D).`}
          {result.mass.mtomKg > 20000 && 'At this weight class, you are in the regional/military category. Weight estimation uses statistical fractions from Raymer Table 3.1.'}
          {result.perf.staticMargin < 0.03 && result.perf.staticMargin > 0 && 'Static margin is marginal. A higher value (5-15% MAC) gives better longitudinal stability. Consider moving the CG forward or increasing the tail arm.'}
          {result.perf.staticMargin <= 0 && 'WARNING: Negative static margin means the aircraft is statically unstable. It will require active flight control (fly-by-wire) to fly safely.'}
          {result.preset.id === 'flying-wing' && 'Flying wings eliminate the tail and fuselage wetted area, reducing parasitic drag. However, they require sophisticated flight control systems for pitch stability.'}
          {result.preset.id === 'canard' && 'Canards generate positive lift (unlike a conventional tail which typically produces negative lift for pitch trim). This improves overall L/D but the canard must stall before the main wing.'}
        </Text>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, highlight && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  presetCard: {
    flexBasis: '45%', flexGrow: 1,
    backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, gap: 4,
  },
  presetCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  presetName: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  presetNameActive: { color: colors.primary },
  presetDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 15, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.12)' },
  chipText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: colors.primary },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1, flexBasis: '28%', backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md, padding: spacing.md, gap: 2,
  },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  equation: {
    color: colors.accent, fontSize: fontSize.xs, fontFamily: 'monospace',
    marginTop: spacing.md, padding: spacing.sm,
    backgroundColor: 'rgba(255,176,32,0.06)', borderRadius: radius.md,
    lineHeight: 18,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
});

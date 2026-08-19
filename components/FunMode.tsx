// Fun Mode — intuitive aircraft design for beginners.
//
// No equations, no jargon. The student picks shapes, sees what happens,
// and learns by experimenting. Each choice shows a simple explanation
// of WHY it matters.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Panel } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  computeMassBreakdown,
  computePerformance,
  defaultFuselageConfig,
  defaultTailConfig,
  defaultPropulsionConfig,
  PropulsionType,
  TailConfig,
} from '@/services/aircraft-config';
import {
  computeMissionRequirements,
  PRESET_MISSIONS,
  type MissionType,
} from '@/services/mission-design';

// ---------------------------------------------------------------------------
// Visual option cards
// ---------------------------------------------------------------------------

interface OptionCard {
  id: string;
  label: string;
  icon: string;
  tip: string; // simple explanation
  tag: string;
}

const WING_OPTIONS: OptionCard[] = [
  { id: 'short', label: 'Short & Stubby', icon: '✈️', tip: 'Fast and sleek, but needs a long runway to take off.', tag: 'Fast' },
  { id: 'medium', label: 'Medium', icon: '🛩️', tip: 'A balanced wing — good for most missions.', tag: 'Balanced' },
  { id: 'long', label: 'Long & Slender', icon: '🦅', tip: 'Glides beautifully and uses less fuel, but is fragile.', tag: 'Efficient' },
  { id: 'wide', label: 'Extra Wide', icon: '🪂', tip: 'Lifts heavy loads easily, but is slow.', tag: 'Heavy lift' },
];

const TAIL_OPTIONS: OptionCard[] = [
  { id: 'conventional', label: 'Normal Tail', icon: '✈️', tip: 'The classic design. Stable, predictable, easy to fly.', tag: 'Reliable' },
  { id: 't-tail', label: 'T-Tail', icon: '🔷', tip: 'Tail sits on top. Cleaner airflow, used on many jets.', tag: 'Clean' },
  { id: 'v-tail', label: 'V-Tail', icon: '🔷', tip: 'Two surfaces in a V shape. Less drag, but trickier to control.', tag: 'Low drag' },
  { id: 'canard', label: 'Canard', icon: '🐦', tip: 'Small wing in front! Prevents stalls and looks futuristic.', tag: 'Safe' },
  { id: 'none', label: 'No Tail', icon: '🔲', tip: 'Flying wing. Maximum efficiency, but needs computer control.', tag: 'Advanced' },
];

const PROP_OPTIONS: OptionCard[] = [
  { id: 'piston', label: 'Propeller (Piston)', icon: '⚙️', tip: 'Simple and cheap. Good for small planes and trainers.', tag: 'Simple' },
  { id: 'turboprop', label: 'Turboprop', icon: '💨', tip: 'Powerful propeller driven by a turbine. Fast and reliable.', tag: 'Fast prop' },
  { id: 'turbofan', label: 'Jet Engine', icon: '🚀', tip: 'Pure thrust! Fast but thirsty. Used on airliners.', tag: 'Speed' },
  { id: 'electric', label: 'Electric Motor', icon: '⚡', tip: 'Quiet and green. Limited by battery weight today.', tag: 'Green' },
];

const AIRFOIL_OPTIONS: OptionCard[] = [
  { id: 'naca0012', label: 'Symmetric', icon: '↔️', tip: 'Same shape top and bottom. Great for aerobatics.', tag: 'Aerobatic' },
  { id: 'naca2412', label: 'Mild Curve', icon: '〰️', tip: 'Slight curve helps cruise. The Cessna 172 uses this.', tag: 'GA' },
  { id: 'naca4412', label: 'Deep Curve', icon: '🌊', tip: 'Strong lift at low speeds. Great for short fields.', tag: 'High lift' },
  { id: 'naca0018', label: 'Thick', icon: '📦', tip: 'Thick wing for strength. Gliders and heavy aircraft.', tag: 'Strong' },
];

const MISSION_OPTIONS: OptionCard[] = [
  { id: 'trainer', label: 'Learn to Fly', icon: '🎓', tip: 'A simple training mission. Short distance, low speed.', tag: 'Beginner' },
  { id: 'regional-passenger', label: 'Passenger Flight', icon: '👥', tip: 'Carry people between cities. Needs good range and safety.', tag: 'Airliner' },
  { id: 'cargo', label: 'Cargo Haul', icon: '📦', tip: 'Heavy loads over medium distance. Needs strong wings.', tag: 'Freight' },
  { id: 'surveillance', label: 'Recon Patrol', icon: '👁️', tip: 'Fly for hours and watch. Needs endurance, not speed.', tag: 'UAV' },
  { id: 'high-speed', label: 'Speed Run', icon: '⚡', tip: 'Go fast! Sleek design, powerful engines, low drag.', tag: 'Fast' },
  { id: 'agricultural', label: 'Crop Spraying', icon: '🌾', tip: 'Low and slow over fields. Needs short-field performance.', tag: 'AG' },
];

// ---------------------------------------------------------------------------
// Wing area presets (mapped from option id)
// ---------------------------------------------------------------------------

const WING_PRESETS: Record<string, { spanM: number; areaM2: number }> = {
  short: { spanM: 8, areaM2: 12 },
  medium: { spanM: 10, areaM2: 16 },
  long: { spanM: 14, areaM2: 18 },
  wide: { spanM: 12, areaM2: 24 },
};

const PROP_PRESETS: Record<string, { type: PropulsionType; powerW: number; count: number }> = {
  piston: { type: 'piston', powerW: 150_000, count: 1 },
  turboprop: { type: 'turboprop', powerW: 500_000, count: 1 },
  turbofan: { type: 'turbofan', powerW: 0, count: 2 },
  electric: { type: 'electric', powerW: 200_000, count: 1 },
};

const MISSION_PRESETS: Record<string, MissionType> = {
  trainer: 'trainer',
  'regional-passenger': 'regional-passenger',
  cargo: 'cargo',
  surveillance: 'surveillance',
  'high-speed': 'high-speed',
  agricultural: 'agricultural',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function FunMode() {
  const [wingChoice, setWingChoice] = useState('medium');
  const [tailChoice, setTailChoice] = useState('conventional');
  const [propChoice, setPropChoice] = useState('turboprop');
  const [airfoilChoice, setAirfoilChoice] = useState('naca2412');
  const [missionChoice, setMissionChoice] = useState('trainer');

  const result = useMemo(() => {
    const wingPreset = WING_PRESETS[wingChoice] || WING_PRESETS.medium;
    const propPreset = PROP_PRESETS[propChoice] || PROP_PRESETS.turboprop;
    const missionType = MISSION_PRESETS[missionChoice] || 'trainer';
    const mission = PRESET_MISSIONS[missionType];
    const requirements = computeMissionRequirements(mission);

    const wing = {
      spanM: wingPreset.spanM,
      areaM2: wingPreset.areaM2,
      taperRatio: 0.6,
      sweepDeg: propChoice === 'turbofan' ? 25 : 2,
      dihedralDeg: 3,
      incidenceDeg: 2,
      washoutDeg: -2,
      airfoilId: airfoilChoice,
      flapType: 'slotted' as const,
      flapSegments: 2,
    };

    const tail: TailConfig = {
      ...defaultTailConfig(),
      configuration: tailChoice as TailConfig['configuration'],
    };

    const prop = {
      ...defaultPropulsionConfig(),
      type: propPreset.type,
      count: propPreset.count,
      powerW: propPreset.powerW,
      thrustN: 0,
      engineMassKg: propPreset.type === 'turbofan' ? 2000 : 120,
      propDiameterM: propPreset.type === 'turbofan' ? 0 : 2.5,
      propEfficiency: propPreset.type === 'turbofan' ? 0.85 : 0.82,
      sfc: propPreset.type === 'turbofan' ? 0.06 / 3600 : 0.55 / 3600,
    };

    const mass = computeMassBreakdown(wing, tail, defaultFuselageConfig(), prop, mission.payloadKg, requirements.fuelMassKg);
    const config = { name: mission.name, wing, tail, fuselage: defaultFuselageConfig(), propulsion: prop, mass };
    const perf = computePerformance(config);
    const feasible = perf.rangeKm >= mission.rangeKm;

    return { perf, feasible, mission, requirements, wingLoading: perf.wingLoading, stallSpeed: perf.stallSpeedMs };
  }, [wingChoice, tailChoice, propChoice, airfoilChoice, missionChoice]);

  return (
    <>
      {/* Mission picker */}
      <Panel title="What's the mission?" subtitle="Pick what you want to do.">
        <View style={s.cardGrid}>
          {MISSION_OPTIONS.map((opt) => (
            <OptionCardView key={opt.id} option={opt} active={missionChoice === opt.id} onPress={() => setMissionChoice(opt.id)} />
          ))}
        </View>
      </Panel>

      {/* Wing picker */}
      <Panel title="Choose your wing" subtitle="The wing is the most important part of your aircraft.">
        <View style={s.cardGrid}>
          {WING_OPTIONS.map((opt) => (
            <OptionCardView key={opt.id} option={opt} active={wingChoice === opt.id} onPress={() => setWingChoice(opt.id)} />
          ))}
        </View>
      </Panel>

      {/* Airfoil picker */}
      <Panel title="Wing shape (airfoil)" subtitle="The cross-section of your wing.">
        <View style={s.cardGrid}>
          {AIRFOIL_OPTIONS.map((opt) => (
            <OptionCardView key={opt.id} option={opt} active={airfoilChoice === opt.id} onPress={() => setAirfoilChoice(opt.id)} />
          ))}
        </View>
      </Panel>

      {/* Tail picker */}
      <Panel title="Tail design" subtitle="The tail keeps your aircraft stable and controllable.">
        <View style={s.cardGrid}>
          {TAIL_OPTIONS.map((opt) => (
            <OptionCardView key={opt.id} option={opt} active={tailChoice === opt.id} onPress={() => setTailChoice(opt.id)} />
          ))}
        </View>
      </Panel>

      {/* Propulsion picker */}
      <Panel title="Engine type" subtitle="What powers your aircraft?">
        <View style={s.cardGrid}>
          {PROP_OPTIONS.map((opt) => (
            <OptionCardView key={opt.id} option={opt} active={propChoice === opt.id} onPress={() => setPropChoice(opt.id)} />
          ))}
        </View>
      </Panel>

      {/* Results */}
      <Panel title="How does it fly?" tone="raised">
        <View style={s.resultGrid}>
          <ResultStat label="Max Speed" value={`${fmt(result.perf.cruiseSpeedMs * 3.6, 0)} km/h`} good={result.perf.cruiseSpeedMs > 100} />
          <ResultStat label="Range" value={`${fmt(result.perf.rangeKm, 0)} km`} good={result.perf.rangeKm >= result.mission.rangeKm} />
          <ResultStat label="Lift efficiency" value={`${fmt(result.perf.maxLd, 0)}:1`} good={result.perf.maxLd > 10} />
          <ResultStat label="Stall speed" value={`${fmt(result.stallSpeed, 0)} m/s`} good={result.stallSpeed < 35} />
          <ResultStat label="Weight" value={`${fmt(result.perf.wingLoading, 0)} N/m²`} good={result.wingLoading < 3000} />
          <ResultStat label="Climb" value={`${fmt(result.perf.climbRateMs, 1)} m/s`} good={result.perf.climbRateMs > 2} />
        </View>
        <View style={s.badgeRow}>
          <Badge
            label={result.feasible ? 'Mission possible!' : 'Mission too hard'}
            tone={result.feasible ? 'success' : 'warning'}
          />
        </View>
      </Panel>

      {/* Learning tip */}
      <Panel title="What did you learn?" tone="raised">
        <Text style={s.tipText}>
          {wingChoice === 'long' && 'Long, slender wings are like a glider — they cut through the air with less effort. That\'s why gliders have very long wings.'}
          {wingChoice === 'short' && 'Short wings make the aircraft fast but it needs more speed to stay in the air. Fighter jets have short wings.'}
          {wingChoice === 'wide' && 'Wide wings create lots of lift — perfect for carrying heavy cargo. But they create more drag too.'}
          {propChoice === 'turbofan' && 'Jet engines are fast but burn lots of fuel. That\'s why commercial jets fly at 35,000 feet — thinner air means less drag.'}
          {propChoice === 'electric' && 'Electric motors are efficient but batteries are heavy. This is the biggest challenge in electric aviation today.'}
          {tailChoice === 'canard' && 'A canard (small front wing) creates lift AND prevents the main wing from stalling. Many modern fighters use this.'}
          {tailChoice === 'none' && 'Flying wings have no tail — all lift comes from the wing itself. This is the most efficient shape, but hard to control without computers.'}
          {airfoilChoice === 'naca4412' && 'A curved airfoil creates more lift at low speeds — great for short runways. The downside is more drag at high speed.'}
          {!['long', 'short', 'wide'].includes(wingChoice) && !['turbofan', 'electric'].includes(propChoice) && !['canard', 'none'].includes(tailChoice) && airfoilChoice === 'naca2412' &&
            'Your design is balanced! Try changing one thing at a time to see how it affects performance. What happens if you make the wings longer?'}
        </Text>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OptionCardView({ option, active, onPress }: {
  option: OptionCard; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.optionCard, active && s.optionCardActive]}>
      <Text style={s.optionIcon}>{option.icon}</Text>
      <Text style={[s.optionLabel, active && s.optionLabelActive]}>{option.label}</Text>
      {active ? <Text style={s.optionTip}>{option.tip}</Text> : null}
      <Badge label={option.tag} tone={active ? 'accent' : 'neutral'} />
    </Pressable>
  );
}

function ResultStat({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={s.resultStat}>
      <Text style={s.resultLabel}>{label}</Text>
      <Text style={[s.resultValue, { color: good ? '#4ADE80' : '#F87171' }]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  optionCard: {
    flexBasis: '45%', flexGrow: 1,
    backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, gap: 6, minHeight: 90,
  },
  optionCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  optionIcon: { fontSize: 24 },
  optionLabel: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  optionLabelActive: { color: colors.primary },
  optionTip: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 15, marginTop: 4 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  resultStat: {
    flexGrow: 1, flexBasis: '28%', backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md, padding: spacing.md, gap: 2, alignItems: 'center',
  },
  resultLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  resultValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
});

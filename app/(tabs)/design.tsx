// Design tab — Mission definition and aircraft configuration designer.
//
// The student defines a mission (range, speed, payload, etc.) and then
// designs an aircraft to meet it. The configuration is linked to the
// engineering model: changing geometry immediately updates performance.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  AircraftConfig,
  computeMassBreakdown,
  computePerformance,
  defaultFuselageConfig,
  defaultPropulsionConfig,
  defaultTailConfig,
  defaultWingConfig,
  PropulsionType,
  TailConfig,
  WingConfig,
} from '@/services/aircraft-config';
import {
  computeMissionRequirements,
  MissionDefinition,
  MissionType,
  PRESET_MISSIONS,
} from '@/services/mission-design';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function parseNum(text: string): number {
  const v = Number.parseFloat(text);
  return Number.isFinite(v) ? v : 0;
}

function NumField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          style={s.input}
          accessibilityLabel={label}
        />
        <Text style={s.fieldUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function DesignScreen() {
  // --- Mission state ---
  const [missionType, setMissionType] = useState<MissionType>('trainer');
  const [rangeKm, setRangeKm] = useState(String(PRESET_MISSIONS.trainer.rangeKm));
  const [enduranceMin, setEnduranceMin] = useState(String(PRESET_MISSIONS.trainer.enduranceMin));
  const [cruiseSpeed, setCruiseSpeed] = useState(String(PRESET_MISSIONS.trainer.cruiseSpeedMs));
  const [altitudeKm, setAltitudeKm] = useState(String(PRESET_MISSIONS.trainer.altitudeM / 1000));
  const [payloadKg, setPayloadKg] = useState(String(PRESET_MISSIONS.trainer.payloadKg));

  // --- Wing state ---
  const [wingSpan, setWingSpan] = useState('10');
  const [wingArea, setWingArea] = useState('16');
  const [taper, setTaper] = useState('0.6');
  const [sweep, setSweep] = useState('2');
  const [airfoilId, setAirfoilId] = useState('naca2412');

  // --- Tail state ---
  const [tailConfig, setTailConfig] = useState<TailConfig['configuration']>('conventional');

  // --- Propulsion state ---
  const [propType, setPropType] = useState<PropulsionType>('turboprop');
  const [engineCount, setEngineCount] = useState('1');
  const [enginePower, setEnginePower] = useState('500');

  // --- Derived ---
  const mission = useMemo((): MissionDefinition => ({
    name: PRESET_MISSIONS[missionType].name,
    rangeKm: parseNum(rangeKm),
    enduranceMin: parseNum(enduranceMin),
    cruiseSpeedMs: parseNum(cruiseSpeed),
    maxSpeedMs: parseNum(cruiseSpeed) * 1.3,
    altitudeM: parseNum(altitudeKm) * 1000,
    payloadKg: parseNum(payloadKg),
    passengers: 0,
    climbRateMs: 3,
    takeoffDistanceM: 500,
    landingDistanceM: 400,
    reserveFraction: 0.15,
    vtolRequired: false,
    hoverDurationS: 0,
    missionType,
  }), [missionType, rangeKm, enduranceMin, cruiseSpeed, altitudeKm, payloadKg]);

  const requirements = useMemo(() => computeMissionRequirements(mission), [mission]);

  const wing = useMemo((): WingConfig => ({
    ...defaultWingConfig(),
    spanM: parseNum(wingSpan),
    areaM2: parseNum(wingArea),
    taperRatio: parseNum(taper),
    sweepDeg: parseNum(sweep),
    airfoilId,
  }), [wingSpan, wingArea, taper, sweep, airfoilId]);

  const tail = useMemo((): TailConfig => ({
    ...defaultTailConfig(),
    configuration: tailConfig,
  }), [tailConfig]);

  const config = useMemo((): AircraftConfig => {
    const prop = {
      ...defaultPropulsionConfig(),
      type: propType,
      count: parseNum(engineCount),
      powerW: parseNum(enginePower) * 1000,
    };
    const fuelKg = requirements.fuelMassKg;
    const mass = computeMassBreakdown(wing, tail, defaultFuselageConfig(), prop, parseNum(payloadKg), fuelKg);
    return {
      name: mission.name,
      wing,
      tail,
      fuselage: defaultFuselageConfig(),
      propulsion: prop,
      mass,
    };
  }, [wing, tail, propType, engineCount, enginePower, requirements, mission, payloadKg]);

  const perf = useMemo(() => computePerformance(config), [config]);

  const feasible = perf.rangeKm >= mission.rangeKm && perf.stallSpeedMs < 60;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Design"
        title="Mission & Aircraft"
        subtitle="Define your mission and design an aircraft to meet it."
      />

      {/* --- Mission definition --- */}
      <Panel title="Mission" subtitle="Choose a preset or customise your mission parameters.">
        <View style={s.chipRow}>
          {(['trainer', 'regional-passenger', 'long-range', 'cargo', 'surveillance', 'high-speed', 'agricultural', 'custom'] as MissionType[]).map((t) => {
            const active = t === missionType;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setMissionType(t);
                  const p = PRESET_MISSIONS[t];
                  setRangeKm(String(p.rangeKm));
                  setEnduranceMin(String(p.enduranceMin));
                  setCruiseSpeed(String(p.cruiseSpeedMs));
                  setAltitudeKm(String(p.altitudeM / 1000));
                  setPayloadKg(String(p.payloadKg));
                }}
                style={[s.chip, active && s.chipActive]}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {PRESET_MISSIONS[t].name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.inputGrid}>
          <NumField label="Range" value={rangeKm} onChange={setRangeKm} unit="km" />
          <NumField label="Endurance" value={enduranceMin} onChange={setEnduranceMin} unit="min" />
          <NumField label="Cruise speed" value={cruiseSpeed} onChange={setCruiseSpeed} unit="m/s" />
          <NumField label="Altitude" value={altitudeKm} onChange={setAltitudeKm} unit="km" />
          <NumField label="Payload" value={payloadKg} onChange={setPayloadKg} unit="kg" />
        </View>
      </Panel>

      {/* --- Requirements --- */}
      <Panel title="Engineering requirements" tone="raised" subtitle="Derived from your mission.">
        <View style={s.statGrid}>
          <Stat label="Target MTOW" value={fmt(requirements.targetMassKg, 0)} unit="kg" />
          <Stat label="Fuel mass" value={fmt(requirements.fuelMassKg, 0)} unit="kg" />
          <Stat label="CL (cruise)" value={fmt(requirements.requiredClCruise, 3)} unit="" />
          <Stat label="L/D needed" value={fmt(requirements.requiredLdCruise, 1)} unit="" />
          <Stat label="T/W needed" value={fmt(requirements.requiredTwr, 3)} unit="" />
          <Stat label="Wing loading" value={fmt(requirements.wingLoadingTarget, 0)} unit="N/m2" />
          <Stat label="Re (cruise)" value={requirements.cruiseReynolds.toExponential(2)} unit="" />
        </View>
        {requirements.warnings.map((w) => (
          <Text key={w} style={s.warning}>{w}</Text>
        ))}
      </Panel>

      {/* --- Wing design --- */}
      <Panel title="Wing" subtitle="Modify geometry to see performance change.">
        <View style={s.inputGrid}>
          <NumField label="Span" value={wingSpan} onChange={setWingSpan} unit="m" />
          <NumField label="Area" value={wingArea} onChange={setWingArea} unit="m2" />
          <NumField label="Taper ratio" value={taper} onChange={setTaper} unit="" />
          <NumField label="Sweep" value={sweep} onChange={setSweep} unit="deg" />
        </View>
        <Text style={s.sectionLabel}>Airfoil</Text>
        <View style={s.chipRow}>
          {['naca0012', 'naca2412', 'naca4412', 'naca0018', 'naca4418'].map((id) => {
            const active = id === airfoilId;
            return (
              <Pressable key={id} onPress={() => setAirfoilId(id)} style={[s.chip, active && s.chipActive]}>
                <Text style={[s.chipText, active && s.chipTextActive]}>{id.replace('naca', 'NACA ')}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>
          AR = {fmt(perf.aspectRatio, 1)} | Wing loading = {fmt(perf.wingLoading, 0)} N/m2
        </Text>
      </Panel>

      {/* --- Tail --- */}
      <Panel title="Tail configuration">
        <View style={s.chipRow}>
          {(['conventional', 't-tail', 'v-tail', 'canard', 'none'] as TailConfig['configuration'][]).map((c) => {
            const active = c === tailConfig;
            return (
              <Pressable key={c} onPress={() => setTailConfig(c)} style={[s.chip, active && s.chipActive]}>
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {c === 'none' ? 'No tail' : c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>Static margin: {fmt(perf.staticMargin * 100, 1)}%</Text>
      </Panel>

      {/* --- Propulsion --- */}
      <Panel title="Propulsion">
        <View style={s.chipRow}>
          {(['piston', 'turboprop', 'turbofan', 'electric'] as PropulsionType[]).map((t) => {
            const active = t === propType;
            return (
              <Pressable key={t} onPress={() => setPropType(t)} style={[s.chip, active && s.chipActive]}>
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={s.inputGrid}>
          <NumField label="Engines" value={engineCount} onChange={setEngineCount} unit="" />
          <NumField label="Power per engine" value={enginePower} onChange={setEnginePower} unit="kW" />
        </View>
        <Text style={s.hint}>
          Prop efficiency: {fmt(config.propulsion.propEfficiency * 100, 0)}% |
          Power loading: {fmt(perf.powerLoading * 1000, 1)} g/W
        </Text>
      </Panel>

      {/* --- Mass breakdown --- */}
      <Panel title="Mass breakdown" tone="raised">
        <View style={s.statGrid}>
          <Stat label="Wing" value={fmt(config.mass.wingKg, 0)} unit="kg" />
          <Stat label="Fuselage" value={fmt(config.mass.fuselageKg, 0)} unit="kg" />
          <Stat label="Tail" value={fmt(config.mass.tailKg, 0)} unit="kg" />
          <Stat label="Propulsion" value={fmt(config.mass.propulsionKg, 0)} unit="kg" />
          <Stat label="Fuel" value={fmt(config.mass.fuelKg, 0)} unit="kg" />
          <Stat label="Payload" value={fmt(config.mass.payloadKg, 0)} unit="kg" />
          <Stat label="MTOW" value={fmt(config.mass.mtomKg, 0)} unit="kg" highlight />
        </View>
      </Panel>

      {/* --- Performance --- */}
      <Panel title="Performance" subtitle="Method: Empirical estimates (Sadraey/Raymer)">
        <View style={s.statGrid}>
          <Stat label="Stall speed" value={fmt(perf.stallSpeedMs, 1)} unit="m/s" />
          <Stat label="Cruise speed" value={fmt(perf.cruiseSpeedMs, 0)} unit="m/s" />
          <Stat label="Max L/D" value={fmt(perf.maxLd, 1)} unit="" />
          <Stat label="Range" value={fmt(perf.rangeKm, 0)} unit="km" highlight />
          <Stat label="Endurance" value={fmt(perf.enduranceMin, 0)} unit="min" />
          <Stat label="Climb rate" value={fmt(perf.climbRateMs, 1)} unit="m/s" />
          <Stat label="Takeoff dist" value={fmt(perf.takeoffDistanceM, 0)} unit="m" />
          <Stat label="cd0" value={fmt(perf.cd0, 4)} unit="" />
        </View>
        <View style={s.badgeRow}>
          <Badge
            label={feasible ? 'Mission feasible' : 'Mission NOT feasible'}
            tone={feasible ? 'success' : 'warning'}
          />
          {perf.rangeKm < mission.rangeKm ? (
            <Badge label={`Short ${fmt(mission.rangeKm - perf.rangeKm, 0)} km`} tone="warning" />
          ) : null}
        </View>
      </Panel>

      <View style={{ height: 40 }} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stat({ label, value, unit, highlight }: {
  label: string; value: string; unit: string; highlight?: boolean;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, highlight && { color: colors.primary }]}>{value}</Text>
      {unit ? <Text style={s.statUnit}>{unit}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexBasis: '45%', flexGrow: 1, gap: 6 },
  fieldLabel: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.text, fontSize: fontSize.md, paddingVertical: spacing.sm + 2, minWidth: 0 },
  fieldUnit: { color: colors.textFaint, fontSize: fontSize.xs, marginLeft: spacing.sm },
  sectionLabel: {
    color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.bold,
    letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm,
  },
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
  statUnit: { color: colors.textFaint, fontSize: fontSize.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.md, lineHeight: 16 },
  warning: { color: colors.warning, fontSize: fontSize.sm, lineHeight: 19, marginTop: spacing.sm },
});

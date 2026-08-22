// Engineering Mode — Sadraey-style aircraft conceptual design (upgraded).
//
// Top: 3D viewport showing the designed aircraft in real time.
// Middle: custom aircraft data input — students can feed their own parameters.
// Bottom: detailed analysis with equations, mass breakdown, performance.
//
// Gamified with prediction challenges: before changing a parameter,
// the student predicts what will happen, then tests it.

import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Canvas } from '@react-three/fiber';

import { Badge, Panel } from '@/components';
import AircraftModel, { buildDesignParams } from '@/components/three/AircraftModel';
import ChaseCamera from '@/components/three/ChaseCamera';
import {
  Clouds,
  Hangar,
  Mountains,
  Ocean,
  Runway,
  RunwayLights,
  Sky,
  Terrain,
} from '@/components/three/World';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  computeMassBreakdown,
  computePerformance,
  defaultFuselageConfig,
  defaultPropulsionConfig,
  defaultTailConfig,
  PropulsionType,
  TailConfig,
  type WingConfig,
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
// Aircraft presets
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
    description: 'Cessna 172-style. Conventional tail, high wing, piston engine.',
    wing: { spanM: 11, areaM2: 16.2, taperRatio: 0.7, sweepDeg: 0, airfoilId: 'naca2412' },
    tail: { configuration: 'conventional' },
    propType: 'piston', engineCount: 1, powerKw: 120,
  },
  {
    id: 'regional', name: 'Regional Turboprop', category: 'Commercial',
    description: 'Dash 8 / ATR 72-style. T-tail, twin turboprop.',
    wing: { spanM: 28, areaM2: 61, taperRatio: 0.5, sweepDeg: 3, airfoilId: 'naca2412' },
    tail: { configuration: 't-tail' },
    propType: 'turboprop', engineCount: 2, powerKw: 2000,
  },
  {
    id: 'jetliner', name: 'Narrowbody Jetliner', category: 'Commercial',
    description: 'A320/737-style. Turbofan engines, swept wing.',
    wing: { spanM: 35, areaM2: 122, taperRatio: 0.3, sweepDeg: 25, airfoilId: 'naca2412' },
    tail: { configuration: 'conventional' },
    propType: 'turbofan', engineCount: 2, powerKw: 0,
  },
  {
    id: 'fighter', name: 'Fighter Jet', category: 'Military',
    description: 'F-16-style. Delta-ish wing, turbofan. Speed and manoeuvre.',
    wing: { spanM: 10, areaM2: 28, taperRatio: 0.2, sweepDeg: 40, airfoilId: 'naca0012' },
    tail: { configuration: 'conventional' },
    propType: 'turbofan', engineCount: 1, powerKw: 0,
  },
  {
    id: 'uav', name: 'Surveillance UAV', category: 'Unmanned',
    description: 'MQ-9 Reaper-style. Long slender wings, v-tail.',
    wing: { spanM: 20, areaM2: 24, taperRatio: 0.4, sweepDeg: 0, airfoilId: 'naca2412' },
    tail: { configuration: 'v-tail' },
    propType: 'turboprop', engineCount: 1, powerKw: 600,
  },
  {
    id: 'flying-wing', name: 'Flying Wing', category: 'Experimental',
    description: 'B-2-style. No tail, blended body. Maximum efficiency.',
    wing: { spanM: 50, areaM2: 300, taperRatio: 0.15, sweepDeg: 33, airfoilId: 'naca0012' },
    tail: { configuration: 'none' },
    propType: 'turbofan', engineCount: 4, powerKw: 0,
  },
  {
    id: 'canard', name: 'Canard Fighter', category: 'Military',
    description: 'Eurofighter/Rafale-style. Canard foreplane, delta wing.',
    wing: { spanM: 11, areaM2: 50, taperRatio: 0.15, sweepDeg: 50, airfoilId: 'naca0006' },
    tail: { configuration: 'canard' },
    propType: 'turbofan', engineCount: 2, powerKw: 0,
  },
];

// ---------------------------------------------------------------------------
// 3D Scene for Engineering Mode (static/parked view)
// ---------------------------------------------------------------------------

function DesignScene({ designParams }: { designParams: ReturnType<typeof buildDesignParams> }) {
  return (
    <>
      <Sky />
      <Terrain />
      <Ocean />
      <Runway />
      <RunwayLights />
      <Clouds count={10} />
      <Mountains count={8} />
      <Hangar />
      <ChaseCamera target={[0, 1.2, 0]} pitch={0} bank={0} flying={false} mode="orbit" />
      <group position={[0, 1.2, 0]}>
        <AircraftModel design={{ ...designParams, flightSpeed: 0, pitch: 0, bank: 0 }} />
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Custom input field for aircraft parameters
// ---------------------------------------------------------------------------

function ParamInput({
  label, value, unit, onChangeText, min, max, step,
}: {
  label: string; value: number; unit: string;
  onChangeText: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  const increment = () => onChangeText(Math.min(max ?? 9999, value + (step ?? 1)));
  const decrement = () => onChangeText(Math.max(min ?? 0, value - (step ?? 1)));

  return (
    <View style={s.paramRow}>
      <Text style={s.paramLabel}>{label}</Text>
      <View style={s.paramControls}>
        <Pressable onPress={decrement} style={s.paramBtn}>
          <Text style={s.paramBtnText}>−</Text>
        </Pressable>
        <TextInput
          style={s.paramInput}
          value={value.toString()}
          onChangeText={(t) => {
            const n = parseFloat(t);
            if (!isNaN(n)) onChangeText(n);
          }}
          keyboardType="numeric"
          selectTextOnFocus
        />
        <Pressable onPress={increment} style={s.paramBtn}>
          <Text style={s.paramBtnText}>+</Text>
        </Pressable>
        <Text style={s.paramUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Prediction challenge card
// ---------------------------------------------------------------------------

function PredictionCard({
  question, options, correctIndex, answered, selectedIndex, onSelect,
}: {
  question: string;
  options: string[];
  correctIndex: number;
  answered: boolean;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={s.predCard}>
      <Text style={s.predQuestion}>🔮 {question}</Text>
      {options.map((opt, i) => {
        const isCorrect = i === correctIndex;
        const isSelected = i === selectedIndex;
        const bgColor = answered && isCorrect
          ? { backgroundColor: 'rgba(52,211,153,0.15)' as string }
          : answered && isSelected && !isCorrect
            ? { backgroundColor: 'rgba(248,113,113,0.15)' as string }
            : {};

        return (
          <Pressable
            key={i}
            onPress={() => !answered && onSelect(i)}
            style={[s.predOption, bgColor, answered && isCorrect && s.predOptionCorrect]}
          >
            <Text style={[s.predOptionText, answered && isCorrect && { color: '#4ADE80' }]}>
              {answered && isCorrect ? '✅ ' : answered && isSelected ? '❌ ' : ''}{opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EngineeringMode() {
  const [preset, setPreset] = useState('trainer');
  const [missionType, setMissionType] = useState<MissionType>('trainer');

  // Custom parameter overrides
  const [customSpan, setCustomSpan] = useState<number | null>(null);
  const [customArea, setCustomArea] = useState<number | null>(null);
  const [customSweep, setCustomSweep] = useState<number | null>(null);
  const [customCd0, setCustomCd0] = useState<number | null>(null);
  const [customOswald, setCustomOswald] = useState<number | null>(null);

  // Prediction state
  const [predAnswered, setPredAnswered] = useState(false);
  const [predSelected, setPredSelected] = useState<number | null>(null);

  const p = AIRCRAFT_PRESETS.find((x) => x.id === preset) || AIRCRAFT_PRESETS[0];
  const mission = PRESET_MISSIONS[missionType];
  const requirements = computeMissionRequirements(mission);

  const result = useMemo(() => {
    const wing: WingConfig = {
      spanM: customSpan ?? (p.wing.spanM ?? 10),
      areaM2: customArea ?? (p.wing.areaM2 ?? 16),
      taperRatio: p.wing.taperRatio ?? 0.6,
      sweepDeg: customSweep ?? (p.wing.sweepDeg ?? 2),
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
  }, [preset, missionType, customSpan, customArea, customSweep, customCd0, customOswald]);

  // 3D params for the viewport
  const designParams = useMemo(() => {
    return buildDesignParams({
      wingId: customSpan != null ? 'medium' : (result.config.wing.spanM > 15 ? 'long' : result.config.wing.spanM < 9 ? 'short' : 'medium'),
      tailId: (result.config.tail?.configuration as string) || 'conventional',
      airfoilId: result.config.wing.airfoilId || 'naca2412',
      engineId: p.propType === 'turbofan' ? 'powerful' : p.propType === 'piston' ? 'efficient' : 'turboprop',
      engineCount: p.engineCount,
      flightSpeed: 0,
      pitch: 0,
      bank: 0,
    });
  }, [p, result.config, customSpan]);

  // Reset custom params when preset changes
  const selectPreset = (id: string) => {
    setPreset(id);
    setCustomSpan(null);
    setCustomArea(null);
    setCustomSweep(null);
    setCustomCd0(null);
    setCustomOswald(null);
    setPredAnswered(false);
    setPredSelected(null);
  };

  // Current prediction question
  const prediction = useMemo(() => {
    if (preset === 'fighter') {
      return {
        question: 'If you increase sweep from 20° to 45°, what happens?',
        options: [
          'Higher top speed but worse low-speed handling',
          'Better low-speed lift',
          'No meaningful change',
          'Aircraft becomes lighter',
        ],
        correctIndex: 0,
      };
    }
    if (preset === 'flying-wing') {
      return {
        question: 'Why does a flying wing need fly-by-wire?',
        options: [
          'It is statically unstable without a tail',
          'The engines are too powerful',
          'It cannot take off without computers',
          'It is too heavy',
        ],
        correctIndex: 0,
      };
    }
    if (preset === 'uav') {
      return {
        question: 'Why does a surveillance UAV have long, slender wings?',
        options: [
          'Higher aspect ratio reduces induced drag for endurance',
          'It looks better',
          'Short wings are too expensive',
          'It needs to fly faster',
        ],
        correctIndex: 0,
      };
    }
    return {
      question: 'If you double the wing area while keeping weight the same, what happens to wing loading?',
      options: [
        'Wing loading halves — lower stall speed',
        'Wing loading doubles',
        'Nothing changes',
        'The aircraft becomes faster',
      ],
      correctIndex: 0,
    };
  }, [preset]);

  return (
    <View style={s.container}>
      {/* ─── 3D Viewport ─── */}
      <View style={s.viewport}>
        <Canvas
          camera={{ position: [0, 8, 20], fov: 45 }}
          style={s.canvas}
          gl={{ antialias: true, alpha: false }}
        >
          <DesignScene designParams={designParams} />
        </Canvas>
        <View style={s.viewportLabel}>
          <Text style={s.viewportLabelText}>📐 {p.name} — Live 3D Preview</Text>
        </View>
      </View>

      {/* ─── Scrollable Content ─── */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>

        {/* Aircraft preset */}
        <Panel title="Aircraft configuration" subtitle="Select a base configuration (Sadraey Ch. 3).">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {AIRCRAFT_PRESETS.map((ap) => (
              <Pressable
                key={ap.id}
                onPress={() => selectPreset(ap.id)}
                style={[s.presetCard, preset === ap.id && s.presetCardActive]}
              >
                <Text style={[s.presetName, preset === ap.id && s.presetNameActive]}>{ap.name}</Text>
                <Badge label={ap.category} tone={preset === ap.id ? 'accent' : 'neutral'} />
                <Text style={s.presetDesc}>{ap.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Panel>

        {/* Mission */}
        <Panel title="Mission requirements" subtitle="Define the mission (Sadraey Ch. 4).">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {(['trainer', 'regional-passenger', 'long-range', 'cargo', 'surveillance', 'high-speed'] as MissionType[]).map((t) => (
              <Pressable key={t} onPress={() => setMissionType(t)} style={[s.chip, missionType === t && s.chipActive]}>
                <Text style={[s.chipText, missionType === t && s.chipTextActive]}>
                  {PRESET_MISSIONS[t].name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Panel>

        {/* Custom parameters — student can override */}
        <Panel title="🔧 Custom Parameters" subtitle="Feed your own aircraft data. Override defaults.">
          <ParamInput
            label="Wing span"
            value={customSpan ?? (p.wing.spanM ?? 10)}
            unit="m"
            onChangeText={(v) => setCustomSpan(v)}
            min={3} max={80} step={1}
          />
          <ParamInput
            label="Wing area"
            value={customArea ?? (p.wing.areaM2 ?? 16)}
            unit="m²"
            onChangeText={(v) => setCustomArea(v)}
            min={5} max={500} step={1}
          />
          <ParamInput
            label="Sweep angle"
            value={customSweep ?? (p.wing.sweepDeg ?? 2)}
            unit="°"
            onChangeText={(v) => setCustomSweep(v)}
            min={0} max={70} step={5}
          />
          {(customSpan !== null || customArea !== null || customSweep !== null) && (
            <Pressable onPress={() => { setCustomSpan(null); setCustomArea(null); setCustomSweep(null); }} style={s.resetBtn}>
              <Text style={s.resetBtnText}>↺ Reset to preset defaults</Text>
            </Pressable>
          )}
        </Panel>

        {/* Prediction challenge */}
        <Panel title="🔮 Predict Before You Change" subtitle="What do you think will happen?">
          <PredictionCard
            question={prediction.question}
            options={prediction.options}
            correctIndex={prediction.correctIndex}
            answered={predAnswered}
            selectedIndex={predSelected}
            onSelect={(i) => { setPredSelected(i); setPredAnswered(true); }}
          />
          {predAnswered && (
            <Pressable onPress={() => { setPredAnswered(false); setPredSelected(null); }} style={s.predResetBtn}>
              <Text style={s.predResetText}>Try another prediction</Text>
            </Pressable>
          )}
        </Panel>

        {/* Wing geometry */}
        <Panel title="Wing geometry" subtitle="Sadraey Ch. 5 — Wing Design">
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
        <Panel title="Aerodynamic analysis" subtitle="Panel method + thin-airfoil theory">
          <View style={s.statGrid}>
            <Stat label="Cd0" value={fmt(result.perf.cd0, 4)} />
            <Stat label="Oswald e" value={fmt(result.perf.oswaldE, 3)} />
            <Stat label="Max L/D" value={fmt(result.perf.maxLd, 1)} highlight />
            <Stat label="Stall speed" value={`${fmt(result.perf.stallSpeedMs)} m/s`} />
            <Stat label="Wing loading" value={`${fmt(result.perf.wingLoading)} N/m²`} />
            <Stat label="Power loading" value={`${fmt(result.perf.powerLoading * 1000)} g/W`} />
          </View>
          <Text style={s.equation}>
            (L/D)_max = 0.5√(π·e·AR/Cd0) = {fmt(result.perf.maxLd, 1)}
          </Text>
        </Panel>

        {/* Weight estimation */}
        <Panel title="Weight estimation" subtitle="Statistical (Raymer ch. 3, Sadraey ch. 5)">
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
        <Panel title="Performance" subtitle="Breguet range (Sadraey ch. 7)">
          <View style={s.statGrid}>
            <Stat label="Range" value={`${fmt(result.perf.rangeKm)} km`} highlight />
            <Stat label="Endurance" value={`${fmt(result.perf.enduranceMin)} min`} />
            <Stat label="Cruise speed" value={`${fmt(result.perf.cruiseSpeedMs)} m/s`} />
            <Stat label="Climb rate" value={`${fmt(result.perf.climbRateMs)} m/s`} />
            <Stat label="Takeoff dist" value={`${fmt(result.perf.takeoffDistanceM)} m`} />
            <Stat label="Static margin" value={`${fmt(result.perf.staticMargin * 100)}%`} />
          </View>
          <Text style={s.equation}>
            R = (V · L/D · η) / (g · TSFC) = {fmt(result.perf.rangeKm)} km
          </Text>
          <View style={s.badgeRow}>
            <Badge
              label={result.feasible ? '✅ Mission feasible' : '❌ Mission NOT feasible'}
              tone={result.feasible ? 'success' : 'warning'}
            />
          </View>
        </Panel>

        {/* Educational explanation */}
        <Panel title="💡 Engineering Insight" tone="raised">
          <Text style={s.tipText}>
            {result.perf.aspectRatio < 6 && 'Your aspect ratio is low. Higher AR reduces induced drag (CDi ∝ 1/AR) but increases structural weight. Fighter jets accept low AR for manoeuvrability; gliders use AR > 15 for efficiency.'}
            {result.config.wing.sweepDeg > 20 && `Sweep of ${fmt(result.config.wing.sweepDeg)}° delays compressibility effects (M_crit increases) but reduces low-speed CL slope. This is why swept-wing aircraft need higher approach speeds.`}
            {result.perf.maxLd > 12 && `L/D of ${fmt(result.perf.maxLd)} is good for this class. Higher L/D means less fuel for the same range (Breguet: R ∝ L/D).`}
            {result.mass.mtomKg > 20000 && 'At this weight class, you are in the regional/military category. Weight estimation uses statistical fractions from Raymer Table 3.1.'}
            {result.perf.staticMargin < 0.03 && result.perf.staticMargin > 0 && 'Static margin is marginal. Higher SM (5-15% MAC) gives better longitudinal stability. Move CG forward or increase tail arm.'}
            {result.perf.staticMargin <= 0 && 'WARNING: Negative static margin = statically unstable. Requires fly-by-wire to fly safely.'}
            {result.preset.id === 'flying-wing' && 'Flying wings eliminate tail + fuselage wetted area, reducing parasitic drag. But they require sophisticated flight control for pitch stability.'}
            {result.preset.id === 'canard' && 'Canards generate positive lift (unlike a conventional tail for trim). This improves overall L/D but the canard must stall before the main wing.'}
            {customSpan !== null && `You overrode the wing span to ${customSpan} m. Compare the new AR and L/D with the preset default. How did the performance change?`}
          </Text>
        </Panel>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
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
  container: { flex: 1, backgroundColor: colors.background },
  viewport: {
    height: '30%',
    backgroundColor: '#6CB4EE',
    borderBottomWidth: 2,
    borderBottomColor: colors.borderStrong,
    position: 'relative',
  },
  canvas: { flex: 1 },
  viewportLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewportLabelText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  panel: { flex: 1 },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  horizontalScroll: { gap: spacing.sm },
  presetCard: {
    width: 160,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  presetCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  presetName: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  presetNameActive: { color: colors.primary },
  presetDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 15, marginTop: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.12)' },
  chipText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: colors.primary },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paramLabel: { color: colors.textSubtle, fontSize: fontSize.sm, flex: 1 },
  paramControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paramBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paramBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  paramInput: {
    width: 56,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    paddingVertical: 4,
  },
  paramUnit: { color: colors.textFaint, fontSize: fontSize.xs, width: 28 },
  resetBtn: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  resetBtnText: { color: colors.accent, fontSize: fontSize.xs },
  predCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  predQuestion: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: 4 },
  predOption: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  predOptionCorrect: { borderColor: '#4ADE80' },
  predOptionText: { color: colors.textSubtle, fontSize: fontSize.sm },
  predResetBtn: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  predResetText: { color: colors.accent, fontSize: fontSize.xs },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '28%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  equation: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: 'rgba(255,176,32,0.06)',
    borderRadius: radius.md,
    lineHeight: 18,
  },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
});

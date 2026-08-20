// Fun Mode — interactive 3D aircraft design game (upgraded).
//
// Top half: live 3D viewport with chase camera, animated ocean,
//   engine exhaust, wingtip contrails, and smooth flight animation.
//
// Bottom half: scrollable design panel with option cards.
//   A "Fly" button triggers full taxi→takeoff→cruise with particles.
//   Camera mode toggle: chase / orbit / side view.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@react-three/fiber';

import { Badge, Panel } from '@/components';
import AircraftModel, { buildDesignParams } from '@/components/three/AircraftModel';
import ChaseCamera from '@/components/three/ChaseCamera';
import { EngineExhaust, WingtipContrail } from '@/components/three/Particles';
import {
  Clouds,
  ControlTower,
  Hangar,
  Mountains,
  Ocean,
  Runway,
  RunwayLights,
  Sky,
  Terrain,
  Trees,
  WindIndicator,
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
  tip: string;
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
  { id: 'v-tail', label: 'V-Tail', icon: '🔷', tip: 'Two surfaces in a V shape. Less drag, trickier to control.', tag: 'Low drag' },
  { id: 'canard', label: 'Canard', icon: '🐦', tip: 'Small wing in front! Prevents stalls and looks futuristic.', tag: 'Safe' },
  { id: 'none', label: 'No Tail', icon: '🔲', tip: 'Flying wing. Maximum efficiency, needs computer control.', tag: 'Advanced' },
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
  { id: 'regional-passenger', label: 'Passenger Flight', icon: '👥', tip: 'Carry people between cities. Needs range and safety.', tag: 'Airliner' },
  { id: 'cargo', label: 'Cargo Haul', icon: '📦', tip: 'Heavy loads over medium distance. Needs strong wings.', tag: 'Freight' },
  { id: 'surveillance', label: 'Recon Patrol', icon: '👁️', tip: 'Fly for hours and watch. Needs endurance, not speed.', tag: 'UAV' },
  { id: 'high-speed', label: 'Speed Run', icon: '⚡', tip: 'Go fast! Sleek design, powerful engines, low drag.', tag: 'Fast' },
  { id: 'agricultural', label: 'Crop Spraying', icon: '🌾', tip: 'Low and slow over fields. Short-field performance.', tag: 'AG' },
];

// ---------------------------------------------------------------------------
// Presets
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

type CameraMode = 'chase' | 'orbit' | 'side';

// ---------------------------------------------------------------------------
// 3D Scene
// ---------------------------------------------------------------------------

function AircraftScene({
  designParams,
  flying,
  flightProgress,
  cameraMode,
  propChoice,
}: {
  designParams: ReturnType<typeof buildDesignParams>;
  flying: boolean;
  flightProgress: number;
  cameraMode: CameraMode;
  propChoice: string;
}) {
  // Aircraft position — 4 flight phases
  const position: [number, number, number] = useMemo(() => {
    if (!flying) return [0, 1.2, 0];

    if (flightProgress < 0.15) {
      // Taxi
      const t = flightProgress / 0.15;
      return [0, 1.2, t * -30];
    }
    if (flightProgress < 0.4) {
      // Takeoff roll + rotation
      const t = (flightProgress - 0.15) / 0.25;
      const liftOff = Math.max(0, t - 0.4); // rotates at 40% of takeoff
      return [0, 1.2 + liftOff * 40, -30 - t * 80];
    }
    if (flightProgress < 0.7) {
      // Climb to cruise
      const t = (flightProgress - 0.4) / 0.3;
      return [0, 20 + t * 20, -110 - t * 60];
    }
    // Cruise — gentle turns
    const t = (flightProgress - 0.7) / 0.3;
    return [
      Math.sin(t * Math.PI * 2) * 30,
      40 + Math.sin(t * Math.PI) * 5,
      -170 - t * 100,
    ];
  }, [flying, flightProgress]);

  const pitch = useMemo(() => {
    if (!flying) return 0;
    if (flightProgress < 0.15) return 0;
    if (flightProgress < 0.4) {
      const t = (flightProgress - 0.15) / 0.25;
      return Math.min(t * 0.4, 0.3); // Rotation pitch
    }
    if (flightProgress < 0.7) {
      const t = (flightProgress - 0.4) / 0.3;
      return 0.15 * (1 - t); // Reduce pitch as we level off
    }
    const t = (flightProgress - 0.7) / 0.3;
    return Math.sin(t * Math.PI * 2) * 0.05; // Slight banking oscillation
  }, [flying, flightProgress]);

  const bank = useMemo(() => {
    if (!flying || flightProgress < 0.7) return 0;
    const t = (flightProgress - 0.7) / 0.3;
    return Math.sin(t * Math.PI * 2) * 0.25;
  }, [flying, flightProgress]);

  const flightSpeed = flying
    ? flightProgress < 0.15
      ? 0.1
      : flightProgress < 0.4
        ? 0.5
        : 1.0
    : 0;

  // Throttle for particles
  const throttle = flying
    ? flightProgress < 0.15
      ? 0.3
      : flightProgress < 0.4
        ? 0.8
        : 0.6
    : 0;

  const isJet = propChoice === 'turbofan';
  const isHighAlt = flying && flightProgress > 0.5;

  // Engine positions for particles
  const enginePositions = useMemo(() => {
    const spacing = designParams.spanM * 0.25;
    if (designParams.engineCount === 1) return [[0, -0.55, 0.5] as [number, number, number]];
    return [
      [-spacing, -0.15, 0] as [number, number, number],
      [spacing, -0.15, 0] as [number, number, number],
    ];
  }, [designParams.engineCount, designParams.spanM]);

  return (
    <>
      <Sky />
      <Terrain />
      <Ocean />
      <Runway />
      <RunwayLights />
      <Clouds count={18} />
      <Mountains count={14} />
      <Hangar />
      <ControlTower />
      <Trees count={35} />
      <WindIndicator windMs={8} direction={45} />

      {/* Chase camera */}
      <ChaseCamera
        target={position}
        pitch={pitch}
        bank={bank}
        flying={flying}
        mode={cameraMode}
      />

      {/* Aircraft */}
      <group position={position} rotation={[pitch, 0, bank]}>
        <AircraftModel design={{ ...designParams, flightSpeed, pitch: 0, bank: 0 }} />

        {/* Engine exhaust particles */}
        {enginePositions.map((pos, i) => (
          <EngineExhaust
            key={`exhaust-${i}`}
            position={pos}
            throttle={throttle}
            direction={[0, 0.05, -1]}
          />
        ))}

        {/* Wingtip contrails */}
        {isHighAlt && (
          <>
            <WingtipContrail
              position={[designParams.spanM / 2, 0, 0.5]}
              active={isHighAlt}
              speed={flightSpeed * 250}
            />
            <WingtipContrail
              position={[-designParams.spanM / 2, 0, 0.5]}
              active={isHighAlt}
              speed={flightSpeed * 250}
            />
          </>
        )}
      </group>
    </>
  );
}

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
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  // Flight state
  const [flying, setFlying] = useState(false);
  const [flightProgress, setFlightProgress] = useState(0);
  const flightRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // 3D design params
  const designParams = useMemo(() => {
    return buildDesignParams({
      wingId: wingChoice,
      tailId: tailChoice,
      airfoilId: airfoilChoice,
      engineId: propChoice,
      engineCount: PROP_PRESETS[propChoice]?.count ?? 1,
      flightSpeed: flying ? 1 : 0,
      pitch: 0,
      bank: 0,
    });
  }, [wingChoice, tailChoice, propChoice, airfoilChoice, flying]);

  // Flight animation
  const startFlight = useCallback(() => {
    if (flying) return;
    setFlying(true);
    setFlightProgress(0);
    let progress = 0;
    flightRef.current = setInterval(() => {
      progress += 0.006;
      if (progress >= 1) {
        progress = 1;
        clearInterval(flightRef.current!);
        flightRef.current = null;
        setTimeout(() => {
          setFlying(false);
          setFlightProgress(0);
        }, 2000);
      }
      setFlightProgress(progress);
    }, 30);
  }, [flying]);

  useEffect(() => {
    return () => { if (flightRef.current) clearInterval(flightRef.current); };
  }, []);

  return (
    <View style={s.container}>
      {/* ─── 3D Viewport ─── */}
      <View style={s.viewport}>
        <Canvas
          camera={{ position: [0, 12, 25], fov: 50 }}
          style={s.canvas}
          gl={{ antialias: true, alpha: false }}
        >
          <AircraftScene
            designParams={designParams}
            flying={flying}
            flightProgress={flightProgress}
            cameraMode={cameraMode}
            propChoice={propChoice}
          />
        </Canvas>

        {/* Camera mode toggle */}
        <View style={s.cameraToggle}>
          {(['chase', 'orbit', 'side'] as CameraMode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => setCameraMode(m)}
              style={[s.camBtn, cameraMode === m && s.camBtnActive]}
            >
              <Text style={[s.camBtnText, cameraMode === m && s.camBtnTextActive]}>
                {m === 'chase' ? '📹 Chase' : m === 'orbit' ? '🔄 Orbit' : '🎬 Side'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Flight status overlay */}
        {flying && (
          <View style={s.flightOverlay}>
            <Text style={s.flightText}>
              {flightProgress < 0.15
                ? '🛫 Taxiing to runway...'
                : flightProgress < 0.4
                  ? '✈️ Rotating — takeoff!'
                  : flightProgress < 0.7
                    ? '🛩️ Climbing to cruise altitude'
                    : '☁️ Cruise flight — enjoy the view!'}
            </Text>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${flightProgress * 100}%` }]} />
            </View>
          </View>
        )}

        {/* HUD when parked */}
        {!flying && (
          <View style={s.hud}>
            <View style={s.hudItem}>
              <Text style={s.hudLabel}>Speed</Text>
              <Text style={s.hudValue}>{fmt(result.perf.cruiseSpeedMs * 3.6, 0)} km/h</Text>
            </View>
            <View style={s.hudItem}>
              <Text style={s.hudLabel}>Range</Text>
              <Text style={s.hudValue}>{fmt(result.perf.rangeKm, 0)} km</Text>
            </View>
            <View style={s.hudItem}>
              <Text style={s.hudLabel}>L/D</Text>
              <Text style={s.hudValue}>{fmt(result.perf.maxLd, 0)}:1</Text>
            </View>
            <View style={s.hudItem}>
              <Text style={s.hudLabel}>Stall</Text>
              <Text style={s.hudValue}>{fmt(result.stallSpeed, 0)} m/s</Text>
            </View>
          </View>
        )}
      </View>

      {/* ─── Scrollable Design Panel ─── */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
        <Pressable
          onPress={startFlight}
          style={[s.flyButton, flying && s.flyButtonDisabled]}
          disabled={flying}
        >
          <Text style={s.flyButtonText}>
            {flying ? '✈️ Flying...' : '🛫 Launch Flight Test'}
          </Text>
        </Pressable>

        <Panel title="Mission" subtitle="Pick what you want to do.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {MISSION_OPTIONS.map((opt) => (
              <OptionCardH key={opt.id} option={opt} active={missionChoice === opt.id} onPress={() => setMissionChoice(opt.id)} />
            ))}
          </ScrollView>
        </Panel>

        <Panel title="Wing" subtitle="The most important part.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {WING_OPTIONS.map((opt) => (
              <OptionCardH key={opt.id} option={opt} active={wingChoice === opt.id} onPress={() => setWingChoice(opt.id)} />
            ))}
          </ScrollView>
        </Panel>

        <Panel title="Airfoil" subtitle="Cross-section of your wing.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {AIRFOIL_OPTIONS.map((opt) => (
              <OptionCardH key={opt.id} option={opt} active={airfoilChoice === opt.id} onPress={() => setAirfoilChoice(opt.id)} />
            ))}
          </ScrollView>
        </Panel>

        <Panel title="Tail" subtitle="Stability and control.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {TAIL_OPTIONS.map((opt) => (
              <OptionCardH key={opt.id} option={opt} active={tailChoice === opt.id} onPress={() => setTailChoice(opt.id)} />
            ))}
          </ScrollView>
        </Panel>

        <Panel title="Engine" subtitle="What powers your aircraft?">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {PROP_OPTIONS.map((opt) => (
              <OptionCardH key={opt.id} option={opt} active={propChoice === opt.id} onPress={() => setPropChoice(opt.id)} />
            ))}
          </ScrollView>
        </Panel>

        <Panel title="Performance" tone="raised">
          <View style={s.resultGrid}>
            <ResultStat label="Max Speed" value={`${fmt(result.perf.cruiseSpeedMs * 3.6, 0)} km/h`} good={result.perf.cruiseSpeedMs > 100} />
            <ResultStat label="Range" value={`${fmt(result.perf.rangeKm, 0)} km`} good={result.perf.rangeKm >= result.mission.rangeKm} />
            <ResultStat label="L/D" value={`${fmt(result.perf.maxLd, 0)}:1`} good={result.perf.maxLd > 10} />
            <ResultStat label="Stall" value={`${fmt(result.stallSpeed, 0)} m/s`} good={result.stallSpeed < 35} />
            <ResultStat label="W/S" value={`${fmt(result.perf.wingLoading, 0)} N/m²`} good={result.wingLoading < 3000} />
            <ResultStat label="Climb" value={`${fmt(result.perf.climbRateMs, 1)} m/s`} good={result.perf.climbRateMs > 2} />
          </View>
          <View style={s.badgeRow}>
            <Badge
              label={result.feasible ? '✅ Mission possible!' : '⚠️ Mission too hard'}
              tone={result.feasible ? 'success' : 'warning'}
            />
          </View>
        </Panel>

        <Panel title="💡 What did you learn?" tone="raised">
          <Text style={s.tipText}>
            {wingChoice === 'long' && 'Long, slender wings are like a glider — they cut through the air with less effort. That\'s why gliders have very long wings.'}
            {wingChoice === 'short' && 'Short wings make the aircraft fast but it needs more speed to stay in the air. Fighter jets have short wings.'}
            {wingChoice === 'wide' && 'Wide wings create lots of lift — perfect for carrying heavy cargo. But they create more drag too.'}
            {propChoice === 'turbofan' && 'Jet engines are fast but burn lots of fuel. That\'s why commercial jets fly at 35,000 feet — thinner air means less drag.'}
            {propChoice === 'electric' && 'Electric motors are efficient but batteries are heavy. This is the biggest challenge in electric aviation today.'}
            {tailChoice === 'canard' && 'A canard (small front wing) creates lift AND prevents the main wing from stalling. Many modern fighters use this.'}
            {tailChoice === 'none' && 'Flying wings have no tail — all lift comes from the wing itself. This is the most efficient shape, but hard to control without computers.'}
            {airfoilChoice === 'naca4412' && 'A curved airfoil creates more lift at low speeds — great for short runways. The downside is more drag at high speed.'}
            {airfoilChoice === 'naca0012' && 'A symmetric airfoil generates zero lift at zero angle of attack. It\'s used on aerobatic planes that need equal performance upright and inverted.'}
            {!['long', 'short', 'wide'].includes(wingChoice) && !['turbofan', 'electric'].includes(propChoice) && !['canard', 'none'].includes(tailChoice) && airfoilChoice === 'naca2412' &&
              'Your design is balanced! Try changing one thing at a time to see how it affects performance. What happens if you make the wings longer?'}
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

function OptionCardH({ option, active, onPress }: {
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
  container: { flex: 1, backgroundColor: colors.background },
  viewport: {
    height: '40%',
    backgroundColor: '#6CB4EE',
    borderBottomWidth: 2,
    borderBottomColor: colors.borderStrong,
    position: 'relative',
  },
  canvas: { flex: 1 },
  cameraToggle: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  camBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  camBtnActive: { backgroundColor: 'rgba(255,176,32,0.7)' },
  camBtnText: { color: '#CCC', fontSize: 10, fontWeight: '600' },
  camBtnTextActive: { color: '#000' },
  hud: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  hudItem: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: radius.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  hudLabel: { color: colors.textFaint, fontSize: 9 },
  hudValue: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  flightOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.sm,
    padding: 10,
  },
  flightText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, textAlign: 'center' },
  progressBar: {
    height: 4,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  panel: { flex: 1 },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  flyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  flyButtonDisabled: { opacity: 0.5 },
  flyButtonText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  horizontalScroll: { gap: spacing.sm },
  optionCard: {
    width: 150,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
    minHeight: 80,
  },
  optionCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  optionIcon: { fontSize: 20 },
  optionLabel: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  optionLabelActive: { color: colors.primary },
  optionTip: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 14, marginTop: 2 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  resultStat: {
    flexGrow: 1, flexBasis: '28%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md, padding: spacing.md, gap: 2, alignItems: 'center',
  },
  resultLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  resultValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
});

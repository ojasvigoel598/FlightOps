// Engineering Simulation — the main immersive experience.
//
// Connects:
//   Hangar (3D config) → Flight State Machine → Mission Timeline → Causality Panel
//
// Flow: DESIGN → HANGAR → CONFIGURE → FLIGHT → RESULT
//
// The user sees the aircraft physically change when they make engineering choices,
// then watches the full flight simulation with phase transitions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@react-three/fiber';

import { Badge, Panel } from '@/components';
import AircraftModel, { buildDesignParams, type AircraftDesignParams } from '@/components/three/AircraftModel';
import Hangar3D, { type HangarCameraMode } from '@/components/three/Hangar3D';
import ChaseCamera from '@/components/three/ChaseCamera';
import { EngineExhaust, WingtipContrail } from '@/components/three/Particles';
import { Rain, StormClouds, WindStreaks } from '@/components/three/WeatherEffects';
import {
  Clouds, ControlTower, Hangar, Mountains, Ocean, Runway, RunwayLights,
  Sky, Terrain, Trees, WindIndicator,
} from '@/components/three/World';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  createInitialState, stepFlight, autopilotForPhase, getCausality,
  type FlightPhase, type FlightSimState, ALL_PHASES, PHASE_CONFIG,
  type EngineeringCausality,
} from '@/services/flight-state-machine';
import {
  computeMassBreakdown, computePerformance, defaultFuselageConfig,
  defaultPropulsionConfig, defaultTailConfig, PropulsionType, TailConfig,
} from '@/services/aircraft-config';
import { computeMissionRequirements, PRESET_MISSIONS, type MissionType } from '@/services/mission-design';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SimMode = 'hangar' | 'flight';

interface OptionCard {
  id: string;
  label: string;
  icon: string;
  tip: string;
  tag: string;
}

// ---------------------------------------------------------------------------
// Option cards
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EngineeringSimulation() {
  // Design choices
  const [wingChoice, setWingChoice] = useState('medium');
  const [tailChoice, setTailChoice] = useState('conventional');
  const [propChoice, setPropChoice] = useState('turboprop');
  const [airfoilChoice, setAirfoilChoice] = useState('naca2412');

  // Simulation mode
  const [simMode, setSimMode] = useState<SimMode>('hangar');
  const [hangarCamera, setHangarCamera] = useState<HangarCameraMode>('orbit');

  // Flight state
  const [flightState, setFlightState] = useState<FlightSimState | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const [engineFailure, setEngineFailure] = useState(false);
  const [icingEvent, setIcingEvent] = useState(false);
  const flightRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Computed performance
  const result = useMemo(() => {
    const wingPreset = WING_PRESETS[wingChoice] || WING_PRESETS.medium;
    const propPreset = PROP_PRESETS[propChoice] || PROP_PRESETS.turboprop;
    const missionType: MissionType = 'trainer';
    const mission = PRESET_MISSIONS[missionType];
    const requirements = computeMissionRequirements(mission);

    const wing = {
      spanM: wingPreset.spanM, areaM2: wingPreset.areaM2, taperRatio: 0.6,
      sweepDeg: propChoice === 'turbofan' ? 25 : 2, dihedralDeg: 3, incidenceDeg: 2,
      washoutDeg: -2, airfoilId: airfoilChoice, flapType: 'slotted' as const, flapSegments: 2,
    };
    const tail: TailConfig = { ...defaultTailConfig(), configuration: tailChoice as TailConfig['configuration'] };
    const prop = {
      ...defaultPropulsionConfig(), type: propPreset.type, count: propPreset.count,
      powerW: propPreset.powerW, engineMassKg: propPreset.type === 'turbofan' ? 2000 : 120,
      propDiameterM: propPreset.type === 'turbofan' ? 0 : 2.5,
      propEfficiency: propPreset.type === 'turbofan' ? 0.85 : 0.82,
      sfc: propPreset.type === 'turbofan' ? 0.06 / 3600 : 0.55 / 3600,
    };

    const mass = computeMassBreakdown(wing, tail, defaultFuselageConfig(), prop, mission.payloadKg, requirements.fuelMassKg);
    const config = { name: mission.name, wing, tail, fuselage: defaultFuselageConfig(), propulsion: prop, mass };
    const perf = computePerformance(config);

    return { perf, mission, requirements, mass };
  }, [wingChoice, tailChoice, propChoice, airfoilChoice]);

  // Design params for 3D
  const designParams = useMemo(() => {
    const gearPos = flightState
      ? PHASE_CONFIG[flightState.currentPhase].gearDown ? 1 : 0
      : 1;
    const flapDeg = flightState ? PHASE_CONFIG[flightState.currentPhase].flapDeg : 0;

    return buildDesignParams({
      wingId: wingChoice, tailId: tailChoice, airfoilId: airfoilChoice,
      engineId: propChoice, engineCount: PROP_PRESETS[propChoice]?.count ?? 1,
      flightSpeed: isFlying ? 1 : 0,
      pitch: flightState ? flightState.pitch * (Math.PI / 180) : 0,
      bank: flightState ? flightState.roll * (Math.PI / 180) : 0,
      gearPosition: gearPos,
      flapDeg,
      elevatorDeg: flightState ? flightState.pitch * 0.5 : 0,
      aileronDeg: flightState ? flightState.roll * 0.3 : 0,
      rudderDeg: flightState ? flightState.heading * 0.02 : 0,
      failedEngine: engineFailure ? 2 : 0,
      enginesRunning: PROP_PRESETS[propChoice]?.count === 2
        ? [true, !engineFailure]
        : [!engineFailure],
      icingLevel: icingEvent ? 0.6 : 0,
    });
  }, [wingChoice, tailChoice, propChoice, airfoilChoice, flightState, isFlying, engineFailure, icingEvent]);

  // Start flight
  const startFlight = useCallback(() => {
    const massKg = result.mass.mtomKg;
    const fuelKg = result.mission.payloadKg * 0.3; // simplified
    const state = createInitialState({ massKg, fuelKg });
    setFlightState(state);
    setIsFlying(true);
    setSimMode('flight');
    setEngineFailure(false);
    setIcingEvent(false);
  }, [result]);

  // Flight simulation loop
  useEffect(() => {
    if (!isFlying || !flightState) return;

    flightRef.current = setInterval(() => {
      setFlightState((prev) => {
        if (!prev) return prev;

        // Apply autopilot
        const cmd = autopilotForPhase(prev.currentPhase, prev);
        let next = { ...prev };
        if (cmd.throttle !== undefined) next.throttle = cmd.throttle;
        if (cmd.gear !== undefined) next.gearDown = cmd.gear;
        if (cmd.flaps !== undefined) next.flapDeg = cmd.flaps;

        // Apply engine failure
        if (engineFailure && !next.engineFailed) {
          next.engineFailed = true;
          next.failedEngine = 2;
        }

        // Apply icing
        if (icingEvent) {
          // icing effect is tracked via the icingEvent state
        }

        // Step physics
        next = stepFlight(next, 0.05);
        return { ...next, icingLevel: icingEvent ? Math.min(1, ((next as any).icingLevel ?? 0) + 0.01) : 0 } as any;
      });
    }, 50);

    return () => {
      if (flightRef.current) clearInterval(flightRef.current);
    };
  }, [isFlying, flightState, engineFailure, icingEvent]);

  // Stop flight when shutdown phase reached
  useEffect(() => {
    if (flightState?.currentPhase === 'SHUTDOWN') {
      setTimeout(() => {
        setIsFlying(false);
        if (flightRef.current) clearInterval(flightRef.current);
      }, 2000);
    }
  }, [flightState?.currentPhase]);

  // Trigger engine failure at cruise
  useEffect(() => {
    if (flightState?.currentPhase === 'CRUISE' && flightState.timeInPhase > 2 && !engineFailure) {
      // Auto-trigger failure after 2s in cruise for demo
    }
  }, [flightState?.currentPhase, flightState?.timeInPhase, engineFailure]);

  const currentPhase = flightState?.currentPhase ?? 'PREFLIGHT';
  const phaseConfig = PHASE_CONFIG[currentPhase];
  const causality = flightState ? getCausality(currentPhase, flightState) : null;

  return (
    <View style={s.container}>
      {/* 3D Viewport */}
      <View style={s.viewport}>
        {simMode === 'hangar' ? (
          <Hangar3D design={designParams} cameraMode={hangarCamera} />
        ) : (
          <Canvas camera={{ position: [0, 12, 25], fov: 50 }} style={s.canvas} gl={{ antialias: true, alpha: false }}>
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

            <ChaseCamera
              target={[flightState?.xM ?? 0, flightState?.altitudeM ?? 1.2, flightState?.zM ?? 0]}
              pitch={flightState ? flightState.pitch * (Math.PI / 180) : 0}
              bank={flightState ? flightState.roll * (Math.PI / 180) : 0}
              flying={isFlying}
              mode="chase"
            />

            <group
              position={[flightState?.xM ?? 0, (flightState?.altitudeM ?? 0) + 1.2, flightState?.zM ?? 0]}
              rotation={[flightState ? flightState.pitch * (Math.PI / 180) : 0, 0, flightState ? flightState.roll * (Math.PI / 180) : 0]}
            >
              <AircraftModel design={designParams} />
              {(PROP_PRESETS[propChoice]?.count === 2 ? [true, !engineFailure] : [!engineFailure]).map((running, i) => (
                running ? (
                  <EngineExhaust
                    key={`ex-${i}`}
                    position={[i === 0 ? -2 : 2, -0.5, 0]}
                    throttle={flightState?.throttle ?? 0}
                    direction={[0, 0.05, -1]}
                  />
                ) : null
              ))}
            </group>
          </Canvas>
        )}

        {/* Phase indicator overlay */}
        {isFlying && (
          <View style={s.phaseOverlay}>
            <View style={s.phaseRow}>
              <Text style={s.phaseIcon}>{phaseConfig.icon}</Text>
              <Text style={s.phaseName}>{phaseConfig.label}</Text>
            </View>
            {phaseConfig.warnings.length > 0 && (
              <View style={s.warningBar}>
                {phaseConfig.warnings.map((w, i) => (
                  <Badge key={i} label={`⚠️ ${w}`} tone="danger" />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Camera controls (hangar mode) */}
        {simMode === 'hangar' && (
          <View style={s.cameraToggle}>
            {(['orbit', 'front', 'side', 'top', 'cockpit', 'close_wing', 'close_engine', 'close_gear'] as HangarCameraMode[]).map((m) => (
              <Pressable key={m} onPress={() => setHangarCamera(m)} style={[s.camBtn, hangarCamera === m && s.camBtnActive]}>
                <Text style={[s.camBtnText, hangarCamera === m && s.camBtnTextActive]}>
                  {m === 'orbit' ? '🔄' : m === 'front' ? '👁️' : m === 'side' ? '↔️' : m === 'top' ? '⬆️' : m === 'cockpit' ? '🎮' : m === 'close_wing' ? '🦅' : m === 'close_engine' ? '⚙️' : '🔧'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Bottom panel */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
        {/* Mode toggle */}
        <View style={s.modeRow}>
          <Pressable onPress={() => setSimMode('hangar')} style={[s.modeBtn, simMode === 'hangar' && s.modeBtnActive]}>
            <Text style={[s.modeBtnText, simMode === 'hangar' && s.modeBtnTextActive]}>🏭 Hangar</Text>
          </Pressable>
          <Pressable onPress={() => { if (!isFlying) startFlight(); }} style={[s.modeBtn, simMode === 'flight' && s.modeBtnActive]}>
            <Text style={[s.modeBtnText, simMode === 'flight' && s.modeBtnTextActive]}>🛫 Flight</Text>
          </Pressable>
        </View>

        {/* Launch button */}
        {!isFlying && (
          <Pressable onPress={startFlight} style={s.flyButton}>
            <Text style={s.flyButtonText}>▶ Launch Full Mission</Text>
          </Pressable>
        )}

        {/* Engineering events */}
        {isFlying && (
          <Panel title="⚡ Engineering Events" subtitle="Trigger events during flight.">
            <View style={s.eventRow}>
              <Pressable
                onPress={() => setEngineFailure(true)}
                style={[s.eventBtn, engineFailure && s.eventBtnActive]}
                disabled={engineFailure}
              >
                <Text style={s.eventBtnText}>🔴 Engine 2 OFF</Text>
              </Pressable>
              <Pressable
                onPress={() => setIcingEvent(true)}
                style={[s.eventBtn, icingEvent && s.eventBtnActive]}
                disabled={icingEvent}
              >
                <Text style={s.eventBtnText}>🧊 Ice Freeze</Text>
              </Pressable>
            </View>
          </Panel>
        )}

        {/* Engineering Causality Panel */}
        {causality && (
          <Panel title="🔬 Engineering Causality" tone="raised">
            <View style={s.causalityCard}>
              <Text style={s.causalityLabel}>EVENT</Text>
              <Text style={s.causalityValue}>{causality.event}</Text>
              <Text style={s.causalityLabel}>CAUSE</Text>
              <Text style={s.causalityText}>{causality.cause}</Text>
              <Text style={s.causalityLabel}>PHYSICAL EFFECT</Text>
              <Text style={s.causalityText}>{causality.physicalEffect}</Text>
              <Text style={s.causalityLabel}>AIRCRAFT EFFECT</Text>
              <Text style={s.causalityText}>{causality.aircraftEffect}</Text>
              <Text style={s.causalityLabel}>CONTROL RESPONSE</Text>
              <Text style={s.causalityText}>{causality.controlResponse}</Text>
              <Text style={s.causalityLabel}>MISSION EFFECT</Text>
              <Text style={s.causalityText}>{causality.missionEffect}</Text>
            </View>
          </Panel>
        )}

        {/* Mission Timeline */}
        {isFlying && (
          <Panel title="📋 Mission Timeline" subtitle="Phase progression with status.">
            {ALL_PHASES.map((phase) => {
              const idx = ALL_PHASES.indexOf(phase);
              const currentIdx = ALL_PHASES.indexOf(currentPhase);
              const isDone = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              const isFuture = idx > currentIdx;
              const cfg = PHASE_CONFIG[phase];
              return (
                <View key={phase} style={[s.timelineItem, isCurrent && s.timelineItemCurrent]}>
                  <Text style={[s.timelineIcon, isDone && s.timelineDone, isFuture && s.timelineFuture]}>
                    {isDone ? '✓' : isCurrent ? '●' : '○'}
                  </Text>
                  <Text style={[s.timelineLabel, isCurrent && s.timelineLabelCurrent, isDone && s.timelineDone]}>
                    {cfg.icon} {cfg.label}
                  </Text>
                  {isCurrent && (
                    <Text style={s.timelineNote}>{phaseConfig.transitionNote}</Text>
                  )}
                </View>
              );
            })}
          </Panel>
        )}

        {/* Telemetry */}
        {isFlying && flightState && (
          <Panel title="📡 Live Telemetry" tone="raised">
            <View style={s.telemetryGrid}>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>ALT</Text>
                <Text style={s.teleValue}>{fmt(flightState.altitudeM, 0)} m</Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>SPD</Text>
                <Text style={s.teleValue}>{fmt(flightState.airspeedMs * 3.6, 0)} km/h</Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>VSI</Text>
                <Text style={s.teleValue}>{fmt(flightState.vsiMs, 1)} m/s</Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>FUEL</Text>
                <Text style={s.teleValue}>{fmt(flightState.fuelKg, 0)} kg</Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>GEAR</Text>
                <Text style={[s.teleValue, { color: flightState.gearDown ? '#4ADE80' : '#F87171' }]}>
                  {flightState.gearDown ? 'DOWN' : 'UP'}
                </Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>FLAPS</Text>
                <Text style={s.teleValue}>{flightState.flapDeg}°</Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>AoA</Text>
                <Text style={s.teleValue}>{fmt(flightState.aoa, 1)}°</Text>
              </View>
              <View style={s.teleItem}>
                <Text style={s.teleLabel}>THR</Text>
                <Text style={s.teleValue}>{fmt(flightState.throttle * 100, 0)}%</Text>
              </View>
            </View>
          </Panel>
        )}

        {/* Design choices */}
        {!isFlying && (
          <>
            <Panel title="✈️ Wing" subtitle="The most important part of the aircraft.">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                {WING_OPTIONS.map(opt => (
                  <OptionCardH key={opt.id} option={opt} active={wingChoice === opt.id} onPress={() => setWingChoice(opt.id)} />
                ))}
              </ScrollView>
            </Panel>

            <Panel title="🎯 Airfoil" subtitle="Cross-section of your wing.">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                {AIRFOIL_OPTIONS.map(opt => (
                  <OptionCardH key={opt.id} option={opt} active={airfoilChoice === opt.id} onPress={() => setAirfoilChoice(opt.id)} />
                ))}
              </ScrollView>
            </Panel>

            <Panel title="🔷 Tail" subtitle="Stability and control.">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                {TAIL_OPTIONS.map(opt => (
                  <OptionCardH key={opt.id} option={opt} active={tailChoice === opt.id} onPress={() => setTailChoice(opt.id)} />
                ))}
              </ScrollView>
            </Panel>

            <Panel title="🚀 Engine" subtitle="What powers your aircraft?">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
                {PROP_OPTIONS.map(opt => (
                  <OptionCardH key={opt.id} option={opt} active={propChoice === opt.id} onPress={() => setPropChoice(opt.id)} />
                ))}
              </ScrollView>
            </Panel>
          </>
        )}

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  viewport: { height: '40%', backgroundColor: '#0D1117', borderBottomWidth: 2, borderBottomColor: colors.borderStrong, position: 'relative' },
  canvas: { flex: 1 },
  // Camera controls
  cameraToggle: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 3, flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-end' },
  camBtn: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  camBtnActive: { backgroundColor: 'rgba(255,176,32,0.7)' },
  camBtnText: { color: '#CCC', fontSize: 11, fontWeight: '600' },
  camBtnTextActive: { color: '#000' },
  // Phase overlay
  phaseOverlay: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: radius.sm, padding: 8 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseIcon: { fontSize: 18 },
  phaseName: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  warningBar: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  // Mode toggle
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  modeBtnText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  modeBtnTextActive: { color: colors.primary },
  // Launch
  flyButton: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  flyButtonText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  // Events
  eventRow: { flexDirection: 'row', gap: 8 },
  eventBtn: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  eventBtnActive: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  eventBtnText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  // Panel
  panel: { flex: 1 },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  horizontalScroll: { gap: spacing.sm },
  optionCard: { width: 150, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4, minHeight: 80 },
  optionCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  optionIcon: { fontSize: 20 },
  optionLabel: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  optionLabelActive: { color: colors.primary },
  optionTip: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 14, marginTop: 2 },
  // Timeline
  timelineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  timelineItemCurrent: { backgroundColor: 'rgba(255,176,32,0.08)', borderRadius: radius.sm, padding: 6, marginVertical: 2 },
  timelineIcon: { width: 16, textAlign: 'center', fontSize: fontSize.sm, color: colors.textFaint },
  timelineLabel: { fontSize: fontSize.sm, color: colors.textSubtle, flex: 1 },
  timelineLabelCurrent: { color: colors.primary, fontWeight: fontWeight.bold },
  timelineDone: { color: '#4ADE80' },
  timelineFuture: { color: colors.textFaint },
  timelineNote: { fontSize: fontSize.xs, color: colors.textFaint, fontStyle: 'italic' },
  // Telemetry
  telemetryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  teleItem: { flexGrow: 1, flexBasis: '20%', backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: 8, alignItems: 'center' },
  teleLabel: { color: colors.textFaint, fontSize: 9 },
  teleValue: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  // Causality
  causalityCard: { gap: 6 },
  causalityLabel: { color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 6 },
  causalityValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  causalityText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 18 },
});

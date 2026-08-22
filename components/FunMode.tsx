// Fun Mode — Complete 3D aircraft design game.
//
// V2: Real state-driven flight physics replaces scripted flightProgress.
//     Joystick controls → flight dynamics → aircraft state → world position.
//     Added: pause/resume, event reset, proper multi-engine propellers.

import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@react-three/fiber';

import { Badge, Panel } from '@/components';
import AircraftModel, { buildDesignParams } from '@/components/three/AircraftModel';
import ChaseCamera from '@/components/three/ChaseCamera';
import { EngineExhaust, WingtipContrail } from '@/components/three/Particles';
import { Rain, StormClouds, WindStreaks } from '@/components/three/WeatherEffects';
import {
  Clouds, ControlTower, Hangar, Mountains, Ocean, Runway, RunwayLights,
  Sky, Terrain, Trees, WindIndicator,
} from '@/components/three/World';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  computeMassBreakdown, computePerformance, defaultFuselageConfig,
  defaultPropulsionConfig, defaultTailConfig, type TailConfig,
} from '@/services/aircraft-config';
import {
  FUN_MISSIONS, type FunMission, type MissionResult,
  computeMissionResult, evaluateObjective,
} from '@/services/fun-missions';
import {
  createFunFlightState, stepFunFlight, getFlightRenderState,
  type FunFlightState, type EventEffects,
} from '@/services/fun-flight';
import {
  initAudio, updateEngineSound, playWarning, playClick,
  playMissionStart, playMissionComplete, playMissionFail,
  toggleMute, isMuted, getVolumes,
} from '@/services/audio-engine';
import {
  computeMissionRequirements, PRESET_MISSIONS, type MissionType,
} from '@/services/mission-design';

// ---------------------------------------------------------------------------
// Error boundary for3D Canvas
// ---------------------------------------------------------------------------

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error, info: ErrorInfo) { console.warn('3D Canvas error:', err, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D1B2A', padding: 20 }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>✈️</Text>
          <Text style={{ color: '#FFB020', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>3D View Unavailable</Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
            WebGL may not be supported in this browser.{'\n'}The design panel below still works!
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Option cards
// ---------------------------------------------------------------------------

interface OptionCard { id: string; label: string; icon: string; tip: string; tag: string; }

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
  short: { spanM: 8, areaM2: 12 }, medium: { spanM: 10, areaM2: 16 },
  long: { spanM: 14, areaM2: 18 }, wide: { spanM: 12, areaM2: 24 },
};
const PROP_PRESETS: Record<string, { type: string; powerW: number; count: number }> = {
  piston: { type: 'piston', powerW: 150_000, count: 1 },
  turboprop: { type: 'turboprop', powerW: 500_000, count: 1 },
  turbofan: { type: 'turbofan', powerW: 0, count: 2 },
  electric: { type: 'electric', powerW: 200_000, count: 1 },
};
const MISSION_PRESETS: Record<string, MissionType> = {
  trainer: 'trainer', cargo: 'cargo', surveillance: 'surveillance',
  'high-speed': 'high-speed', agricultural: 'agricultural',
};

type CameraMode = 'chase' | 'orbit' | 'side' | 'cockpit';

// ---------------------------------------------------------------------------
// 3D Scene — now reads from physics state, not scripted curves
// ---------------------------------------------------------------------------

function AircraftScene({
  designParams, flightState, cameraMode, propChoice,
  weather, activeEvent, engineFailed, enginesRunning,
}: {
  designParams: ReturnType<typeof buildDesignParams>;
  flightState: FunFlightState;
  cameraMode: CameraMode;
  propChoice: string;
  weather: FunMission['environment'];
  activeEvent: EventEffects | null;
  engineFailed: boolean;
  enginesRunning: boolean[];
}) {
  const render = getFlightRenderState(flightState);
  const flying = flightState.totalTime > 0 && flightState.flightProgress < 1;
  const throttle = flying ? flightState.throttle : 0;
  const isHighAlt = render.isHighAlt;

  const enginePositions = useMemo(() => {
    const sp = designParams.spanM * 0.25;
    if (designParams.engineCount === 1) return [[0, -0.55, 0.5] as [number, number, number]];
    return [
      [-sp, -0.15, 0] as [number, number, number],
      [sp, -0.15, 0] as [number, number, number],
    ];
  }, [designParams.engineCount, designParams.spanM]);

  const rainCount = weather.turbulence > 0.3 ? Math.floor(weather.turbulence * 200) : 0;
  const showWind = weather.windMs > 5;
  const showStorm = weather.visibility < 0.7;
  const icingActive = flightState.icingLevel > 0;

  return (
    <>
      <Sky />
      <Terrain />
      <Ocean />
      <Runway />
      <RunwayLights />
      <Clouds count={showStorm ? 25 : 18} />
      <Mountains count={14} />
      <Hangar />
      <ControlTower />
      <Trees count={35} />
      <WindIndicator windMs={weather.windMs} direction={weather.windDirDeg} />

      <Rain count={rainCount} intensity={weather.turbulence} />
      <WindStreaks windMs={weather.windMs} windDirDeg={weather.windDirDeg} active={showWind && flying} />
      <StormClouds visibility={weather.visibility} />

      <ChaseCamera target={render.position} pitch={render.pitch} bank={render.bank} flying={flying} mode={cameraMode} />

      <group position={render.position} rotation={[render.pitch, 0, render.bank]}>
        <AircraftModel design={{ ...designParams, flightSpeed: render.flightSpeed, pitch: 0, bank: 0, failedEngine: engineFailed ? 2 : 0, enginesRunning }} />

        {icingActive && (
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[designParams.spanM * 0.9, 0.06, 1.8]} />
            <meshStandardMaterial color="#B8D4E8" transparent opacity={0.15 + flightState.icingLevel * 0.3} />
          </mesh>
        )}

        {enginePositions.map((pos, i) => (
          <EngineExhaust key={`ex-${i}`} position={pos} throttle={enginesRunning[i] ? throttle : 0} direction={[0, 0.05, -1]} />
        ))}

        {isHighAlt && (
          <>
            <WingtipContrail position={[designParams.spanM / 2, 0, 0.5]} active={isHighAlt} speed={render.flightSpeed * 250} />
            <WingtipContrail position={[-designParams.spanM / 2, 0, 0.5]} active={isHighAlt} speed={render.flightSpeed * 250} />
          </>
        )}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function getEventEffect(type: string, severity: number): EventEffects {
  const s = severity;
  switch (type) {
    case 'gust': return { dragMultiplier: 1 + s * 0.1, liftMultiplier: 1 - s * 0.05, thrustMultiplier: 1, integrityDamage: s * 0.3 };
    case 'crosswind': return { dragMultiplier: 1 + s * 0.15, liftMultiplier: 1, thrustMultiplier: 1, integrityDamage: s * 0.2 };
    case 'icing': return { dragMultiplier: 1 + s * 0.2, liftMultiplier: 1 - s * 0.1, thrustMultiplier: 1 - s * 0.03, integrityDamage: s * 0.5 };
    case 'wind_shear': return { dragMultiplier: 1 + s * 0.25, liftMultiplier: 1 - s * 0.15, thrustMultiplier: 1, integrityDamage: s * 0.4 };
    case 'thunderstorm': return { dragMultiplier: 1 + s * 0.3, liftMultiplier: 1 - s * 0.1, thrustMultiplier: 1 - s * 0.05, integrityDamage: s * 0.8 };
    default: return { dragMultiplier: 1, liftMultiplier: 1, thrustMultiplier: 1, integrityDamage: 0 };
  }
}

// ---------------------------------------------------------------------------
// Active event UI type
// ---------------------------------------------------------------------------

interface ActiveEventUI {
  type: string;
  description: string;
  severity: number;
  timeLeft: number;
  effect: EventEffects;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FunMode() {
  // Design choices
  const [wingChoice, setWingChoice] = useState('medium');
  const [tailChoice, setTailChoice] = useState('conventional');
  const [propChoice, setPropChoice] = useState('turboprop');
  const [airfoilChoice, setAirfoilChoice] = useState('naca2412');

  // Mission & camera
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  // Joystick state
  const [joystick, setJoystick] = useState({ throttle: 0.5, elevator: 0, rudder: 0 });

  // Flight state — driven by physics
  const [flightState, setFlightState] = useState<FunFlightState>(() =>
    createFunFlightState({ wingId: 'medium', propId: 'turboprop', engineCount: 1, windMs: 3, windDirDeg: 270, payloadKg: 500 })
  );
  const [flying, setFlying] = useState(false);
  const [paused, setPaused] = useState(false);
  const flightRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flightStateRef = useRef<FunFlightState>(flightState);

  // Engine state
  const [engineFailed, setEngineFailed] = useState(false);
  const [enginesRunning, setEnginesRunning] = useState<boolean[]>([true]);

  // Active mission event
  const [activeEvent, setActiveEvent] = useState<ActiveEventUI | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);

  // Mission result
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);
  const [showMissionBrowser, setShowMissionBrowser] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  const selectedMission = selectedMissionId ? FUN_MISSIONS.find(m => m.id === selectedMissionId) : null;

  // Computed performance
  const result = useMemo(() => {
    const wingPreset = WING_PRESETS[wingChoice] || WING_PRESETS.medium;
    const propPreset = PROP_PRESETS[propChoice] || PROP_PRESETS.turboprop;
    const mission = PRESET_MISSIONS[MISSION_PRESETS.trainer];
    const requirements = computeMissionRequirements(mission);
    const wing = {
      spanM: wingPreset.spanM, areaM2: wingPreset.areaM2, taperRatio: 0.6,
      sweepDeg: propChoice === 'turbofan' ? 25 : 2, dihedralDeg: 3, incidenceDeg: 2,
      washoutDeg: -2, airfoilId: airfoilChoice, flapType: 'slotted' as const, flapSegments: 2,
    };
    const tail: TailConfig = { ...defaultTailConfig(), configuration: tailChoice as TailConfig['configuration'] };
    const prop = {
      ...defaultPropulsionConfig(), type: propPreset.type as 'turboprop', count: propPreset.count,
      powerW: propPreset.powerW, engineMassKg: propPreset.type === 'turbofan' ? 2000 : 120,
      propDiameterM: propPreset.type === 'turbofan' ? 0 : 2.5,
      propEfficiency: propPreset.type === 'turbofan' ? 0.85 : 0.82,
      sfc: propPreset.type === 'turbofan' ? 0.06 / 3600 : 0.55 / 3600,
    };
    const mass = computeMassBreakdown(wing, tail, defaultFuselageConfig(), prop, mission.payloadKg, requirements.fuelMassKg);
    const config = { name: mission.name, wing, tail, fuselage: defaultFuselageConfig(), propulsion: prop, mass };
    const perf = computePerformance(config);
    return { perf, feasible: perf.rangeKm >= mission.rangeKm, mission, requirements, stallSpeed: perf.stallSpeedMs };
  }, [wingChoice, tailChoice, propChoice, airfoilChoice]);

  const designParams = useMemo(() => {
    return buildDesignParams({
      wingId: wingChoice, tailId: tailChoice, airfoilId: airfoilChoice,
      engineId: propChoice, engineCount: PROP_PRESETS[propChoice]?.count ?? 1,
      flightSpeed: flying ? 1 : 0, pitch: 0, bank: 0,
    });
  }, [wingChoice, tailChoice, propChoice, airfoilChoice, flying]);

  // Sync ref
  useEffect(() => { flightStateRef.current = flightState; }, [flightState]);

  // -----------------------------------------------------------------------
  // Audio init on first interaction
  // -----------------------------------------------------------------------
  const ensureAudio = useCallback(() => {
    if (!audioEnabled) {
      const ok = initAudio();
      setAudioEnabled(ok);
    }
  }, [audioEnabled]);

  const handleToggleMute = useCallback(() => {
    ensureAudio();
    const m = toggleMute();
    setAudioMuted(m);
  }, [ensureAudio]);

  // -----------------------------------------------------------------------
  // Start flight — real physics
  // -----------------------------------------------------------------------
  const startFlight = useCallback(() => {
    if (flying || !selectedMission) return;
    ensureAudio();
    playMissionStart();

    const engineCount = PROP_PRESETS[propChoice]?.count ?? 1;
    const wind = selectedMission.environment;

    const initialState = createFunFlightState({
      wingId: wingChoice, propId: propChoice, engineCount,
      windMs: wind.windMs, windDirDeg: wind.windDirDeg, payloadKg: 500,
    });

    setFlightState(initialState);
    flightStateRef.current = initialState;
    setFlying(true);
    setPaused(false);
    setEngineFailed(false);
    setEnginesRunning(Array(engineCount).fill(true));
    setActiveEvent(null);
    setEventLog([]);
    setMissionResult(null);
    setShowMissionBrowser(false);
    setJoystick({ throttle: 0.5, elevator: 0, rudder: 0 });

    const DT = 0.033; // ~30fps physics step
    let missionTime = 0;
    let triggeredEvents = new Set<string>();

    flightRef.current = setInterval(() => {
      const prev = flightStateRef.current;
      if (prev.paused || prev.flightProgress >= 1) return;

      // Build input from joystick
      const input = {
        throttle: joystick.throttle,
        pitchInput: joystick.elevator,
        yawInput: joystick.rudder,
        gearDown: prev.gearDown,
        flapDeg: prev.flapDeg,
        brake: prev.brakeOn,
      };

      // Accumulate event effects
      let totalEffects: EventEffects | null = null;
      if (activeEvent) {
        totalEffects = activeEvent.effect;
      }

      // Step physics
      let next = stepFunFlight(prev, input, wingChoice, propChoice, engineCount, DT, totalEffects);

      // Update audio engine sound
      updateEngineSound(next.throttle, next.airspeedMs, next.engineRunning);

      // Check for event triggers based on progress
      if (selectedMission) {
        for (const evt of selectedMission.environment.events) {
          if (Math.abs(next.flightProgress - evt.triggerProgress) < 0.015 && !triggeredEvents.has(evt.description)) {
            triggeredEvents.add(evt.description);
            const effect = getEventEffect(evt.type, evt.severity);
            setActiveEvent({ type: evt.type, description: evt.description, severity: evt.severity, timeLeft: evt.durationS, effect });
            setEventLog(prev => [...prev, evt.description]);
          }
        }
      }

      // Process active event countdown
      if (activeEvent) {
        const newTime = activeEvent.timeLeft - DT;
        if (newTime <= 0) {
          setActiveEvent(null);
        } else {
          setActiveEvent(prev => prev ? { ...prev, timeLeft: newTime } : null);
        }
      }

      missionTime += DT;

      // Check completion
      if (next.flightProgress >= 1) {
        next = { ...next, flightProgress: 1 };
        clearInterval(flightRef.current!);
        flightRef.current = null;

        const fuelPct = next.fuelKg > 0 ? 80 : 20;
        const stats: Record<string, number> = {
          altitude: next.altitudeM, distance: next.distanceFlown / 1000,
          maxSpeed: next.airspeedMs * 3.6, flightTime: missionTime,
          fuelUsedKg: 300 - next.fuelKg, fuelRemainingPct: fuelPct,
          landed: next.integrity > 0 ? 1 : 0, integrity: next.integrity,
          cruiseSpeed: next.airspeedMs, takeoffDist: 400,
          maxG: 1 + Math.abs(joystick.elevator) * 3,
        };
        if (selectedMission) {
          const res = computeMissionResult(selectedMission, stats);
          setMissionResult(res);
          playMissionComplete();
        }
        updateEngineSound(0, 0, false);
        setTimeout(() => { setFlying(false); setPaused(false); }, 2000);
      }

      // Check failure
      if (next.integrity <= 0 || next.fuelKg <= 0) {
        clearInterval(flightRef.current!);
        flightRef.current = null;
        const stats: Record<string, number> = {
          altitude: next.altitudeM, distance: next.distanceFlown / 1000,
          maxSpeed: next.airspeedMs * 3.6, flightTime: missionTime,
          fuelUsedKg: 300 - next.fuelKg, fuelRemainingPct: 0,
          landed: 0, integrity: next.integrity,
          cruiseSpeed: next.airspeedMs, takeoffDist: 400,
          maxG: 1 + Math.abs(joystick.elevator) * 3,
        };
        if (selectedMission) {
          const res = computeMissionResult(selectedMission, stats);
          setMissionResult(res);
          playMissionFail();
        }
        updateEngineSound(0, 0, false);
        setTimeout(() => { setFlying(false); setPaused(false); }, 2000);
      }

      setFlightState(next);
      flightStateRef.current = next;
    }, 33);
  }, [flying, selectedMission, propChoice, wingChoice, joystick.throttle, joystick.elevator, joystick.rudder, activeEvent]);

  // Cleanup
  useEffect(() => {
    return () => { if (flightRef.current) clearInterval(flightRef.current); };
  }, []);

  // -----------------------------------------------------------------------
  // Pause / Resume
  // -----------------------------------------------------------------------
  const togglePause = useCallback(() => {
    setPaused(prev => {
      const next = !prev;
      setFlightState(s => ({ ...s, paused: next }));
      flightStateRef.current = { ...flightStateRef.current, paused: next };
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Event Reset
  // -----------------------------------------------------------------------
  const resetEvent = useCallback(() => {
    setActiveEvent(null);
    setFlightState(prev => {
      const next = { ...prev, icingLevel: 0, engineFailed: false, failedEngine: 0 };
      flightStateRef.current = next;
      return next;
    });
    setEngineFailed(false);
    const engineCount = PROP_PRESETS[propChoice]?.count ?? 1;
    setEnginesRunning(Array(engineCount).fill(true));
  }, [propChoice]);

  // -----------------------------------------------------------------------
  // Trigger manual engineering events
  // -----------------------------------------------------------------------
  const triggerEngineFailure = useCallback(() => {
    ensureAudio();
    playWarning('engine-failure');
    setEngineFailed(true);
    setFlightState(prev => {
      const next = { ...prev, engineFailed: true, failedEngine: 2 };
      flightStateRef.current = next;
      return next;
    });
    setEnginesRunning(prev => prev.map((r, i) => i === 1 ? false : r));
    setEventLog(prev => [...prev, 'Engine 2 failure triggered']);
  }, []);

  const triggerIcing = useCallback(() => {
    ensureAudio();
    playWarning('icing');
    setFlightState(prev => {
      const next = { ...prev, icingLevel: Math.min(1, prev.icingLevel + 0.5) };
      flightStateRef.current = next;
      return next;
    });
    setActiveEvent({ type: 'icing', description: 'Ice accumulating on wings', severity: 3, timeLeft: 10, effect: getEventEffect('icing', 3) });
    setEventLog(prev => [...prev, 'Icing event triggered']);
  }, []);

  // -----------------------------------------------------------------------
  // Joystick handlers
  // -----------------------------------------------------------------------
  const adjustThrottle = (delta: number) => {
    setJoystick(j => ({ ...j, throttle: Math.max(0, Math.min(1, j.throttle + delta)) }));
  };
  const adjustElevator = (delta: number) => {
    setJoystick(j => ({ ...j, elevator: Math.max(-1, Math.min(1, j.elevator + delta)) }));
  };
  const adjustRudder = (delta: number) => {
    setJoystick(j => ({ ...j, rudder: Math.max(-1, Math.min(1, j.rudder + delta)) }));
  };

  // Derived HUD values from physics state
  const hudAlt = Math.round(flightState.altitudeM);
  const hudSpd = Math.round(flightState.airspeedMs * 3.6);
  const hudFuel = Math.round((flightState.fuelKg / 300) * 100);
  const hudDist = (flightState.distanceFlown / 1000).toFixed(1);
  const hudIntegrity = Math.round(flightState.integrity);

  return (
    <View style={s.container}>
      {/* Mission result overlay */}
      {missionResult && (
        <View style={s.resultOverlay}>
          <View style={s.resultCard}>
            <Text style={s.resultGrade}>{missionResult.grade}</Text>
            <Text style={s.resultTitle}>
              {missionResult.completed ? 'Mission Complete!' : 'Mission Failed'}
            </Text>
            <Text style={s.resultSub}>
              {missionResult.objectivesMet}/{missionResult.totalObjectives} objectives • {missionResult.creditsEarned} credits
            </Text>
            {selectedMission?.objectives.map((obj) => {
              const met = evaluateObjective(obj, {
                altitude: hudAlt, distance: parseFloat(hudDist), maxSpeed: hudSpd,
                flightTime: flightState.totalTime, fuelUsedKg: 300 - flightState.fuelKg,
                fuelRemainingPct: hudFuel, landed: missionResult.completed ? 1 : 0,
                integrity: hudIntegrity, cruiseSpeed: flightState.airspeedMs,
                takeoffDist: 400, maxG: 1 + Math.abs(joystick.elevator) * 3,
              });
              return (
                <Text key={obj.id} style={[s.resultObj, { color: met ? '#4ADE80' : '#F87171' }]}>
                  {met ? '✅' : '❌'} {obj.text}
                </Text>
              );
            })}
            <Pressable onPress={() => { setMissionResult(null); setShowMissionBrowser(true); }} style={s.resultCloseBtn}>
              <Text style={s.resultCloseBtnText}>Back to Missions</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Event notification */}
      {activeEvent && (
        <View style={[s.eventBanner, { borderLeftColor: activeEvent.severity >= 4 ? '#EF4444' : activeEvent.severity >= 2 ? '#F59E0B' : '#3B82F6' }]}>
          <Text style={s.eventIcon}>
            {activeEvent.type === 'gust' ? '💨' : activeEvent.type === 'icing' ? '🧊' :
             activeEvent.type === 'crosswind' ? '🌪️' : activeEvent.type === 'wind_shear' ? '⚠️' : '⛈️'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={s.eventText}>{activeEvent.description}</Text>
            <Text style={s.eventSeverity}>Severity {activeEvent.severity}/5 • {activeEvent.timeLeft.toFixed(1)}s</Text>
          </View>
        </View>
      )}

      {/* 3D Viewport */}
      <View style={s.viewport}>
        <CanvasErrorBoundary>
          <Canvas camera={{ position: [0, 12, 25], fov: 50 }} style={s.canvas} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => { gl.setClearColor('#6CB4EE'); }}>
            <AircraftScene
              designParams={designParams}
              flightState={flightState}
              cameraMode={cameraMode}
              propChoice={propChoice}
              weather={selectedMission?.environment ?? { windMs: 3, windDirDeg: 270, visibility: 1, turbulence: 0.1, tempDeviationC: 0, events: [] }}
              activeEvent={activeEvent?.effect ?? null}
              engineFailed={engineFailed}
              enginesRunning={enginesRunning}
            />
          </Canvas>
        </CanvasErrorBoundary>

        {/* Camera toggle + pause + audio */}
        <View style={s.topControls}>
          <Pressable onPress={handleToggleMute} style={[s.camBtn]}> 
            <Text style={s.camBtnText}>{audioMuted ? '🔇' : '🔊'}</Text>
          </Pressable>
          <Pressable onPress={togglePause} style={[s.camBtn, paused && { backgroundColor: 'rgba(239,68,68,0.7)' }]}>
            <Text style={[s.camBtnText, paused && s.camBtnTextActive]}>{paused ? '▶' : '⏸'}</Text>
          </Pressable>
          {(['chase', 'orbit', 'side', 'cockpit'] as CameraMode[]).map((m) => (
            <Pressable key={m} onPress={() => setCameraMode(m)} style={[s.camBtn, cameraMode === m && s.camBtnActive]}>
              <Text style={[s.camBtnText, cameraMode === m && s.camBtnTextActive]}>
                {m === 'chase' ? '📹' : m === 'orbit' ? '🔄' : m === 'cockpit' ? '🎮' : '🎬'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Flight HUD — driven by physics state */}
        {flying && (
          <View style={s.flightOverlay}>
            <View style={s.hudRow}>
              <View style={s.hudItem}><Text style={s.hudLabel}>SPD</Text><Text style={s.hudValue}>{hudSpd} km/h</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>ALT</Text><Text style={s.hudValue}>{hudAlt} m</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>DST</Text><Text style={s.hudValue}>{hudDist} km</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>FUEL</Text><Text style={s.hudValue}>{hudFuel}%</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>AC</Text><Text style={s.hudValue}>{hudIntegrity}%</Text></View>
              {paused && <View style={s.hudItem}><Text style={[s.hudValue, { color: '#EF4444' }]}>PAUSED</Text></View>}
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${flightState.flightProgress * 100}%` }]} />
            </View>
          </View>
        )}

        {/* Parked HUD */}
        {!flying && !showMissionBrowser && (
          <View style={s.hud}>
            <View style={s.hudItem}><Text style={s.hudLabel}>Speed</Text><Text style={s.hudValue}>{fmt(result.perf.cruiseSpeedMs * 3.6, 0)} km/h</Text></View>
            <View style={s.hudItem}><Text style={s.hudLabel}>Range</Text><Text style={s.hudValue}>{fmt(result.perf.rangeKm, 0)} km</Text></View>
            <View style={s.hudItem}><Text style={s.hudLabel}>L/D</Text><Text style={s.hudValue}>{fmt(result.perf.maxLd, 0)}:1</Text></View>
            <View style={s.hudItem}><Text style={s.hudLabel}>Stall</Text><Text style={s.hudValue}>{fmt(result.stallSpeed, 0)} m/s</Text></View>
          </View>
        )}
      </View>

      {/* Bottom panel */}
      {showMissionBrowser ? (
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          <Text style={s.sectionTitle}>🎯 Select a Mission</Text>
          {(['training', 'commercial', 'military', 'challenge'] as const).map(cat => {
            const missions = FUN_MISSIONS.filter(m => m.category === cat);
            if (missions.length === 0) return null;
            return (
              <View key={cat}>
                <Text style={s.catLabel}>{cat.toUpperCase()}</Text>
                {missions.map(m => (
                  <Pressable key={m.id} style={s.missionCard} onPress={() => { ensureAudio(); playClick(); setSelectedMissionId(m.id); setShowMissionBrowser(false); }}>
                    <Text style={s.missionIcon}>{m.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.missionName}>{m.name}</Text>
                      <Text style={s.missionDesc}>{m.description}</Text>
                      <View style={s.missionMeta}>
                        <Badge label={`⭐ ${m.difficulty}/5`} tone="neutral" />
                        <Badge label={`💰 ${m.creditReward}`} tone="accent" />
                        <Badge label={m.category} tone="neutral" />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          {/* Mission header */}
          {selectedMission && (
            <View style={s.missionHeader}>
              <Text style={s.missionHeaderTitle}>{selectedMission.icon} {selectedMission.name}</Text>
              <Text style={s.missionHeaderDesc}>{selectedMission.description}</Text>
              <View style={s.missionObjList}>
                {selectedMission.objectives.map(obj => (
                  <Text key={obj.id} style={s.missionObjItem}>• {obj.text} ({obj.value} {obj.unit})</Text>
                ))}
              </View>
              <Text style={s.missionHint}>💡 {selectedMission.hint}</Text>
            </View>
          )}

          {/* Launch + Pause */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={startFlight} style={[s.flyButton, flying && s.flyButtonDisabled, { flex: 1 }]} disabled={flying}>
              <Text style={s.flyButtonText}>{flying ? '✈️ Flying...' : '🛫 Launch Flight'}</Text>
            </Pressable>
            {flying && (
              <Pressable onPress={togglePause} style={[s.flyButton, { flex: 0, paddingHorizontal: 20, backgroundColor: paused ? '#22C55E' : '#EF4444' }]}>
                <Text style={s.flyButtonText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
              </Pressable>
            )}
          </View>

          {/* Joystick controls */}
          <Panel title="🎮 Flight Controls" subtitle="Throttle, pitch, yaw — these control the actual flight physics.">
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Throttle</Text>
              <Pressable onPress={() => adjustThrottle(-0.1)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>−</Text></Pressable>
              <View style={s.throttleBar}><View style={[s.throttleFill, { width: `${joystick.throttle * 100}%` }]} /></View>
              <Pressable onPress={() => adjustThrottle(0.1)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>+</Text></Pressable>
              <Text style={s.controlValue}>{fmt(joystick.throttle * 100, 0)}%</Text>
            </View>
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Pitch</Text>
              <Pressable onPress={() => adjustElevator(-0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>↓</Text></Pressable>
              <View style={s.joystickBar}><View style={[s.joystickIndicator, { left: `${50 + joystick.elevator * 45}%` }]} /></View>
              <Pressable onPress={() => adjustElevator(0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>↑</Text></Pressable>
              <Text style={s.controlValue}>{joystick.elevator > 0 ? '↑' : joystick.elevator < 0 ? '↓' : '—'}</Text>
            </View>
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Yaw</Text>
              <Pressable onPress={() => adjustRudder(-0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>←</Text></Pressable>
              <View style={s.joystickBar}><View style={[s.joystickIndicator, { left: `${50 + joystick.rudder * 45}%` }]} /></View>
              <Pressable onPress={() => adjustRudder(0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>→</Text></Pressable>
              <Text style={s.controlValue}>{joystick.rudder > 0 ? '→' : joystick.rudder < 0 ? '←' : '—'}</Text>
            </View>
          </Panel>

          {/* Engineering events (with reset) */}
          {flying && (
            <Panel title="⚡ Engineering Events" subtitle="Trigger or reset events during flight.">
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pressable onPress={triggerEngineFailure} style={[s.eventBtn, engineFailed && s.eventBtnActive]} disabled={engineFailed}>
                  <Text style={s.eventBtnText}>🔴 Engine Failure</Text>
                </Pressable>
                <Pressable onPress={triggerIcing} style={[s.eventBtn]}>
                  <Text style={s.eventBtnText}>🧊 Ice</Text>
                </Pressable>
                <Pressable onPress={resetEvent} style={[s.eventBtn, { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: '#22C55E' }]}>
                  <Text style={[s.eventBtnText, { color: '#22C55E' }]}>🔄 Reset All</Text>
                </Pressable>
              </View>
            </Panel>
          )}

          <Panel title="Wing" subtitle="The most important part.">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
              {WING_OPTIONS.map(opt => (
                <OptionCardH key={opt.id} option={opt} active={wingChoice === opt.id} onPress={() => setWingChoice(opt.id)} />
              ))}
            </ScrollView>
          </Panel>

          <Panel title="Airfoil" subtitle="Cross-section of your wing.">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
              {AIRFOIL_OPTIONS.map(opt => (
                <OptionCardH key={opt.id} option={opt} active={airfoilChoice === opt.id} onPress={() => setAirfoilChoice(opt.id)} />
              ))}
            </ScrollView>
          </Panel>

          <Panel title="Tail" subtitle="Stability and control.">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
              {TAIL_OPTIONS.map(opt => (
                <OptionCardH key={opt.id} option={opt} active={tailChoice === opt.id} onPress={() => setTailChoice(opt.id)} />
              ))}
            </ScrollView>
          </Panel>

          <Panel title="Engine" subtitle="What powers your aircraft?">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
              {PROP_OPTIONS.map(opt => (
                <OptionCardH key={opt.id} option={opt} active={propChoice === opt.id} onPress={() => setPropChoice(opt.id)} />
              ))}
            </ScrollView>
          </Panel>

          <Panel title="Performance" tone="raised">
            <View style={s.resultGrid}>
              <ResultStat label="Max Speed" value={`${fmt(result.perf.cruiseSpeedMs * 3.6, 0)} km/h`} good={result.perf.cruiseSpeedMs > 100} />
              <ResultStat label="Range" value={`${fmt(result.perf.rangeKm, 0)} km`} good={result.perf.rangeKm >= 200} />
              <ResultStat label="L/D" value={`${fmt(result.perf.maxLd, 0)}:1`} good={result.perf.maxLd > 10} />
              <ResultStat label="Stall" value={`${fmt(result.stallSpeed, 0)} m/s`} good={result.stallSpeed < 35} />
              <ResultStat label="Climb" value={`${fmt(result.perf.climbRateMs, 1)} m/s`} good={result.perf.climbRateMs > 2} />
            </View>
          </Panel>

          <Panel title="💡 What did you learn?" tone="raised">
            <Text style={s.tipText}>
              {wingChoice === 'long' && 'Long, slender wings are like a glider — they cut through the air with less effort. That\'s why gliders have very long wings.'}
              {wingChoice === 'short' && 'Short wings make the aircraft fast but it needs more speed to stay in the air. Fighter jets have short wings.'}
              {wingChoice === 'wide' && 'Wide wings create lots of lift — perfect for carrying heavy cargo. But they create more drag too.'}
              {propChoice === 'turbofan' && 'Jet engines are fast but burn lots of fuel. That\'s why commercial jets fly at 35,000 feet — thinner air means less drag.'}
              {propChoice === 'electric' && 'Electric motors are efficient but batteries are heavy. This is the biggest challenge in electric aviation today.'}
              {tailChoice === 'canard' && 'A canard creates lift AND prevents the main wing from stalling. Many modern fighters use this.'}
              {tailChoice === 'none' && 'Flying wings have no tail — all lift comes from the wing itself. The most efficient shape, but hard to control without computers.'}
              {airfoilChoice === 'naca4412' && 'A curved airfoil creates more lift at low speeds — great for short runways. The downside is more drag at high speed.'}
              {airfoilChoice === 'naca0012' && 'A symmetric airfoil generates zero lift at zero angle of attack. Used on aerobatic planes.'}
              {activeEvent?.type === 'icing' && '🧊 Ice on wings destroys lift by changing the airfoil shape. De-icing systems are critical for safety.'}
              {activeEvent?.type === 'gust' && '💨 Gusts create sudden changes in angle of attack. A stable aircraft recovers naturally — design matters!'}
            </Text>
          </Panel>

          <Pressable onPress={() => setShowMissionBrowser(true)} style={s.backBtn}>
            <Text style={s.backBtnText}>← Back to Missions</Text>
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OptionCardH({ option, active, onPress }: { option: OptionCard; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { playClick(); onPress(); }} style={[s.optionCard, active && s.optionCardActive]}>
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
  viewport: { height: '38%', backgroundColor: '#6CB4EE', borderBottomWidth: 2, borderBottomColor: colors.borderStrong, position: 'relative' },
  canvas: { flex: 1 },
  topControls: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
  camBtn: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  camBtnActive: { backgroundColor: 'rgba(255,176,32,0.7)' },
  camBtnText: { color: '#CCC', fontSize: 12, fontWeight: '600' },
  camBtnTextActive: { color: '#000' },
  hud: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', gap: 6 },
  hudItem: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 8, alignItems: 'center' },
  hudLabel: { color: colors.textFaint, fontSize: 9 },
  hudValue: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  flightOverlay: { position: 'absolute', top: 8, left: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radius.sm, padding: 8 },
  hudRow: { flexDirection: 'row', gap: 4 },
  progressBar: { height: 4, backgroundColor: colors.surfaceHigh, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  panel: { flex: 1 },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  catLabel: { color: colors.textFaint, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.md, marginBottom: spacing.sm },
  missionCard: { flexDirection: 'row', backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, marginBottom: spacing.sm },
  missionIcon: { fontSize: 28, width: 40, textAlign: 'center' },
  missionName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  missionDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16, marginTop: 2 },
  missionMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  missionHeader: { backgroundColor: colors.backgroundAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  missionHeaderTitle: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  missionHeaderDesc: { color: colors.textFaint, fontSize: fontSize.sm, lineHeight: 18 },
  missionObjList: { marginTop: 6 },
  missionObjItem: { color: colors.textSubtle, fontSize: fontSize.xs, lineHeight: 18 },
  missionHint: { color: colors.accent, fontSize: fontSize.xs, fontStyle: 'italic', marginTop: 6 },
  flyButton: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  flyButtonDisabled: { opacity: 0.5 },
  flyButtonText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  horizontalScroll: { gap: spacing.sm },
  optionCard: { width: 150, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4, minHeight: 80 },
  optionCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  optionIcon: { fontSize: 20 },
  optionLabel: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  optionLabelActive: { color: colors.primary },
  optionTip: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 14, marginTop: 2 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  resultStat: { flexGrow: 1, flexBasis: '28%', backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: spacing.md, gap: 2, alignItems: 'center' },
  resultLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  resultValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  tipText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
  backBtn: { padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  backBtnText: { color: colors.accent, fontSize: fontSize.sm },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  controlLabel: { color: colors.textSubtle, fontSize: fontSize.sm, width: 50 },
  controlValue: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, width: 40, textAlign: 'right' },
  ctrlBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  ctrlBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  throttleBar: { flex: 1, height: 8, backgroundColor: colors.backgroundAlt, borderRadius: 4, overflow: 'hidden' },
  throttleFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
  joystickBar: { flex: 1, height: 8, backgroundColor: colors.backgroundAlt, borderRadius: 4, position: 'relative' },
  joystickIndicator: { position: 'absolute', top: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  eventBanner: { position: 'absolute', top: 50, left: 8, right: 8, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: radius.sm, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 4 },
  eventIcon: { fontSize: 24 },
  eventText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  eventSeverity: { color: colors.textFaint, fontSize: fontSize.xs },
  resultOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  resultCard: { backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.xl, width: '85%', alignItems: 'center', gap: 8 },
  resultGrade: { fontSize: 64, fontWeight: fontWeight.bold, color: colors.primary },
  resultTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  resultSub: { fontSize: fontSize.sm, color: colors.textFaint },
  resultObj: { fontSize: fontSize.sm, lineHeight: 22 },
  resultCloseBtn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  resultCloseBtnText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  eventBtn: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  eventBtnActive: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  eventBtnText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});

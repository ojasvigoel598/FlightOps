// Fun Mode — Complete 3D aircraft design game.
//
// Features:
//   A10: Interactive joystick/touch flight controls (throttle + elevator + rudder)
//   A11: Weather system (rain, wind streaks, storm clouds, turbulence)
//   A12: Mission events (engine failure, stall, icing, crosswind, wind shear)
//   A13: Cockpit camera view
//   A14: Scoring/ranking with grades (S/A/B/C/D/F)
//   A15: Environmental parallax (wind streaks, moving clouds during flight)
//   A16: Multiple fun-mode missions with objectives and mission browser

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
  defaultPropulsionConfig, defaultTailConfig, PropulsionType, TailConfig,
} from '@/services/aircraft-config';
import {
  FUN_MISSIONS, type FunMission, type MissionResult,
  computeMissionResult, evaluateObjective,
} from '@/services/fun-missions';
import {
  computeMissionRequirements, PRESET_MISSIONS, type MissionType,
} from '@/services/mission-design';

// ---------------------------------------------------------------------------
// Error boundary for3D Canvas (prevents blank screen if WebGL fails)
// ---------------------------------------------------------------------------

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err.message };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.warn('3D Canvas error:', err, info.componentStack);
  }
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
  cargo: 'cargo',
  surveillance: 'surveillance',
  'high-speed': 'high-speed',
  agricultural: 'agricultural',
};

type CameraMode = 'chase' | 'orbit' | 'side' | 'cockpit';

// ---------------------------------------------------------------------------
// Joystick state
// ---------------------------------------------------------------------------

interface JoystickState {
  throttle: number;   // 0-1
  elevator: number;   // -1 to 1 (pitch input)
  rudder: number;     // -1 to 1 (yaw input)
}

// ---------------------------------------------------------------------------
// Active mission event
// ---------------------------------------------------------------------------

interface ActiveEvent {
  type: string;
  description: string;
  severity: number;
  timeLeft: number;
  effect: {
    dragMultiplier: number;
    liftMultiplier: number;
    thrustMultiplier: number;
    integrityDamage: number;
  };
}

// ---------------------------------------------------------------------------
// 3D Scene
// ---------------------------------------------------------------------------

function AircraftScene({
  designParams, flying, flightProgress, cameraMode, propChoice,
  weather, activeEvent, joystick,
}: {
  designParams: ReturnType<typeof buildDesignParams>;
  flying: boolean;
  flightProgress: number;
  cameraMode: CameraMode;
  propChoice: string;
  weather: FunMission['environment'];
  activeEvent: ActiveEvent | null;
  joystick: JoystickState;
}) {
  const position: [number, number, number] = useMemo(() => {
    if (!flying) return [0, 1.2, 0];

    if (flightProgress < 0.15) {
      const t = flightProgress / 0.15;
      return [joystick.rudder * 3, 1.2, t * -30];
    }
    if (flightProgress < 0.4) {
      const t = (flightProgress - 0.15) / 0.25;
      const liftOff = Math.max(0, t - 0.4);
      return [joystick.rudder * 5, 1.2 + liftOff * 40, -30 - t * 80];
    }
    if (flightProgress < 0.7) {
      const t = (flightProgress - 0.4) / 0.3;
      return [joystick.rudder * 8, 20 + t * 20, -110 - t * 60];
    }
    const t = (flightProgress - 0.7) / 0.3;
    const windDrift = weather.windMs * 0.3 * Math.sin(t * Math.PI * 3);
    return [
      Math.sin(t * Math.PI * 2) * 30 + joystick.rudder * 15 + windDrift,
      40 + Math.sin(t * Math.PI) * 5 + joystick.elevator * 8,
      -170 - t * 100,
    ];
  }, [flying, flightProgress, joystick.elevator, joystick.rudder, weather.windMs]);

  const pitch = useMemo(() => {
    if (!flying) return 0;
    if (flightProgress < 0.15) return 0;
    if (flightProgress < 0.4) {
      const t = (flightProgress - 0.15) / 0.25;
      return Math.min(t * 0.4, 0.3) + joystick.elevator * 0.15;
    }
    if (flightProgress < 0.7) {
      const t = (flightProgress - 0.4) / 0.3;
      return 0.15 * (1 - t) + joystick.elevator * 0.1;
    }
    return joystick.elevator * 0.2;
  }, [flying, flightProgress, joystick.elevator]);

  const bank = useMemo(() => {
    if (!flying) return 0;
    if (flightProgress < 0.7) return joystick.rudder * 0.05;
    const t = (flightProgress - 0.7) / 0.3;
    return Math.sin(t * Math.PI * 2) * 0.2 + joystick.rudder * 0.3;
  }, [flying, flightProgress, joystick.rudder]);

  const flightSpeed = flying
    ? flightProgress < 0.15 ? joystick.throttle * 0.3
      : flightProgress < 0.4 ? 0.3 + joystick.throttle * 0.5
        : 0.5 + joystick.throttle * 0.5
    : 0;

  const throttle = flying ? joystick.throttle : 0;
  const isHighAlt = flying && flightProgress > 0.5;

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
  const icingActive = activeEvent?.type === 'icing';

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

      {/* Weather effects */}
      <Rain count={rainCount} intensity={weather.turbulence} />
      <WindStreaks windMs={weather.windMs} windDirDeg={weather.windDirDeg} active={showWind && flying} />
      <StormClouds visibility={weather.visibility} />

      <ChaseCamera
        target={position}
        pitch={pitch}
        bank={bank}
        flying={flying}
        mode={cameraMode}
      />

      {/* Aircraft with icing overlay */}
      <group position={position} rotation={[pitch, 0, bank]}>
        <AircraftModel design={{ ...designParams, flightSpeed, pitch: 0, bank: 0 }} />

        {/* Icing overlay */}
        {icingActive && activeEvent && (
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[designParams.spanM * 0.9, 0.06, 1.8]} />
            <meshStandardMaterial color="#B8D4E8" transparent opacity={0.15 + activeEvent.severity * 0.06} />
          </mesh>
        )}

        {/* Engine exhaust */}
        {enginePositions.map((pos, i) => (
          <EngineExhaust key={`ex-${i}`} position={pos} throttle={throttle} direction={[0, 0.05, -1]} />
        ))}

        {/* Wingtip contrails at high altitude */}
        {isHighAlt && (
          <>
            <WingtipContrail position={[designParams.spanM / 2, 0, 0.5]} active={isHighAlt} speed={flightSpeed * 250} />
            <WingtipContrail position={[-designParams.spanM / 2, 0, 0.5]} active={isHighAlt} speed={flightSpeed * 250} />
          </>
        )}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fmt(n: number, d = 1): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
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

  // Joystick state (A10)
  const [joystick, setJoystick] = useState<JoystickState>({ throttle: 0.5, elevator: 0, rudder: 0 });

  // Flight state
  const [flying, setFlying] = useState(false);
  const [flightProgress, setFlightProgress] = useState(0);
  const [flightTime, setFlightTime] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [fuelUsed, setFuelUsed] = useState(0);
  const [integrity, setIntegrity] = useState(100);
  const flightRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active mission event (A12)
  const [activeEvent, setActiveEvent] = useState<ActiveEvent | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);

  // Mission result (A14)
  const [missionResult, setMissionResult] = useState<MissionResult | null>(null);

  // Mission browser visibility
  const [showMissionBrowser, setShowMissionBrowser] = useState(true);

  const selectedMission = selectedMissionId ? FUN_MISSIONS.find(m => m.id === selectedMissionId) : null;

  // Computed performance
  const result = useMemo(() => {
    const wingPreset = WING_PRESETS[wingChoice] || WING_PRESETS.medium;
    const propPreset = PROP_PRESETS[propChoice] || PROP_PRESETS.turboprop;
    const missionType = MISSION_PRESETS.trainer;
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
    const feasible = perf.rangeKm >= mission.rangeKm;

    return { perf, feasible, mission, requirements, stallSpeed: perf.stallSpeedMs };
  }, [wingChoice, tailChoice, propChoice, airfoilChoice]);

  const designParams = useMemo(() => {
    return buildDesignParams({
      wingId: wingChoice, tailId: tailChoice, airfoilId: airfoilChoice,
      engineId: propChoice, engineCount: PROP_PRESETS[propChoice]?.count ?? 1,
      flightSpeed: flying ? 1 : 0, pitch: 0, bank: 0,
    });
  }, [wingChoice, tailChoice, propChoice, airfoilChoice, flying]);

  // Start flight
  const startFlight = useCallback(() => {
    if (flying || !selectedMission) return;
    setFlying(true);
    setFlightProgress(0);
    setFlightTime(0);
    setMaxSpeed(0);
    setDistance(0);
    setAltitude(0);
    setFuelUsed(0);
    setIntegrity(100);
    setActiveEvent(null);
    setEventLog([]);
    setMissionResult(null);
    setShowMissionBrowser(false);

    const cruiseSpeed = result.perf.cruiseSpeedMs;
    let progress = 0;

    flightRef.current = setInterval(() => {
      progress += 0.005;
      setFlightProgress(progress);
      setFlightTime(prev => prev + 0.03);

      // Compute flight stats
      const currentSpeed = cruiseSpeed * joystick.throttle * (progress < 0.15 ? 0.3 : progress < 0.4 ? 0.6 : 1);
      const currentAlt = progress < 0.15 ? 0 : progress < 0.4 ? (progress - 0.15) / 0.25 * 500 : 500 + (progress - 0.4) / 0.3 * 3000;
      const currentDist = distance + currentSpeed * 0.03 / 1000;

      setMaxSpeed(prev => Math.max(prev, currentSpeed));
      setAltitude(currentAlt);
      setDistance(currentDist);
      setFuelUsed(prev => prev + 0.1 * joystick.throttle);

      // Check for weather events
      if (selectedMission.environment.events.length > 0) {
        for (const evt of selectedMission.environment.events) {
          if (Math.abs(progress - evt.triggerProgress) < 0.01 && !eventLog.includes(evt.description)) {
            setActiveEvent({
              type: evt.type,
              description: evt.description,
              severity: evt.severity,
              timeLeft: evt.durationS,
              effect: getEventEffect(evt.type, evt.severity),
            });
            setEventLog(prev => [...prev, evt.description]);
          }
        }
      }

      // Process active event effects
      setActiveEvent(prev => {
        if (!prev) return null;
        const newTime = prev.timeLeft - 0.03;
        if (newTime <= 0) return null;

        // Apply integrity damage
        setIntegrity(i => Math.max(0, i - prev.effect.integrityDamage * 0.03));
        setFuelUsed(f => f + prev.effect.dragMultiplier * 0.05);

        return { ...prev, timeLeft: newTime };
      });

      // Check for auto-failures
      if (integrity <= 0 || fuelUsed > 100) {
        clearInterval(flightRef.current!);
        flightRef.current = null;
        finishFlight(false);
      }

      if (progress >= 1) {
        progress = 1;
        clearInterval(flightRef.current!);
        flightRef.current = null;
        setTimeout(() => finishFlight(true), 1000);
      }
    }, 30);
  }, [flying, selectedMission, result, joystick.throttle, integrity, fuelUsed, distance, eventLog]);

  const finishFlight = useCallback((completed: boolean) => {
    const stats: Record<string, number> = {
      altitude,
      distance,
      maxSpeed,
      flightTime,
      fuelUsedKg: fuelUsed,
      fuelRemainingPct: Math.max(0, 100 - fuelUsed),
      landed: completed && integrity > 0 ? 1 : 0,
      integrity,
      cruiseSpeed: result.perf.cruiseSpeedMs * joystick.throttle,
      takeoffDist: 400,
      maxG: 1 + Math.abs(joystick.elevator) * 3,
    };

    if (selectedMission) {
      const res = computeMissionResult(selectedMission, stats);
      setMissionResult(res);
    }

    setTimeout(() => {
      setFlying(false);
      setFlightProgress(0);
      setActiveEvent(null);
    }, 2000);
  }, [altitude, distance, maxSpeed, flightTime, fuelUsed, integrity, result, joystick, selectedMission]);

  useEffect(() => {
    return () => { if (flightRef.current) clearInterval(flightRef.current); };
  }, []);

  // Joystick input handlers (A10)
  const adjustThrottle = (delta: number) => {
    setJoystick(j => ({ ...j, throttle: Math.max(0, Math.min(1, j.throttle + delta)) }));
  };
  const adjustElevator = (delta: number) => {
    setJoystick(j => ({ ...j, elevator: Math.max(-1, Math.min(1, j.elevator + delta)) }));
  };
  const adjustRudder = (delta: number) => {
    setJoystick(j => ({ ...j, rudder: Math.max(-1, Math.min(1, j.rudder + delta)) }));
  };

  return (
    <View style={s.container}>
      {/* Mission result overlay (A14) */}
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
            {selectedMission?.objectives.map((obj, i) => {
              const met = evaluateObjective(obj, {
                altitude, distance, maxSpeed, flightTime, fuelUsedKg: fuelUsed,
                fuelRemainingPct: Math.max(0, 100 - fuelUsed), landed: missionResult.completed ? 1 : 0,
                integrity, cruiseSpeed: result.perf.cruiseSpeedMs, takeoffDist: 400, maxG: 1 + Math.abs(joystick.elevator) * 3,
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

      {/* Event notification (A12) */}
      {activeEvent && (
        <View style={[s.eventBanner, { borderLeftColor: activeEvent.severity >= 4 ? '#EF4444' : activeEvent.severity >= 2 ? '#F59E0B' : '#3B82F6' }]}>
          <Text style={s.eventIcon}>
            {activeEvent.type === 'gust' ? '💨' : activeEvent.type === 'icing' ? '🧊' :
             activeEvent.type === 'crosswind' ? '🌪️' : activeEvent.type === 'wind_shear' ? '⚠️' : '⛈️'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={s.eventText}>{activeEvent.description}</Text>
            <Text style={s.eventSeverity}>Severity {activeEvent.severity}/5</Text>
          </View>
        </View>
      )}

      {/* 3D Viewport */}
      <View style={s.viewport}>
        <CanvasErrorBoundary>
        <Canvas camera={{ position: [0, 12, 25], fov: 50 }} style={s.canvas} gl={{ antialias: true, alpha: false }} onCreated={({ gl }) => { gl.setClearColor('#6CB4EE'); }}>
          <AircraftScene
            designParams={designParams}
            flying={flying}
            flightProgress={flightProgress}
            cameraMode={cameraMode}
            propChoice={propChoice}
            weather={selectedMission?.environment ?? { windMs: 3, windDirDeg: 270, visibility: 1, turbulence: 0.1, tempDeviationC: 0, events: [] }}
            activeEvent={activeEvent}
            joystick={joystick}
          />
        </Canvas>
        </CanvasErrorBoundary>

        {/* Camera mode toggle (A13) */}
        <View style={s.cameraToggle}>
          {(['chase', 'orbit', 'side', 'cockpit'] as CameraMode[]).map((m) => (
            <Pressable key={m} onPress={() => setCameraMode(m)} style={[s.camBtn, cameraMode === m && s.camBtnActive]}>
              <Text style={[s.camBtnText, cameraMode === m && s.camBtnTextActive]}>
                {m === 'chase' ? '📹' : m === 'orbit' ? '🔄' : m === 'cockpit' ? '🎮' : '🎬'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Flight HUD */}
        {flying && (
          <View style={s.flightOverlay}>
            <View style={s.hudRow}>
              <View style={s.hudItem}><Text style={s.hudLabel}>SPD</Text><Text style={s.hudValue}>{fmt(maxSpeed * 3.6, 0)} km/h</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>ALT</Text><Text style={s.hudValue}>{fmt(altitude, 0)} m</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>DST</Text><Text style={s.hudValue}>{fmt(distance, 1)} km</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>FUEL</Text><Text style={s.hudValue}>{fmt(Math.max(0, 100 - fuelUsed), 0)}%</Text></View>
              <View style={s.hudItem}><Text style={s.hudLabel}>AC</Text><Text style={s.hudValue}>{fmt(integrity, 0)}%</Text></View>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${flightProgress * 100}%` }]} />
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
        /* Mission browser (A16) */
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          <Text style={s.sectionTitle}>🎯 Select a Mission</Text>
          {(['training', 'commercial', 'military', 'challenge'] as const).map(cat => {
            const missions = FUN_MISSIONS.filter(m => m.category === cat);
            if (missions.length === 0) return null;
            return (
              <View key={cat}>
                <Text style={s.catLabel}>{cat.toUpperCase()}</Text>
                {missions.map(m => (
                  <Pressable key={m.id} style={s.missionCard} onPress={() => { setSelectedMissionId(m.id); setShowMissionBrowser(false); }}>
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
        /* Design + Controls panel */
        <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>
          {/* Mission info header */}
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

          {/* Launch button */}
          <Pressable
            onPress={startFlight}
            style={[s.flyButton, flying && s.flyButtonDisabled]}
            disabled={flying}
          >
            <Text style={s.flyButtonText}>
              {flying ? '✈️ Flying...' : '🛫 Launch Flight Test'}
            </Text>
          </Pressable>

          {/* Joystick controls (A10) */}
          <Panel title="🎮 Flight Controls" subtitle="Adjust throttle, pitch, and yaw.">
            {/* Throttle */}
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Throttle</Text>
              <Pressable onPress={() => adjustThrottle(-0.1)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>−</Text></Pressable>
              <View style={s.throttleBar}>
                <View style={[s.throttleFill, { width: `${joystick.throttle * 100}%` }]} />
              </View>
              <Pressable onPress={() => adjustThrottle(0.1)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>+</Text></Pressable>
              <Text style={s.controlValue}>{fmt(joystick.throttle * 100, 0)}%</Text>
            </View>
            {/* Elevator */}
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Pitch</Text>
              <Pressable onPress={() => adjustElevator(-0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>↓</Text></Pressable>
              <View style={s.joystickBar}>
                <View style={[s.joystickIndicator, { left: `${50 + joystick.elevator * 45}%` }]} />
              </View>
              <Pressable onPress={() => adjustElevator(0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>↑</Text></Pressable>
              <Text style={s.controlValue}>{joystick.elevator > 0 ? '↑' : joystick.elevator < 0 ? '↓' : '—'}</Text>
            </View>
            {/* Rudder */}
            <View style={s.controlRow}>
              <Text style={s.controlLabel}>Yaw</Text>
              <Pressable onPress={() => adjustRudder(-0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>←</Text></Pressable>
              <View style={s.joystickBar}>
                <View style={[s.joystickIndicator, { left: `${50 + joystick.rudder * 45}%` }]} />
              </View>
              <Pressable onPress={() => adjustRudder(0.2)} style={s.ctrlBtn}><Text style={s.ctrlBtnText}>→</Text></Pressable>
              <Text style={s.controlValue}>{joystick.rudder > 0 ? '→' : joystick.rudder < 0 ? '←' : '—'}</Text>
            </View>
          </Panel>

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

          {/* Back to missions */}
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
// Event effect calculator
// ---------------------------------------------------------------------------

function getEventEffect(type: string, severity: number) {
  const s = severity;
  switch (type) {
    case 'gust':
      return { dragMultiplier: 1 + s * 0.1, liftMultiplier: 1 - s * 0.05, thrustMultiplier: 1, integrityDamage: s * 0.3 };
    case 'crosswind':
      return { dragMultiplier: 1 + s * 0.15, liftMultiplier: 1, thrustMultiplier: 1, integrityDamage: s * 0.2 };
    case 'icing':
      return { dragMultiplier: 1 + s * 0.2, liftMultiplier: 1 - s * 0.1, thrustMultiplier: 1 - s * 0.03, integrityDamage: s * 0.5 };
    case 'wind_shear':
      return { dragMultiplier: 1 + s * 0.25, liftMultiplier: 1 - s * 0.15, thrustMultiplier: 1, integrityDamage: s * 0.4 };
    case 'thunderstorm':
      return { dragMultiplier: 1 + s * 0.3, liftMultiplier: 1 - s * 0.1, thrustMultiplier: 1 - s * 0.05, integrityDamage: s * 0.8 };
    default:
      return { dragMultiplier: 1, liftMultiplier: 1, thrustMultiplier: 1, integrityDamage: 0 };
  }
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
  viewport: { height: '38%', backgroundColor: '#6CB4EE', borderBottomWidth: 2, borderBottomColor: colors.borderStrong, position: 'relative' },
  canvas: { flex: 1 },
  cameraToggle: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
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
  // Joystick controls
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  controlLabel: { color: colors.textSubtle, fontSize: fontSize.sm, width: 50 },
  controlValue: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, width: 40, textAlign: 'right' },
  ctrlBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  ctrlBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  throttleBar: { flex: 1, height: 8, backgroundColor: colors.backgroundAlt, borderRadius: 4, overflow: 'hidden' },
  throttleFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
  joystickBar: { flex: 1, height: 8, backgroundColor: colors.backgroundAlt, borderRadius: 4, position: 'relative' },
  joystickIndicator: { position: 'absolute', top: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  // Mission events
  eventBanner: { position: 'absolute', top: 50, left: 8, right: 8, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: radius.sm, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 4 },
  eventIcon: { fontSize: 24 },
  eventText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  eventSeverity: { color: colors.textFaint, fontSize: fontSize.xs },
  // Mission result overlay
  resultOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  resultCard: { backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.xl, width: '85%', alignItems: 'center', gap: 8 },
  resultGrade: { fontSize: 64, fontWeight: fontWeight.bold, color: colors.primary },
  resultTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  resultSub: { fontSize: fontSize.sm, color: colors.textFaint },
  resultObj: { fontSize: fontSize.sm, lineHeight: 22 },
  resultCloseBtn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  resultCloseBtnText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

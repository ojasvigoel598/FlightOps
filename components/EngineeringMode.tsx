// Engineering Mode — Sadraey-style aircraft design learning (complete).
//
// B16: Interactive chapter-by-chapter navigation UI (Ch1→Ch12)
// B17: Mission evaluation engine — checks design against requirements
// B18: Engineering notebook — auto-records decisions, predictions, outcomes
// B19: Rank progression UI — shows current rank and next milestone
// B20: Force vector visualization on 3D aircraft (lift/drag/thrust/weight)
// B21: Disturbance experiments — gust, crosswind, engine failure in 3D
// B22: Progressive 3DOF→6DOF teaching transitions
// B23: Roll/pitch/yaw visual teaching + control surface animation
// B24: CG visualization — CG and neutral point markers on aircraft
// B25: Adaptive difficulty — harder missions for fast learners

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@react-three/fiber';

import { Badge, Panel } from '@/components';
import AircraftModel, { buildDesignParams } from '@/components/three/AircraftModel';
import CGMarker from '@/components/three/CGMarker';
import ChaseCamera from '@/components/three/ChaseCamera';
import ForceVectors from '@/components/three/ForceVectors';
import {
  Clouds, Hangar, Mountains, Ocean, Runway, RunwayLights,
  Sky, Terrain,
} from '@/components/three/World';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  computeMassBreakdown, computePerformance, defaultFuselageConfig,
  defaultPropulsionConfig, defaultTailConfig, PropulsionType, TailConfig,
  type WingConfig,
} from '@/services/aircraft-config';
import {
  CHAPTERS, RANKS, getRank, createInitialProgress, completeMission,
  type Chapter, type StudentProgress,
} from '@/services/model-b/chapters';
import {
  evaluateMission, type AircraftMetrics, type EvaluationResult,
} from '@/services/model-b/chapter-evaluation';
import {
  addNotebookEntry, getNotebookEntries, getNotebookStats,
  generateRichInsight, type NotebookEntry, type DesignChange,
} from '@/services/model-b/engineering-notebook';
import {
  computeMissionRequirements, PRESET_MISSIONS, type MissionType,
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
  { id: 'trainer', name: 'Single-Engine Trainer', category: 'General Aviation', description: 'Cessna 172-style. Conventional tail, high wing, piston engine.', wing: { spanM: 11, areaM2: 16.2, taperRatio: 0.7, sweepDeg: 0, airfoilId: 'naca2412' }, tail: { configuration: 'conventional' }, propType: 'piston', engineCount: 1, powerKw: 120 },
  { id: 'regional', name: 'Regional Turboprop', category: 'Commercial', description: 'Dash 8 / ATR 72-style. T-tail, twin turboprop.', wing: { spanM: 28, areaM2: 61, taperRatio: 0.5, sweepDeg: 3, airfoilId: 'naca2412' }, tail: { configuration: 't-tail' }, propType: 'turboprop', engineCount: 2, powerKw: 2000 },
  { id: 'jetliner', name: 'Narrowbody Jetliner', category: 'Commercial', description: 'A320/737-style. Turbofan engines, swept wing.', wing: { spanM: 35, areaM2: 122, taperRatio: 0.3, sweepDeg: 25, airfoilId: 'naca2412' }, tail: { configuration: 'conventional' }, propType: 'turbofan', engineCount: 2, powerKw: 0 },
  { id: 'fighter', name: 'Fighter Jet', category: 'Military', description: 'F-16-style. Delta-ish wing, turbofan. Speed and manoeuvre.', wing: { spanM: 10, areaM2: 28, taperRatio: 0.2, sweepDeg: 40, airfoilId: 'naca0012' }, tail: { configuration: 'conventional' }, propType: 'turbofan', engineCount: 1, powerKw: 0 },
  { id: 'uav', name: 'Surveillance UAV', category: 'Unmanned', description: 'MQ-9 Reaper-style. Long slender wings, v-tail.', wing: { spanM: 20, areaM2: 24, taperRatio: 0.4, sweepDeg: 0, airfoilId: 'naca2412' }, tail: { configuration: 'v-tail' }, propType: 'turboprop', engineCount: 1, powerKw: 600 },
  { id: 'flying-wing', name: 'Flying Wing', category: 'Experimental', description: 'B-2-style. No tail, blended body. Maximum efficiency.', wing: { spanM: 50, areaM2: 300, taperRatio: 0.15, sweepDeg: 33, airfoilId: 'naca0012' }, tail: { configuration: 'none' }, propType: 'turbofan', engineCount: 4, powerKw: 0 },
  { id: 'canard', name: 'Canard Fighter', category: 'Military', description: 'Eurofighter/Rafale-style. Canard foreplane, delta wing.', wing: { spanM: 11, areaM2: 50, taperRatio: 0.15, sweepDeg: 50, airfoilId: 'naca0006' }, tail: { configuration: 'canard' }, propType: 'turbofan', engineCount: 2, powerKw: 0 },
];

// ---------------------------------------------------------------------------
// 3D Scene for Engineering Mode — with forces and CG
// ---------------------------------------------------------------------------

function DesignScene({
  designParams, showForces, forces, showCG, cgFraction, npFraction,
  disturbActive, disturbType,
}: {
  designParams: ReturnType<typeof buildDesignParams>;
  showForces: boolean;
  forces: { lift: number; drag: number; thrust: number; weight: number };
  showCG: boolean;
  cgFraction: number;
  npFraction: number;
  disturbActive: boolean;
  disturbType: string;
}) {
  const disturbPos: [number, number, number] = disturbActive
    ? disturbType === 'gust' ? [0, 5, -10] : disturbType === 'crosswind' ? [15, 3, 0] : [0, 0, -5]
    : [0, 0, 0];

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

        {/* Force vectors (B20) */}
        <ForceVectors
          position={[0, 0, 0]}
          liftN={forces.lift}
          dragN={forces.drag}
          thrustN={forces.thrust}
          weightN={forces.weight}
          visible={showForces}
        />

        {/* CG + Neutral Point markers (B24) */}
        <CGMarker
          cgFraction={cgFraction}
          neutralPointFraction={npFraction}
          fuselageLength={6}
          visible={showCG}
        />
      </group>

      {/* Disturbance visual (B21) */}
      {disturbActive && (
        <group position={disturbPos}>
          {disturbType === 'gust' && (
            <mesh>
              <sphereGeometry args={[3, 8, 6]} />
              <meshStandardMaterial color="#FFD700" transparent opacity={0.2} wireframe />
            </mesh>
          )}
          {disturbType === 'crosswind' && (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <mesh key={i} position={[(i - 4) * 3, 2, 0]}>
                  <coneGeometry args={[0.3, 1.5, 4]} />
                  <meshBasicMaterial color="#60A5FA" transparent opacity={0.3} />
                </mesh>
              ))}
            </>
          )}
          {disturbType === 'engine-failure' && (
            <mesh position={[0, -1, 0]}>
              <sphereGeometry args={[1.5, 8, 6]} />
              <meshStandardMaterial color="#EF4444" transparent opacity={0.3} wireframe />
            </mesh>
          )}
        </group>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Param input
// ---------------------------------------------------------------------------

function ParamInput({ label, value, unit, onChangeText, min, max, step }: {
  label: string; value: number; unit: string; onChangeText: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  return (
    <View style={s.paramRow}>
      <Text style={s.paramLabel}>{label}</Text>
      <View style={s.paramControls}>
        <Pressable onPress={() => onChangeText(Math.max(min ?? 0, value - (step ?? 1)))} style={s.paramBtn}>
          <Text style={s.paramBtnText}>−</Text>
        </Pressable>
        <Text style={s.paramValue}>{fmt(value, 0)} {unit}</Text>
        <Pressable onPress={() => onChangeText(Math.min(max ?? 9999, value + (step ?? 1)))} style={s.paramBtn}>
          <Text style={s.paramBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Prediction card
// ---------------------------------------------------------------------------

function PredictionCard({ question, options, correctIndex, answered, selectedIndex, onSelect }: {
  question: string; options: string[]; correctIndex: number;
  answered: boolean; selectedIndex: number | null; onSelect: (i: number) => void;
}) {
  return (
    <View style={s.predCard}>
      <Text style={s.predQuestion}>🔮 {question}</Text>
      {options.map((opt, i) => {
        const isCorrect = i === correctIndex;
        const isSelected = i === selectedIndex;
        return (
          <Pressable key={i} onPress={() => !answered && onSelect(i)}
            style={[s.predOption, answered && isCorrect && s.predOptionCorrect, answered && isSelected && !isCorrect && s.predOptionWrong]}>
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
  // Chapter navigation state (B16)
  const [activeChapter, setActiveChapter] = useState(1);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);

  // Student progress
  const [progress, setProgress] = useState<StudentProgress>(createInitialProgress);

  // Aircraft config
  const [preset, setPreset] = useState('trainer');
  const [missionType, setMissionType] = useState<MissionType>('trainer');

  // Custom params
  const [customSpan, setCustomSpan] = useState<number | null>(null);
  const [customArea, setCustomArea] = useState<number | null>(null);
  const [customSweep, setCustomSweep] = useState<number | null>(null);

  // Visualization toggles
  const [showForces, setShowForces] = useState(false);
  const [showCG, setShowCG] = useState(false);
  const [showNotebook, setShowNotebook] = useState(false);

  // Prediction state
  const [predAnswered, setPredAnswered] = useState(false);
  const [predSelected, setPredSelected] = useState<number | null>(null);

  // Disturbance experiment (B21)
  const [disturbActive, setDisturbActive] = useState(false);
  const [disturbType, setDisturbType] = useState<string>('gust');

  // Evaluation result
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);

  // Teaching level (B22: progressive 3DOF→6DOF)
  const [teachingLevel, setTeachingLevel] = useState(1);

  const chapter = CHAPTERS.find(c => c.id === activeChapter) || CHAPTERS[0];
  const activeMission = activeMissionId ? chapter.missions.find(m => m.id === activeMissionId) : chapter.missions[0];

  const p = AIRCRAFT_PRESETS.find(x => x.id === preset) || AIRCRAFT_PRESETS[0];

  // Performance computation
  const result = useMemo(() => {
    const wing: WingConfig = {
      spanM: customSpan ?? (p.wing.spanM ?? 10),
      areaM2: customArea ?? (p.wing.areaM2 ?? 16),
      taperRatio: p.wing.taperRatio ?? 0.6,
      sweepDeg: customSweep ?? (p.wing.sweepDeg ?? 2),
      dihedralDeg: 3, incidenceDeg: 2, washoutDeg: -2,
      airfoilId: p.wing.airfoilId ?? 'naca2412',
      flapType: 'slotted', flapSegments: 2,
    };
    const tail: TailConfig = { ...defaultTailConfig(), ...(p.tail || {}) };
    const prop = {
      ...defaultPropulsionConfig(), type: p.propType, count: p.engineCount,
      powerW: p.powerKw * 1000, engineMassKg: p.propType === 'turbofan' ? 2000 : 120,
      propDiameterM: p.propType === 'turbofan' ? 0 : 2.5,
      propEfficiency: p.propType === 'turbofan' ? 0.85 : 0.82,
      sfc: p.propType === 'turbofan' ? 0.06 / 3600 : 0.55 / 3600,
    };
    const mission = PRESET_MISSIONS[missionType];
    const requirements = computeMissionRequirements(mission);
    const mass = computeMassBreakdown(wing, tail, defaultFuselageConfig(), prop, mission.payloadKg, requirements.fuelMassKg);
    const config = { name: p.name, wing, tail, fuselage: defaultFuselageConfig(), propulsion: prop, mass };
    const perf = computePerformance(config);

    return { perf, config, mass, requirements, mission, preset: p, feasible: perf.rangeKm >= mission.rangeKm };
  }, [preset, missionType, customSpan, customArea, customSweep]);

  // 3D design params
  const designParams = useMemo(() => {
    return buildDesignParams({
      wingId: customSpan != null ? 'medium' : (result.config.wing.spanM > 15 ? 'long' : result.config.wing.spanM < 9 ? 'short' : 'medium'),
      tailId: (result.config.tail?.configuration as string) || 'conventional',
      airfoilId: result.config.wing.airfoilId || 'naca2412',
      engineId: p.propType === 'turbofan' ? 'powerful' : p.propType === 'piston' ? 'efficient' : 'turboprop',
      engineCount: p.engineCount, flightSpeed: 0, pitch: 0, bank: 0,
    });
  }, [p, result.config, customSpan]);

  // Forces for visualization (B20)
  const forces = useMemo(() => {
    const w = result.mass.mtomKg * 9.81;
    const ld = result.perf.maxLd;
    const cd0 = result.perf.cd0;
    const v = result.perf.cruiseSpeedMs;
    const q = 0.5 * 1.225 * v * v;
    const s = result.config.wing.areaM2;
    const cl = w / (q * s);
    const cd = cd0 + (cl * cl) / (Math.PI * result.perf.aspectRatio * 0.85);
    const lift = q * s * cl;
    const drag = q * s * cd;
    const thrust = result.perf.cruiseSpeedMs > 0 ? (result.config.propulsion.powerW * result.config.propulsion.count * 0.82) / result.perf.cruiseSpeedMs : 0;
    return { lift, drag, thrust, weight: w };
  }, [result]);

  // CG and neutral point (B24)
  const cgFraction = 0.28;
  const npFraction = 0.35;

  // Rank info (B19)
  const currentRank = getRank(progress.credits);
  const nextRank = RANKS.find(r => r.minCredits > progress.credits);
  const rankProgress = nextRank ? (progress.credits / nextRank.minCredits) * 100 : 100;

  // Prediction questions
  const prediction = useMemo(() => {
    if (activeChapter === 5) {
      return { question: 'If you increase sweep from 20° to 45°, what happens?', options: ['Higher top speed but worse low-speed handling', 'Better low-speed lift', 'No meaningful change', 'Aircraft becomes lighter'], correctIndex: 0 };
    }
    if (activeChapter === 6) {
      return { question: 'What does static margin measure?', options: ['Distance between CG and neutral point — longitudinal stability', 'Maximum speed the aircraft can reach', 'Fuel efficiency at cruise', 'Maximum weight the wing can carry'], correctIndex: 0 };
    }
    return { question: 'If you double the wing area while keeping weight the same, what happens to wing loading?', options: ['Wing loading halves — lower stall speed', 'Wing loading doubles', 'Nothing changes', 'The aircraft becomes faster'], correctIndex: 0 };
  }, [activeChapter]);

  // Evaluate mission (B17)
  const runEvaluation = useCallback(() => {
    if (!activeMission) return;

    const metrics: AircraftMetrics = {
      rangeKm: result.perf.rangeKm,
      mtowKg: result.mass.mtomKg,
      stallSpeedMs: result.perf.stallSpeedMs,
      cruiseSpeedMs: result.perf.cruiseSpeedMs,
      climbRateMs: result.perf.climbRateMs,
      takeoffDistanceM: result.perf.takeoffDistanceM,
      landingSpeedMs: result.perf.stallSpeedMs * 1.1,
      maxLd: result.perf.maxLd,
      staticMargin: result.perf.staticMargin,
      aspectRatio: result.perf.aspectRatio,
      wingLoading: result.perf.wingLoading,
      payloadKg: result.mass.payloadKg,
      fuelKg: result.mass.fuelKg,
      emptyMassKg: result.mass.emptyMassKg,
    };

    const eval_ = evaluateMission(metrics, activeMission.requirements, activeMission.difficulty * 100);
    setEvalResult(eval_);

    // Record notebook entry (B18)
    if (customSpan !== null || customArea !== null || customSweep !== null) {
      const change: DesignChange = {
        parameter: customSpan !== null ? 'spanM' : customArea !== null ? 'areaM2' : 'sweepDeg',
        oldValue: customSpan !== null ? (p.wing.spanM ?? 10) : customArea !== null ? (p.wing.areaM2 ?? 16) : (p.wing.sweepDeg ?? 2),
        newValue: customSpan ?? customArea ?? customSweep ?? 0,
        unit: customSpan !== null ? 'm' : customArea !== null ? 'm²' : '°',
        direction: (customSpan ?? customArea ?? customSweep ?? 0) > (p.wing.spanM ?? 10) ? 'increased' : 'decreased',
      };

      addNotebookEntry({
        timestamp: Date.now(),
        chapterId: activeChapter,
        missionName: activeMission.name,
        change,
        prediction: predAnswered ? prediction.question : '',
        predictionCorrect: predSelected === prediction.correctIndex,
        actualResult: eval_.summary,
        lesson: eval_.suggestions.join(' '),
      });
    }

    // Update progress if passed
    if (eval_.passed) {
      const newProgress = completeMission(progress, activeChapter, activeMission.id, eval_.creditsEarned, predSelected === prediction.correctIndex);
      setProgress(newProgress);
    }
  }, [activeMission, result, customSpan, customArea, customSweep, p, activeChapter, predAnswered, predSelected, prediction, progress]);

  return (
    <View style={s.container}>
      {/* 3D Viewport */}
      <View style={s.viewport}>
        <Canvas camera={{ position: [0, 8, 20], fov: 45 }} style={s.canvas} gl={{ antialias: true, alpha: false }}>
          <DesignScene
            designParams={designParams}
            showForces={showForces}
            forces={forces}
            showCG={showCG}
            cgFraction={cgFraction}
            npFraction={npFraction}
            disturbActive={disturbActive}
            disturbType={disturbType}
          />
        </Canvas>
        <View style={s.viewportLabel}>
          <Text style={s.viewportLabelText}>📐 {p.name} — Live 3D Preview</Text>
        </View>
        {/* Toggle buttons */}
        <View style={s.toggleRow}>
          <Pressable onPress={() => setShowForces(!showForces)} style={[s.toggleBtn, showForces && s.toggleBtnActive]}>
            <Text style={[s.toggleBtnText, showForces && s.toggleBtnTextActive]}>forces</Text>
          </Pressable>
          <Pressable onPress={() => setShowCG(!showCG)} style={[s.toggleBtn, showCG && s.toggleBtnActive]}>
            <Text style={[s.toggleBtnText, showCG && s.toggleBtnTextActive]}>CG</Text>
          </Pressable>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent}>

        {/* B16: Chapter navigation */}
        <Panel title="📖 Chapters" subtitle="Navigate Sadraey's aircraft design progression.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {CHAPTERS.map(ch => {
              const unlocked = !ch.unlockCriteria || ch.id <= activeChapter;
              return (
                <Pressable key={ch.id} onPress={() => { if (unlocked) { setActiveChapter(ch.id); setActiveMissionId(null); setEvalResult(null); } }}
                  style={[s.chapterCard, activeChapter === ch.id && s.chapterCardActive, !unlocked && s.chapterCardLocked]}>
                  <Text style={[s.chapterNum, activeChapter === ch.id && s.chapterNumActive]}>{ch.id}</Text>
                  <Text style={[s.chapterTitle, !unlocked && { opacity: 0.4 }]} numberOfLines={2}>{ch.title}</Text>
                  {!unlocked && <Text style={s.lockIcon}>🔒</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </Panel>

        {/* Current chapter info */}
        <Panel title={`${chapter.title}`} subtitle={chapter.subtitle}>
          <Text style={s.chapterDesc}>{chapter.description}</Text>
          <Text style={s.sadraeyRef}>{chapter.sadraeyRef}</Text>
          <View style={s.objList}>
            {chapter.objectives.map((obj, i) => (
              <Text key={i} style={s.objItem}>• {obj}</Text>
            ))}
          </View>
        </Panel>

        {/* B19: Rank progression */}
        <Panel title="🏆 Rank Progression" subtitle={`${currentRank} — ${progress.credits} credits`}>
          <View style={s.rankBar}>
            <View style={[s.rankFill, { width: `${Math.min(100, rankProgress)}%` }]} />
          </View>
          {nextRank && (
            <Text style={s.rankNext}>Next: {nextRank.title} ({nextRank.minCredits} credits)</Text>
          )}
          <View style={s.rankRow}>
            <Text style={s.rankStat}>✅ {progress.completedMissions.size} missions</Text>
            <Text style={s.rankStat}>🎯 {progress.correctPredictions}/{progress.totalPredictions} predictions</Text>
          </View>
        </Panel>

        {/* Missions for this chapter */}
        <Panel title="🎯 Missions" subtitle={`Chapter ${activeChapter} missions`}>
          {chapter.missions.map(m => (
            <Pressable key={m.id} style={[s.missionItem, activeMissionId === m.id && s.missionItemActive]}
              onPress={() => { setActiveMissionId(m.id); setEvalResult(null); }}>
              <Text style={s.missionName}>{m.name}</Text>
              <Text style={s.missionDesc}>{m.description}</Text>
              <View style={s.missionMeta}>
                <Badge label={`⭐ ${m.difficulty}/5`} tone="neutral" />
                <Badge label={`${m.estimatedMinutes} min`} tone="neutral" />
              </View>
            </Pressable>
          ))}
        </Panel>

        {/* Aircraft preset */}
        <Panel title="Aircraft configuration" subtitle="Select a base configuration (Sadraey Ch. 3).">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.horizontalScroll}>
            {AIRCRAFT_PRESETS.map(ap => (
              <Pressable key={ap.id} onPress={() => { setPreset(ap.id); setCustomSpan(null); setCustomArea(null); setCustomSweep(null); }}
                style={[s.presetCard, preset === ap.id && s.presetCardActive]}>
                <Text style={[s.presetName, preset === ap.id && s.presetNameActive]}>{ap.name}</Text>
                <Badge label={ap.category} tone={preset === ap.id ? 'accent' : 'neutral'} />
                <Text style={s.presetDesc}>{ap.description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Panel>

        {/* Custom parameters */}
        <Panel title="🔧 Custom Parameters" subtitle="Feed your own aircraft data.">
          <ParamInput label="Wing span" value={customSpan ?? (p.wing.spanM ?? 10)} unit="m" onChangeText={setCustomSpan} min={3} max={80} step={1} />
          <ParamInput label="Wing area" value={customArea ?? (p.wing.areaM2 ?? 16)} unit="m²" onChangeText={setCustomArea} min={5} max={500} step={1} />
          <ParamInput label="Sweep angle" value={customSweep ?? (p.wing.sweepDeg ?? 2)} unit="°" onChangeText={setCustomSweep} min={0} max={70} step={5} />
          {(customSpan !== null || customArea !== null || customSweep !== null) && (
            <Pressable onPress={() => { setCustomSpan(null); setCustomArea(null); setCustomSweep(null); }} style={s.resetBtn}>
              <Text style={s.resetBtnText}>↺ Reset to preset defaults</Text>
            </Pressable>
          )}
        </Panel>

        {/* Prediction challenge */}
        <Panel title="🔮 Predict Before You Change" subtitle="What do you think will happen?">
          <PredictionCard question={prediction.question} options={prediction.options} correctIndex={prediction.correctIndex}
            answered={predAnswered} selectedIndex={predSelected}
            onSelect={(i) => { setPredSelected(i); setPredAnswered(true); }} />
          {predAnswered && (
            <Pressable onPress={() => { setPredAnswered(false); setPredSelected(null); }} style={s.predResetBtn}>
              <Text style={s.predResetText}>Try another prediction</Text>
            </Pressable>
          )}
        </Panel>

        {/* B21: Disturbance experiments */}
        <Panel title="🌪️ Disturbance Experiments" subtitle="Test your design against real conditions.">
          <View style={s.disturbRow}>
            {['gust', 'crosswind', 'engine-failure'].map(type => (
              <Pressable key={type} onPress={() => { setDisturbType(type); setDisturbActive(!disturbActive || disturbType !== type); }}
                style={[s.disturbBtn, disturbActive && disturbType === type && s.disturbBtnActive]}>
                <Text style={s.disturbBtnText}>
                  {type === 'gust' ? '💨 Gust' : type === 'crosswind' ? '🌪️ Crosswind' : '🔴 Engine Out'}
                </Text>
              </Pressable>
            ))}
          </View>
          {disturbActive && (
            <Text style={s.disturbInfo}>
              {disturbType === 'gust' && '💨 Gust: sudden angle-of-attack change. Watch pitch response. Increase static margin or vertical tail for better stability.'}
              {disturbType === 'crosswind' && '🌪️ Crosswind: lateral force on the aircraft. Vertical tail provides directional stability. Rudder counteracts sideslip.'}
              {disturbType === 'engine-failure' && '🔴 Engine out: asymmetric thrust causes yaw. Enough vertical tail authority is needed to maintain control.'}
            </Text>
          )}
        </Panel>

        {/* B22: Teaching level selector */}
        <Panel title="📚 Teaching Level" subtitle="Progressive complexity from forces to full dynamics.">
          <View style={s.levelRow}>
            {[1, 2, 3, 4].map(l => (
              <Pressable key={l} onPress={() => setTeachingLevel(l)}
                style={[s.levelBtn, teachingLevel === l && s.levelBtnActive]}>
                <Text style={[s.levelBtnText, teachingLevel === l && s.levelBtnTextActive]}>
                  {l === 1 ? 'Static' : l === 2 ? '1D' : l === 3 ? '3-DOF' : '6-DOF'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.levelDesc}>
            {teachingLevel === 1 && 'Level 1: Static forces — lift = weight, thrust = drag. Understand equilibrium.'}
            {teachingLevel === 2 && 'Level 2: 1D kinematic — speed, acceleration, altitude. How does the aircraft move along a path?'}
            {teachingLevel === 3 && 'Level 3: 3-DOF longitudinal — forward, vertical, and pitch. Angle of attack, flight path, trim.'}
            {teachingLevel === 4 && 'Level 4: 6-DOF — roll, pitch, yaw, all axes. Full flight dynamics with moments of inertia.'}
          </Text>
        </Panel>

        {/* Evaluation result */}
        {evalResult && (
          <Panel title={evalResult.passed ? '✅ Mission Passed' : '❌ Mission Not Passed'} tone="raised">
            <Text style={s.evalSummary}>{evalResult.summary}</Text>
            {evalResult.requirements.map((r, i) => (
              <Text key={i} style={[s.evalReq, { color: r.met ? '#4ADE80' : '#F87171' }]}>{r.status}</Text>
            ))}
            {evalResult.suggestions.length > 0 && (
              <View style={s.suggestionsBox}>
                <Text style={s.suggestionsTitle}>💡 Suggestions:</Text>
                {evalResult.suggestions.map((sug, i) => (
                  <Text key={i} style={s.suggestionItem}>• {sug}</Text>
                ))}
              </View>
            )}
          </Panel>
        )}

        {/* Evaluate button */}
        <Pressable onPress={runEvaluation} style={s.evalBtn}>
          <Text style={s.evalBtnText}>🔍 Evaluate Design Against Mission</Text>
        </Pressable>

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
          <Text style={s.equation}>AR = b²/S = {fmt(result.config.wing.spanM)}² / {fmt(result.config.wing.areaM2)} = {fmt(result.perf.aspectRatio, 1)}</Text>
        </Panel>

        {/* Aerodynamic analysis */}
        <Panel title="Aerodynamic analysis" subtitle="Panel method + thin-airfoil theory">
          <View style={s.statGrid}>
            <Stat label="Cd0" value={fmt(result.perf.cd0, 4)} />
            <Stat label="Oswald e" value={fmt(result.perf.oswaldE, 3)} />
            <Stat label="Max L/D" value={fmt(result.perf.maxLd, 1)} highlight />
            <Stat label="Stall speed" value={`${fmt(result.perf.stallSpeedMs)} m/s`} />
            <Stat label="Wing loading" value={`${fmt(result.perf.wingLoading)} N/m²`} />
          </View>
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
            <Stat label="MTOW" value={`${fmt(result.mass.mtomKg)} kg`} highlight />
          </View>
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
          <View style={s.badgeRow}>
            <Badge label={result.feasible ? '✅ Mission feasible' : '❌ Mission NOT feasible'} tone={result.feasible ? 'success' : 'warning'} />
          </View>
        </Panel>

        {/* B18: Engineering notebook */}
        <Pressable onPress={() => setShowNotebook(!showNotebook)} style={s.notebookToggle}>
          <Text style={s.notebookToggleText}>{showNotebook ? '📕 Hide' : '📓 Show'} Engineering Notebook ({getNotebookStats().totalEntries} entries)</Text>
        </Pressable>
        {showNotebook && (
          <Panel title="📓 Engineering Notebook" subtitle="Your design decisions and lessons learned.">
            {getNotebookEntries().length === 0 ? (
              <Text style={s.emptyNotebook}>No entries yet. Change a parameter, make a prediction, and evaluate to start recording.</Text>
            ) : (
              getNotebookEntries().slice().reverse().map((entry, i) => (
                <View key={i} style={s.notebookEntry}>
                  <Text style={s.notebookTimestamp}>{new Date(entry.timestamp).toLocaleTimeString()}</Text>
                  <Text style={s.notebookChange}>Ch.{entry.chapterId}: {entry.change.parameter} {entry.change.direction} from {fmt(entry.change.oldValue, 0)} to {fmt(entry.change.newValue, 0)} {entry.change.unit}</Text>
                  {entry.prediction.length > 0 && (
                    <Text style={[s.notebookPred, { color: entry.predictionCorrect ? '#4ADE80' : '#F87171' }]}>
                      Prediction: {entry.predictionCorrect ? '✅ Correct' : '❌ Incorrect'}
                    </Text>
                  )}
                  <Text style={s.notebookResult}>{entry.actualResult}</Text>
                </View>
              ))
            )}
          </Panel>
        )}

        {/* Engineering insight */}
        <Panel title="💡 Engineering Insight" tone="raised">
          <Text style={s.tipText}>
            {result.perf.aspectRatio < 6 && 'Your aspect ratio is low. Higher AR reduces induced drag (CDi ∝ 1/AR) but increases structural weight.'}
            {result.config.wing.sweepDeg > 20 && `Sweep of ${fmt(result.config.wing.sweepDeg)}° delays compressibility effects but reduces low-speed CL slope.`}
            {result.perf.staticMargin < 0.03 && result.perf.staticMargin > 0 && 'Static margin is marginal. Higher SM (5-15% MAC) gives better longitudinal stability.'}
            {result.perf.staticMargin <= 0 && 'WARNING: Negative static margin = statically unstable. Requires fly-by-wire.'}
            {showForces && `Force vectors: Lift ${fmt(forces.lift/1000, 1)} kN, Drag ${fmt(forces.drag/1000, 1)} kN, Thrust ${fmt(forces.thrust/1000, 1)} kN, Weight ${fmt(forces.weight/1000, 1)} kN.`}
            {showCG && `CG at ${(cgFraction * 100).toFixed(0)}% fuselage length. Neutral point at ${(npFraction * 100).toFixed(0)}%. Static margin = ${fmt((npFraction - cgFraction) * 100, 1)}%.`}
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
  viewport: { height: '28%', backgroundColor: '#6CB4EE', borderBottomWidth: 2, borderBottomColor: colors.borderStrong, position: 'relative' },
  canvas: { flex: 1 },
  viewportLabel: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  viewportLabelText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  toggleRow: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 4 },
  toggleBtn: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  toggleBtnActive: { backgroundColor: 'rgba(255,176,32,0.7)' },
  toggleBtnText: { color: '#CCC', fontSize: 10, fontWeight: '600' },
  toggleBtnTextActive: { color: '#000' },
  panel: { flex: 1 },
  panelContent: { padding: spacing.lg, gap: spacing.md },
  horizontalScroll: { gap: spacing.sm },
  // Chapter nav (B16)
  chapterCard: { width: 100, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center', gap: 4 },
  chapterCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  chapterCardLocked: { opacity: 0.5 },
  chapterNum: { color: colors.textSubtle, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  chapterNumActive: { color: colors.primary },
  chapterTitle: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 14 },
  lockIcon: { fontSize: 12 },
  chapterDesc: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
  sadraeyRef: { color: colors.accent, fontSize: fontSize.xs, fontStyle: 'italic', marginTop: 4 },
  objList: { marginTop: 8 },
  objItem: { color: colors.textSubtle, fontSize: fontSize.xs, lineHeight: 20 },
  // Rank (B19)
  rankBar: { height: 8, backgroundColor: colors.surfaceHigh, borderRadius: 4, overflow: 'hidden' },
  rankFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
  rankNext: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 4 },
  rankRow: { flexDirection: 'row', gap: spacing.md, marginTop: 6 },
  rankStat: { color: colors.textSubtle, fontSize: fontSize.xs },
  // Missions
  missionItem: { backgroundColor: colors.backgroundAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  missionItemActive: { borderColor: colors.primary },
  missionName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  missionDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16, marginTop: 4 },
  missionMeta: { flexDirection: 'row', gap: 6, marginTop: 6 },
  // Presets
  presetCard: { width: 160, backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  presetCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  presetName: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  presetNameActive: { color: colors.primary },
  presetDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 15, marginTop: 4 },
  // Params
  paramRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  paramLabel: { color: colors.textSubtle, fontSize: fontSize.sm, flex: 1 },
  paramControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paramBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  paramBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  paramValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, minWidth: 60, textAlign: 'center' },
  resetBtn: { marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, alignItems: 'center' },
  resetBtnText: { color: colors.accent, fontSize: fontSize.xs },
  // Prediction
  predCard: { backgroundColor: colors.backgroundAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  predQuestion: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: 4 },
  predOption: { padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  predOptionCorrect: { borderColor: '#4ADE80' },
  predOptionWrong: { borderColor: '#F87171' },
  predOptionText: { color: colors.textSubtle, fontSize: fontSize.sm },
  predResetBtn: { marginTop: spacing.sm, padding: spacing.sm, alignItems: 'center' },
  predResetText: { color: colors.accent, fontSize: fontSize.xs },
  // Disturbances (B21)
  disturbRow: { flexDirection: 'row', gap: spacing.sm },
  disturbBtn: { flex: 1, padding: spacing.sm, backgroundColor: colors.backgroundAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  disturbBtnActive: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  disturbBtnText: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  disturbInfo: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 18, marginTop: 8, padding: spacing.sm, backgroundColor: 'rgba(255,176,32,0.06)', borderRadius: radius.sm },
  // Teaching level (B22)
  levelRow: { flexDirection: 'row', gap: spacing.sm },
  levelBtn: { flex: 1, padding: spacing.sm, backgroundColor: colors.backgroundAlt, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  levelBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.1)' },
  levelBtnText: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  levelBtnTextActive: { color: colors.primary },
  levelDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 18, marginTop: 8, padding: spacing.sm, backgroundColor: 'rgba(255,176,32,0.06)', borderRadius: radius.sm },
  // Evaluation (B17)
  evalBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center' },
  evalBtnText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  evalSummary: { color: colors.text, fontSize: fontSize.sm, marginBottom: 8 },
  evalReq: { fontSize: fontSize.xs, lineHeight: 20 },
  suggestionsBox: { marginTop: 8, padding: spacing.sm, backgroundColor: 'rgba(255,176,32,0.06)', borderRadius: radius.sm },
  suggestionsTitle: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 4 },
  suggestionItem: { color: colors.textSubtle, fontSize: fontSize.xs, lineHeight: 18 },
  // Notebook (B18)
  notebookToggle: { padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  notebookToggleText: { color: colors.accent, fontSize: fontSize.sm },
  emptyNotebook: { color: colors.textFaint, fontSize: fontSize.xs, fontStyle: 'italic', padding: spacing.md },
  notebookEntry: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm, gap: 2 },
  notebookTimestamp: { color: colors.textFaint, fontSize: 9 },
  notebookChange: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  notebookPred: { fontSize: fontSize.xs },
  notebookResult: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16 },
  // Stats
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, flexBasis: '28%', backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  equation: { color: colors.accent, fontSize: fontSize.xs, fontFamily: 'monospace', marginTop: spacing.md, padding: spacing.sm, backgroundColor: 'rgba(255,176,32,0.06)', borderRadius: radius.md, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tipText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
});

// Chapter 1 — Aircraft Design Fundamentals.
// The student's first mission as a junior aircraft designer.
// Features: 3D world, mission briefing, prediction challenge, engineering feedback.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge, Panel } from '@/components';
import AircraftModel from '@/components/three/AircraftModel';
import { Runway, Terrain, Sky, Clouds, Mountains, WindIndicator } from '@/components/three/World';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useModelB } from '@/contexts/ModelBContext';
import type { SimInputs } from '@/services/model-b/flight-dynamics';

// ---------------------------------------------------------------------------
// Prediction challenges
// ---------------------------------------------------------------------------

interface Prediction {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const PREDICTIONS: Prediction[] = [
  {
    question: 'What happens if you increase wing span?',
    options: [
      'Less induced drag, but heavier structure',
      'More speed always',
      'Less fuel needed',
      'Nothing changes',
    ],
    correctIndex: 0,
    explanation: 'Higher span increases aspect ratio, which reduces induced drag (CDi ∝ 1/AR). But longer wings are heavier and need stronger structure — a classic trade-off.',
  },
  {
    question: 'Why does a curved airfoil create more lift than a flat plate?',
    options: [
      'It is heavier',
      'Air moves faster over the curved top, creating lower pressure (Bernoulli)',
      'It has more surface area',
      'It is stronger',
    ],
    correctIndex: 1,
    explanation: 'The curved upper surface accelerates airflow, reducing pressure above the wing. Higher pressure below pushes up — this is Bernoulli\'s principle applied to lift.',
  },
  {
    question: 'What is the most important trade-off in aircraft design?',
    options: [
      'Colour vs weight',
      'Speed vs fuel consumption',
      'Every design choice has competing effects on different requirements',
      'Nothing — just pick the biggest engine',
    ],
    correctIndex: 2,
    explanation: 'Aircraft design is about compromises. A bigger engine gives more thrust but adds weight. A bigger wing gives more lift but adds drag. You must balance ALL requirements.',
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PredictionCard({
  prediction,
  onAnswer,
  answered,
  selected,
}: {
  prediction: Prediction;
  onAnswer: (index: number) => void;
  answered: boolean;
  selected: number | null;
}) {
  return (
    <View style={s.predCard}>
      <Text style={s.predQuestion}>{prediction.question}</Text>
      {prediction.options.map((opt, i) => {
        const isCorrect = answered && i === prediction.correctIndex;
        const isWrong = answered && selected === i && i !== prediction.correctIndex;
        return (
          <Pressable
            key={i}
            onPress={() => !answered && onAnswer(i)}
            style={[
              s.predOption,
              answered && isCorrect && s.predOptionCorrect,
              answered && isWrong && s.predOptionWrong,
            ]}
          >
            <Text
              style={[
                s.predOptionText,
                answered && isCorrect && s.predOptionTextCorrect,
                answered && isWrong && s.predOptionTextWrong,
              ]}
            >
              {answered && isCorrect ? '✓ ' : answered && isWrong ? '✗ ' : ''}
              {opt}
            </Text>
          </Pressable>
        );
      })}
      {answered && (
        <Text style={s.predExplanation}>{prediction.explanation}</Text>
      )}
    </View>
  );
}

function RequirementCheck({ label, passed, value }: { label: string; passed: boolean; value: string }) {
  return (
    <View style={s.reqRow}>
      <Text style={[s.reqIcon, { color: passed ? '#4ADE80' : '#F87171' }]}>
        {passed ? '✓' : '○'}
      </Text>
      <Text style={[s.reqLabel, passed && s.reqLabelPassed]}>{label}</Text>
      <Text style={s.reqValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Chapter1Screen() {
  const { missionState, startMission, stepSimulation, stopSimulation, checkMission, finishMission, addNotebookEntry } = useModelB();
  const [phase, setPhase] = useState<'briefing' | 'design' | 'fly' | 'predict' | 'result'>('briefing');
  const [throttle, setThrottle] = useState(0.5);
  const [elevator, setElevator] = useState(0);
  const [selectedPrediction, setSelectedPrediction] = useState<number | null>(null);
  const [predictionAnswered, setPredictionAnswered] = useState(false);
  const [predictionIndex, setPredictionIndex] = useState(0);
  const [creditsEarned, setCreditsEarned] = useState(0);
  const animRef = useRef<number | null>(null);
  const mission = missionState.mission;

  // Auto-start simulation loop
  useEffect(() => {
    if (phase !== 'fly' || !missionState.running) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    const tick = () => {
      const inputs: SimInputs = { throttle, elevatorDeg: elevator, dt: 0.05 };
      stepSimulation(inputs);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, missionState.running, throttle, elevator, stepSimulation]);

  const handleStartMission = useCallback(() => {
    startMission(1, '1.1-first-aircraft');
    setPhase('design');
  }, [startMission]);

  const handleFly = useCallback(() => {
    setPhase('fly');
  }, []);

  const handleStop = useCallback(() => {
    stopSimulation();
    setPhase('predict');
  }, [stopSimulation]);

  const handlePrediction = useCallback((index: number) => {
    setSelectedPrediction(index);
    setPredictionAnswered(true);
    const correct = index === PREDICTIONS[predictionIndex].correctIndex;
    const earned = correct ? 100 : 30;
    setCreditsEarned(earned);
    addNotebookEntry({
      chapter: 1,
      mission: mission?.id ?? '',
      decision: `Predicted: ${PREDICTIONS[predictionIndex].options[index]}`,
      predictedEffect: PREDICTIONS[predictionIndex].options[PREDICTIONS[predictionIndex].correctIndex],
      actualResult: correct ? 'Correct prediction!' : 'Incorrect — see explanation',
      lesson: PREDICTIONS[predictionIndex].explanation,
    });
  }, [predictionIndex, mission, addNotebookEntry]);

  const handleFinish = useCallback(() => {
    finishMission(creditsEarned, predictionAnswered && selectedPrediction === PREDICTIONS[predictionIndex].correctIndex);
    setPhase('result');
  }, [finishMission, creditsEarned, predictionAnswered, selectedPrediction, predictionIndex]);

  // Aircraft params for 3D model (defaults for Chapter 1)
  const aircraftParams = {
    wingSpanM: 11,
    wingAreaM2: 16.2,
    taperRatio: 0.7,
    sweepDeg: 0,
    dihedralDeg: 3,
    fuselageLengthM: 8,
    fuselageDiameterM: 1.2,
    tailType: 'conventional' as const,
    htAreaM2: 3.5,
    vtAreaM2: 2.5,
    tailArmM: 5,
    engineCount: 1,
    engineType: 'piston' as const,
  };

  const state = missionState.flightState;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Phase: Briefing */}
      {phase === 'briefing' && (
        <>
          <Panel title="Chapter 1 — Aircraft Design Fundamentals" tone="raised">
            <Text style={s.briefingTitle}>Welcome, Junior Aircraft Designer</Text>
            <Text style={s.briefingText}>
              You have been hired at an aircraft design company. Your first task:
              design a basic aircraft to carry passengers on a short flight.
            </Text>
            <Text style={s.briefingText}>
              You don't need to know everything yet. The game will teach you as you go.
              The key idea: aircraft design is a loop of synthesise → analyse → evaluate → decide.
            </Text>
          </Panel>

          <Panel title="Your Mission: The First Aircraft">
            <Text style={s.missionDesc}>
              Design an aircraft that can carry 4 passengers over 200 km.
            </Text>
            <View style={s.reqList}>
              {mission?.requirements.map((req, i) => (
                <RequirementCheck
                  key={i}
                  label={req.description}
                  passed={false}
                  value={`${req.minValue ?? req.maxValue} ${req.unit}`}
                />
              ))}
            </View>
          </Panel>

          <Panel title="Sadraey Reference">
            <Text style={s.refText}>
              This follows Mohammad H. Sadraey, Aircraft Design: A Systems Engineering
              Approach, Chapter 1 — Introduction to Aircraft Design. The design process
              is: requirements → concepts → feasibility → trade-offs → iteration.
            </Text>
          </Panel>

          <Pressable style={s.primaryButton} onPress={handleStartMission}>
            <Text style={s.primaryButtonText}>Begin Design</Text>
          </Pressable>
        </>
      )}

      {/* Phase: Design */}
      {phase === 'design' && (
        <>
          {/* 3D World */}
          <View style={s.worldContainer}>
            <View style={s.worldPlaceholder}>
              <Text style={s.worldText}>3D Aircraft World</Text>
              <Text style={s.worldSubtext}>Runway • Mountains • Clouds</Text>
              {/* 3D canvas will be wired here when expo-gl is configured */}
            </View>
          </View>

          <Panel title="Your Design">
            <Text style={s.designInfo}>
              Your aircraft: Single-engine, conventional tail, wingspan 11m, NACA 2412 airfoil.
            </Text>
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={s.statLabel}>Wing span</Text>
                <Text style={s.statValue}>11.0 m</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>Wing area</Text>
                <Text style={s.statValue}>16.2 m²</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>Mass</Text>
                <Text style={s.statValue}>1,100 kg</Text>
              </View>
            </View>
          </Panel>

          <Panel title="Engine Control">
            <Text style={s.controlLabel}>Throttle: {(throttle * 100).toFixed(0)}%</Text>
            <View style={s.sliderRow}>
              {[0, 25, 50, 75, 100].map(t => (
                <Pressable
                  key={t}
                  onPress={() => setThrottle(t / 100)}
                  style={[s.throttleBtn, throttle === t / 100 && s.throttleBtnActive]}
                >
                  <Text style={s.throttleBtnText}>{t}%</Text>
                </Pressable>
              ))}
            </View>
          </Panel>

          <Pressable style={s.primaryButton} onPress={handleFly}>
            <Text style={s.primaryButtonText}>Take Off</Text>
          </Pressable>
        </>
      )}

      {/* Phase: Fly */}
      {phase === 'fly' && (
        <>
          {/* 3D World with live aircraft */}
          <View style={s.worldContainer}>
            <View style={s.worldPlaceholder}>
              <Text style={s.worldText}>✈️ Flying!</Text>
              <Text style={s.worldSubtext}>Speed: {(state.airspeedMs * 3.6).toFixed(0)} km/h | Alt: {state.yM.toFixed(0)} m | Dist: {(state.xM / 1000).toFixed(1)} km</Text>
            </View>
          </View>

          {/* Live telemetry */}
          <Panel title="Flight Telemetry" tone="raised">
            <View style={s.telemetryGrid}>
              <View style={s.telemItem}>
                <Text style={s.telemLabel}>Airspeed</Text>
                <Text style={s.telemValue}>{(state.airspeedMs * 3.6).toFixed(0)} km/h</Text>
              </View>
              <View style={s.telemItem}>
                <Text style={s.telemLabel}>Altitude</Text>
                <Text style={s.telemValue}>{state.yM.toFixed(0)} m</Text>
              </View>
              <View style={s.telemItem}>
                <Text style={s.telemLabel}>Distance</Text>
                <Text style={s.telemValue}>{(state.xM / 1000).toFixed(1)} km</Text>
              </View>
              <View style={s.telemItem}>
                <Text style={s.telemLabel}>Fuel</Text>
                <Text style={[s.telemValue, state.fuelKg < 20 && { color: '#F87171' }]}>
                  {state.fuelKg.toFixed(0)} kg
                </Text>
              </View>
              <View style={s.telemItem}>
                <Text style={s.telemLabel}>AoA</Text>
                <Text style={s.telemValue}>{(state.alphaRad * 180 / Math.PI).toFixed(1)}°</Text>
              </View>
              <View style={s.telemItem}>
                <Text style={s.telemLabel}>Pitch</Text>
                <Text style={s.telemValue}>{(state.pitchRad * 180 / Math.PI).toFixed(1)}°</Text>
              </View>
            </View>
          </Panel>

          {/* Controls */}
          <Panel title="Controls">
            <Text style={s.controlLabel}>Throttle: {(throttle * 100).toFixed(0)}%</Text>
            <View style={s.sliderRow}>
              {[0, 25, 50, 75, 100].map(t => (
                <Pressable
                  key={t}
                  onPress={() => setThrottle(t / 100)}
                  style={[s.throttleBtn, throttle === t / 100 && s.throttleBtnActive]}
                >
                  <Text style={s.throttleBtnText}>{t}%</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[s.controlLabel, { marginTop: spacing.md }]}>Elevator: {elevator.toFixed(0)}°</Text>
            <View style={s.sliderRow}>
              {[-10, -5, 0, 5, 10].map(e => (
                <Pressable
                  key={e}
                  onPress={() => setElevator(e)}
                  style={[s.elevBtn, elevator === e && s.elevBtnActive]}
                >
                  <Text style={s.elevBtnText}>{e > 0 ? '+' : ''}{e}°</Text>
                </Pressable>
              ))}
            </View>
          </Panel>

          <Pressable style={s.stopButton} onPress={handleStop}>
            <Text style={s.stopButtonText}>Stop & Review</Text>
          </Pressable>
        </>
      )}

      {/* Phase: Prediction */}
      {phase === 'predict' && (
        <>
          <Panel title="Prediction Challenge" tone="raised">
            <Text style={s.briefingText}>
              Before we continue, predict what will happen with your design choices.
              Active learning: predict → test → explain.
            </Text>
          </Panel>

          {predictionIndex < PREDICTIONS.length && (
            <PredictionCard
              prediction={PREDICTIONS[predictionIndex]}
              onAnswer={handlePrediction}
              answered={predictionAnswered}
              selected={selectedPrediction}
            />
          )}

          {predictionAnswered && (
            <Pressable
              style={s.primaryButton}
              onPress={() => {
                if (predictionIndex < PREDICTIONS.length - 1) {
                  setPredictionIndex(predictionIndex + 1);
                  setSelectedPrediction(null);
                  setPredictionAnswered(false);
                } else {
                  handleFinish();
                }
              }}
            >
              <Text style={s.primaryButtonText}>
                {predictionIndex < PREDICTIONS.length - 1 ? 'Next Question' : 'See Results'}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {/* Phase: Result */}
      {phase === 'result' && (
        <>
          <Panel title="Mission Complete!" tone="raised">
            <Text style={s.resultTitle}>🎉 First Flight Complete</Text>
            <Text style={s.briefingText}>
              You designed and flew your first aircraft. The key lesson:
              every design choice has consequences, and engineering is about finding the right trade-offs.
            </Text>
            <View style={s.creditsBox}>
              <Text style={s.creditsText}>+{creditsEarned} Aero Credits</Text>
              <Badge label="Chapter 1 Complete" tone="success" />
            </View>
          </Panel>

          <Panel title="What You Learned">
            <Text style={s.lessonText}>
              • Aircraft design is a loop: synthesise → analyse → evaluate → decide
            </Text>
            <Text style={s.lessonText}>
              • Every component affects every other (wing, tail, engine, fuselage)
            </Text>
            <Text style={s.lessonText}>
              • Requirements drive the design, not the other way around
            </Text>
            <Text style={s.lessonText}>
              • Trade-offs are unavoidable — there is no perfect design
            </Text>
          </Panel>

          <Panel title="Engineering Notebook">
            <Text style={s.notebookTitle}>Your decisions in this mission:</Text>
            {missionState.lastStep && (
              <Text style={s.notebookEntry}>
                Flew {state.xM.toFixed(0)}m at {state.airspeedMs.toFixed(0)} m/s.
                Fuel remaining: {state.fuelKg.toFixed(0)} kg.
              </Text>
            )}
          </Panel>
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },

  // Briefing
  briefingTitle: { color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  briefingText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.sm },
  missionDesc: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.md },
  refText: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 18, fontStyle: 'italic' },

  // Requirements
  reqList: { gap: spacing.sm },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  reqIcon: { fontSize: 16, width: 20, textAlign: 'center' },
  reqLabel: { flex: 1, color: colors.textSubtle, fontSize: fontSize.sm },
  reqLabelPassed: { color: '#4ADE80' },
  reqValue: { color: colors.textFaint, fontSize: fontSize.xs, fontFamily: 'monospace' },

  // 3D World
  worldContainer: { height: 220, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  worldPlaceholder: {
    flex: 1, backgroundColor: '#1a2a3a', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  worldText: { color: '#FFFFFF', fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  worldSubtext: { color: '#8899AA', fontSize: fontSize.xs },

  // Design
  designInfo: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  statValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Controls
  controlLabel: { color: colors.textSubtle, fontSize: fontSize.sm, marginBottom: spacing.sm },
  sliderRow: { flexDirection: 'row', gap: spacing.sm },
  throttleBtn: {
    flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.backgroundAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  throttleBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.12)' },
  throttleBtnText: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  elevBtn: {
    flex: 1, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.backgroundAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  elevBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.12)' },
  elevBtnText: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  // Telemetry
  telemetryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  telemItem: { flexBasis: '30%', flexGrow: 1, backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  telemLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  telemValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Prediction
  predCard: { backgroundColor: colors.backgroundAlt, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  predQuestion: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  predOption: { padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border },
  predOptionCorrect: { borderColor: '#4ADE80', backgroundColor: 'rgba(74,222,128,0.1)' },
  predOptionWrong: { borderColor: '#F87171', backgroundColor: 'rgba(248,113,113,0.1)' },
  predOptionText: { color: colors.textSubtle, fontSize: fontSize.sm },
  predOptionTextCorrect: { color: '#4ADE80' },
  predOptionTextWrong: { color: '#F87171' },
  predExplanation: { color: colors.accent, fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.sm, fontStyle: 'italic' },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#000', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  stopButton: {
    backgroundColor: '#F87171', borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center',
  },
  stopButtonText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Result
  resultTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.md, textAlign: 'center' },
  creditsBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, padding: spacing.md, backgroundColor: 'rgba(255,176,32,0.1)', borderRadius: radius.md },
  creditsText: { color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  lessonText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 22, marginBottom: 4 },
  notebookTitle: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  notebookEntry: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 18 },
});

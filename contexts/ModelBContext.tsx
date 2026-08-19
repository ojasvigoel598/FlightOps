// Model B game context — chapter progress, mission state, flight simulation.
// Manages the student's journey through Sadraey's 12 chapters.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  CHAPTERS,
  createInitialProgress,
  completeMission,
  isChapterUnlocked,
  type Chapter,
  type Mission,
  type NotebookEntry,
  type StudentProgress,
} from '@/services/model-b/chapters';
import {
  createInitialState,
  findTrimAlpha,
  stepFlightDynamics,
  type DynamicsParams,
  type FlightState,
  type SimInputs,
  type StepResult,
} from '@/services/model-b/flight-dynamics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissionState {
  /** Currently active mission */
  mission: Mission | null;
  /** Chapter the mission belongs to */
  chapter: number;
  /** Flight simulation state */
  flightState: FlightState;
  /** Last simulation step result */
  lastStep: StepResult | null;
  /** Is simulation running */
  running: boolean;
  /** Mission result */
  result: 'none' | 'success' | 'failure';
  /** Failure reason */
  failureReason: string;
}

export interface ModelBContextType {
  /** Student progress */
  progress: StudentProgress;
  /** All chapters */
  chapters: Chapter[];
  /** Currently active chapter */
  activeChapter: Chapter;
  /** Start a mission */
  startMission: (chapterId: number, missionId: string) => void;
  /** Step the simulation */
  stepSimulation: (inputs: SimInputs) => void;
  /** Stop simulation */
  stopSimulation: () => void;
  /** Check mission requirements */
  checkMission: () => { passed: boolean; details: string[] };
  /** Complete current mission */
  finishMission: (creditsEarned: number, predictionCorrect?: boolean) => void;
  /** Current mission state */
  missionState: MissionState;
  /** Add notebook entry */
  addNotebookEntry: (entry: Omit<NotebookEntry, 'timestamp'>) => void;
  /** Reset progress */
  resetProgress: () => void;
  /** Aircraft dynamics params (from current config) */
  dynamicsParams: DynamicsParams;
  /** Update dynamics params */
  setDynamicsParams: (p: DynamicsParams) => void;
}

// ---------------------------------------------------------------------------
// Default dynamics params (Cessna 172-like)
// ---------------------------------------------------------------------------

const DEFAULT_DYNAMICS: DynamicsParams = {
  massKg: 1100,
  wingAreaM2: 16.2,
  clAlpha: 5.7, // per rad ≈ 2π for thin airfoil
  cd0: 0.027,
  oswaldE: 0.8,
  aspectRatio: 7.4,
  clMax: 1.6,
  maxThrustN: 3500,
  sfc: 0.000153, // kg/(N*s) for piston
  engineType: 'prop',
  iPitchKgM2: 1500,
  pitchDamping: 800,
  neutralPointM: 2.5,
  cgPositionM: 2.0,
};

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'flightops.modelb.v1';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ModelBContext = createContext<ModelBContextType | undefined>(undefined);

export function ModelBProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<StudentProgress>(() => createInitialProgress());
  const [missionState, setMissionState] = useState<MissionState>({
    mission: null,
    chapter: 1,
    flightState: createInitialState(0, 0, 100),
    lastStep: null,
    running: false,
    result: 'none',
    failureReason: '',
  });
  const [dynamicsParams, setDynamicsParams] = useState<DynamicsParams>(DEFAULT_DYNAMICS);
  const flightRef = useRef<FlightState>(createInitialState(0, 0, 100));

  // Load persisted progress
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          parsed.completedMissions = new Set(parsed.completedMissions);
          setProgress(parsed);
        } catch { /* ignore */ }
      }
    }).catch(() => undefined);
  }, []);

  // Save progress
  useEffect(() => {
    const data = {
      ...progress,
      completedMissions: Array.from(progress.completedMissions),
      notebookEntries: progress.notebookEntries,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => undefined);
  }, [progress]);

  const activeChapter = CHAPTERS.find(c => c.id === progress.currentChapter) || CHAPTERS[0];

  const startMission = useCallback((chapterId: number, missionId: string) => {
    const chapter = CHAPTERS.find(c => c.id === chapterId);
    const mission = chapter?.missions.find(m => m.id === missionId);
    if (!chapter || !mission) return;

    const initialState = createInitialState(0, 0, 100);
    flightRef.current = initialState;

    setMissionState({
      mission,
      chapter: chapterId,
      flightState: initialState,
      lastStep: null,
      running: true,
      result: 'none',
      failureReason: '',
    });
  }, []);

  const stepSimulation = useCallback((inputs: SimInputs) => {
    if (!missionState.running || !missionState.mission) return;

    const result = stepFlightDynamics(flightRef.current, dynamicsParams, inputs);
    flightRef.current = result.state;

    setMissionState(prev => ({
      ...prev,
      flightState: result.state,
      lastStep: result,
    }));
  }, [missionState.running, missionState.mission, dynamicsParams]);

  const stopSimulation = useCallback(() => {
    setMissionState(prev => ({ ...prev, running: false }));
  }, []);

  const checkMission = useCallback(() => {
    if (!missionState.mission) return { passed: false, details: ['No mission active'] };
    const state = missionState.flightState;
    const perf = missionState.lastStep;
    const details: string[] = [];
    let passed = true;

    for (const req of missionState.mission.requirements) {
      let ok = true;
      switch (req.parameter) {
        case 'range':
          ok = (state.xM / 1000) >= (req.minValue ?? 0);
          details.push(`${req.parameter}: ${(state.xM / 1000).toFixed(0)} km ${ok ? '>=' : '<'} ${req.minValue} km`);
          break;
        case 'stallSpeed':
          ok = perf?.forces.liftN !== undefined;
          details.push(`${req.parameter}: checked`);
          break;
        case 'maxSpeed':
          ok = state.airspeedMs >= (req.minValue ?? 0);
          details.push(`${req.parameter}: ${(state.airspeedMs * 3.6).toFixed(0)} km/h`);
          break;
        default:
          details.push(`${req.parameter}: assumed OK`);
      }
      if (!ok) passed = false;
    }

    return { passed, details };
  }, [missionState]);

  const finishMission = useCallback((creditsEarned: number, predictionCorrect?: boolean) => {
    if (!missionState.mission) return;
    setProgress(prev =>
      completeMission(prev, missionState.chapter, missionState.mission!.id, creditsEarned, predictionCorrect)
    );
    setMissionState(prev => ({
      ...prev,
      running: false,
      result: 'success',
    }));
  }, [missionState.mission, missionState.chapter]);

  const addNotebookEntry = useCallback((entry: Omit<NotebookEntry, 'timestamp'>) => {
    setProgress(prev => ({
      ...prev,
      notebookEntries: [...prev.notebookEntries, { ...entry, timestamp: Date.now() }],
    }));
  }, []);

  const resetProgress = useCallback(() => {
    setProgress(createInitialProgress());
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  return (
    <ModelBContext.Provider
      value={{
        progress,
        chapters: CHAPTERS,
        activeChapter,
        startMission,
        stepSimulation,
        stopSimulation,
        checkMission,
        finishMission,
        missionState,
        addNotebookEntry,
        resetProgress,
        dynamicsParams,
        setDynamicsParams,
      }}
    >
      {children}
    </ModelBContext.Provider>
  );
}

export function useModelB(): ModelBContextType {
  const ctx = useContext(ModelBContext);
  if (!ctx) throw new Error('useModelB must be used within ModelBProvider');
  return ctx;
}

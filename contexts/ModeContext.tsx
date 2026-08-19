// Learning mode context — switches between Fun Mode (intuitive, no equations)
// and Engineering Mode (Sadraey-style, detailed analysis).
// Persisted in AsyncStorage so the choice survives restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type LearningMode = 'fun' | 'engineering';

export interface ModeContextType {
  mode: LearningMode;
  setMode: (m: LearningMode) => void;
  isFun: boolean;
  isEngineering: boolean;
}

const STORAGE_KEY = 'flightops.mode.v1';
export const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LearningMode>('fun');
  const [ready, setReady] = useState(false);

  // Load persisted mode
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw === 'fun' || raw === 'engineering') setModeState(raw);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const setMode = useCallback((m: LearningMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m).catch(() => undefined);
  }, []);

  if (!ready) return null;

  return (
    <ModeContext.Provider value={{ mode, setMode, isFun: mode === 'fun', isEngineering: mode === 'engineering' }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useLearningMode(): ModeContextType {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useLearningMode must be used within ModeProvider');
  return ctx;
}

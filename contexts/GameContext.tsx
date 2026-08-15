// Powered by OnSpace.AI
// Global company + design + contract state. Provider only.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_DESIGN, STARTING_COMPANY } from '@/constants/config';
import { generateContracts } from '@/services/contracts';
import type { Company, Contract, Design, MissionResult } from '@/types/game';

const STORAGE_KEY = 'flightops.save.v1';

export interface GameContextType {
  company: Company;
  contracts: Contract[];
  activeContract: Contract | null;
  design: Design;
  lastResult: MissionResult | null;
  ready: boolean;
  selectContract: (contract: Contract) => void;
  clearActiveContract: () => void;
  updateDesign: (partial: Partial<Design>) => void;
  launchMission: (cost: number) => void;
  completeMission: (result: MissionResult) => void;
  purchaseUpgrade: (id: string, cost: number) => boolean;
  refreshContracts: () => void;
  resetGame: () => void;
}

export const GameContext = createContext<GameContextType | undefined>(undefined);

function computeLevel(xp: number): number {
  return 1 + Math.floor(xp / 120);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company>({ ...STARTING_COMPANY });
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [design, setDesign] = useState<Design>({ ...DEFAULT_DESIGN });
  const [lastResult, setLastResult] = useState<MissionResult | null>(null);
  const [ready, setReady] = useState(false);
  const seedRef = useRef(Date.now() % 1000000);

  // Load persisted save on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.company) setCompany(parsed.company);
          if (parsed.design) setDesign(parsed.design);
          if (Array.isArray(parsed.contracts) && parsed.contracts.length) {
            setContracts(parsed.contracts);
          } else {
            setContracts(generateContracts(parsed.company?.level ?? 1, seedRef.current));
          }
        } else {
          setContracts(generateContracts(1, seedRef.current));
        }
      } catch {
        setContracts(generateContracts(1, seedRef.current));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Persist whenever key state changes.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ company, design, contracts }),
    ).catch(() => undefined);
  }, [company, design, contracts, ready]);

  const selectContract = useCallback((contract: Contract) => {
    setActiveContract(contract);
  }, []);

  const clearActiveContract = useCallback(() => setActiveContract(null), []);

  const updateDesign = useCallback((partial: Partial<Design>) => {
    setDesign((prev) => ({ ...prev, ...partial }));
  }, []);

  const launchMission = useCallback((cost: number) => {
    setCompany((prev) => ({ ...prev, money: Math.round((prev.money - cost) * 100) / 100 }));
  }, []);

  const completeMission = useCallback((result: MissionResult) => {
    setLastResult(result);
    setCompany((prev) => {
      const xp = prev.xp + result.xp;
      return {
        ...prev,
        money: Math.round((prev.money + result.reward) * 100) / 100,
        xp,
        level: computeLevel(xp),
        missionsCompleted: prev.missionsCompleted + (result.success ? 1 : 0),
        missionsFailed: prev.missionsFailed + (result.success ? 0 : 1),
      };
    });
    // Retire the flown contract and refresh the board.
    setContracts((prev) => {
      const remaining = prev.filter((c) => c.id !== result.contractId);
      seedRef.current += 7;
      const fresh = generateContracts(computeLevel(company.xp + result.xp), seedRef.current, 1);
      return [...remaining, ...fresh];
    });
    setActiveContract(null);
  }, [company.xp]);

  const purchaseUpgrade = useCallback((id: string, cost: number): boolean => {
    let ok = false;
    setCompany((prev) => {
      if (prev.money < cost || prev.upgrades.includes(id)) return prev;
      ok = true;
      return {
        ...prev,
        money: Math.round((prev.money - cost) * 100) / 100,
        upgrades: [...prev.upgrades, id],
      };
    });
    return ok;
  }, []);

  const refreshContracts = useCallback(() => {
    seedRef.current += 13;
    setContracts(generateContracts(company.level, seedRef.current));
  }, [company.level]);

  const resetGame = useCallback(() => {
    seedRef.current = Date.now() % 1000000;
    setCompany({ ...STARTING_COMPANY });
    setDesign({ ...DEFAULT_DESIGN });
    setActiveContract(null);
    setLastResult(null);
    setContracts(generateContracts(1, seedRef.current));
  }, []);

  const value = useMemo<GameContextType>(
    () => ({
      company,
      contracts,
      activeContract,
      design,
      lastResult,
      ready,
      selectContract,
      clearActiveContract,
      updateDesign,
      launchMission,
      completeMission,
      purchaseUpgrade,
      refreshContracts,
      resetGame,
    }),
    [
      company,
      contracts,
      activeContract,
      design,
      lastResult,
      ready,
      selectContract,
      clearActiveContract,
      updateDesign,
      launchMission,
      completeMission,
      purchaseUpgrade,
      refreshContracts,
      resetGame,
    ],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

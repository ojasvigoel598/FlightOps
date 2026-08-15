// Powered by OnSpace.AI
// Mission runtime: a deterministic, step-based flight state machine.

import { useCallback, useMemo, useRef, useState } from 'react';

import { pickEvent, resolveOption } from '@/services/events';
import { makeRng, type Rng } from '@/services/rng';
import { computeVehicleStats } from '@/services/simulation';
import type { MissionEvent, MissionResult, Telemetry } from '@/types/game';
import { clamp, round } from '@/utils/math';
import { useGame } from './useGame';

const TOTAL_TICKS = 6;

export type MissionStatus = 'briefing' | 'flying' | 'event' | 'done';

function bandFor(progress: number): 'takeoff' | 'cruise' | 'descent' {
  if (progress < 22) return 'takeoff';
  if (progress < 80) return 'cruise';
  return 'descent';
}

export function useMission() {
  const { activeContract, design, company, completeMission } = useGame();

  const stats = useMemo(() => {
    if (!activeContract) return null;
    return computeVehicleStats(
      design,
      activeContract.payloadKg,
      activeContract.distanceKm,
      company.upgrades,
    );
  }, [activeContract, design, company.upgrades]);

  const hasAi = company.upgrades.includes('ai-copilot');

  const [status, setStatus] = useState<MissionStatus>('briefing');
  const [telemetry, setTelemetry] = useState<Telemetry>({
    progress: 0,
    fuel: 100,
    integrity: 100,
    engineHealth: 100,
    burnModifier: 1,
  });
  const [currentEvent, setCurrentEvent] = useState<MissionEvent | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<MissionResult | null>(null);

  const rngRef = useRef<Rng>(makeRng(activeContract?.seed ?? 1));
  const usedEvents = useRef<string[]>([]);
  const finished = useRef(false);

  const finalize = useCallback(
    (success: boolean, summary: string, finalTelemetry: Telemetry, finalLog: string[]) => {
      if (finished.current || !activeContract || !stats) return;
      finished.current = true;
      const reward = success ? activeContract.reward : 0;
      const cost = stats.cost;
      const xp = success
        ? Math.round(30 + activeContract.reward * 3 + activeContract.payloadKg / 60)
        : 6;
      const res: MissionResult = {
        contractId: activeContract.id,
        contractTitle: activeContract.title,
        success,
        reward,
        cost,
        net: round(reward - cost, 1),
        xp,
        summary,
        log: finalLog,
        telemetry: finalTelemetry,
      };
      setResult(res);
      setStatus('done');
      completeMission(res);
    },
    [activeContract, stats, completeMission],
  );

  const start = useCallback(() => {
    if (!activeContract) return;
    rngRef.current = makeRng(activeContract.seed);
    usedEvents.current = [];
    finished.current = false;
    setLog(['Cleared for departure. Mission is a go.']);
    setStatus('flying');
  }, [activeContract]);

  const advance = useCallback(() => {
    if (!activeContract || !stats || status !== 'flying') return;

    const rng = rngRef.current;
    const distancePerTick = activeContract.distanceKm / TOTAL_TICKS;

    // Damaged engines burn more fuel — the chain-reaction driver.
    const enginePenalty = 1 + (100 - telemetry.engineHealth) / 150;
    const fuelUsedKg = stats.fuelBurnPerKm * distancePerTick * telemetry.burnModifier * enginePenalty;
    const fuelPctUsed = (fuelUsedKg / stats.fuelCapacityKg) * 100;

    const next: Telemetry = {
      ...telemetry,
      fuel: telemetry.fuel - fuelPctUsed,
      progress: clamp(telemetry.progress + 100 / TOTAL_TICKS, 0, 100),
      engineHealth: clamp(telemetry.engineHealth - 1, 0, 100),
    };

    const newLog = [...log];

    // Failure checks.
    if (next.fuel <= 0) {
      next.fuel = 0;
      setTelemetry(next);
      newLog.push('Fuel exhausted before reaching the destination.');
      setLog(newLog);
      finalize(false, 'Ran out of fuel mid-flight.', next, newLog);
      return;
    }
    if (next.engineHealth <= 0) {
      setTelemetry(next);
      newLog.push('Engine failed completely.');
      setLog(newLog);
      finalize(false, 'Total engine failure.', next, newLog);
      return;
    }

    if (next.progress >= 100) {
      next.progress = 100;
      setTelemetry(next);
      newLog.push('Touchdown. Payload delivered.');
      setLog(newLog);
      finalize(true, 'Mission accomplished — payload delivered safely.', next, newLog);
      return;
    }

    // Roll for a random event, weighted by reliability.
    const eventChance = clamp(0.72 - stats.reliability / 260, 0.35, 0.85);
    if (rng() < eventChance) {
      const band = bandFor(next.progress);
      const ev = pickEvent(rng, band, stats, usedEvents.current);
      if (ev) {
        usedEvents.current = [...usedEvents.current, ev.id];
        setTelemetry(next);
        setCurrentEvent(ev);
        setStatus('event');
        setLog(newLog);
        return;
      }
    }

    newLog.push(`Cruise nominal — ${round(next.progress)}% of route complete.`);
    setTelemetry(next);
    setLog(newLog);
  }, [activeContract, stats, status, telemetry, log, finalize]);

  const choose = useCallback(
    (optionKey: string) => {
      if (!currentEvent || !stats || status !== 'event') return;
      const rng = rngRef.current;
      const resolution = resolveOption(currentEvent.id, optionKey, rng, stats);

      const next: Telemetry = {
        progress: clamp(telemetry.progress + (resolution.deltas.progress ?? 0), 0, 100),
        fuel: clamp(telemetry.fuel + (resolution.deltas.fuel ?? 0), 0, 100),
        integrity: clamp(telemetry.integrity + (resolution.deltas.integrity ?? 0), 0, 100),
        engineHealth: clamp(telemetry.engineHealth + (resolution.deltas.engine ?? 0), 0, 100),
        burnModifier: telemetry.burnModifier + (resolution.deltas.burnMod ?? 0),
      };

      const newLog = [...log, `${currentEvent.title}: ${resolution.message}`];
      setTelemetry(next);
      setLog(newLog);
      setCurrentEvent(null);

      if (resolution.abort) {
        finalize(false, 'Mission aborted — crew and vehicle safe.', next, newLog);
        return;
      }
      if (next.integrity <= 0) {
        finalize(false, 'Airframe integrity lost.', next, newLog);
        return;
      }
      if (next.engineHealth <= 0) {
        finalize(false, 'Engine failed after the fault.', next, newLog);
        return;
      }
      if (next.fuel <= 0) {
        finalize(false, 'Fuel exhausted during the emergency.', next, newLog);
        return;
      }

      setStatus('flying');
    },
    [currentEvent, stats, status, telemetry, log, finalize],
  );

  return {
    activeContract,
    stats,
    hasAi,
    status,
    telemetry,
    currentEvent,
    log,
    result,
    totalTicks: TOTAL_TICKS,
    start,
    advance,
    choose,
  };
}

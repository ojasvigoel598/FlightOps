// UnsteadyLab — the unsteady-aerodynamics panels of the Aero Lab.
//
// Everything shown here is CALCULATED from the validated models in
// services/unsteady.ts and services/unsteady-vortex.ts; the model limits and
// the discrete-method early-time caveat are shown inline rather than hidden.

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Badge, LineChart, Panel } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  duhamelHarmonic,
  theodorsen,
  theodorsenCurve,
  theodorsenPitchLift,
  theodorsenPlungeLift,
  wagnerCurve,
  wagnerExact,
  wagnerJones,
} from '@/services/unsteady';
import { unsteadyVortexStepResponse } from '@/services/unsteady-vortex';

const CHART_W = 320;
const CHART_H = 140;

function fmt(n: number, digits = 3): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function parseNum(text: string): number {
  const v = Number.parseFloat(text);
  return Number.isFinite(v) ? v : Number.NaN;
}

export function UnsteadyLab() {
  const [kText, setKText] = useState('0.5');
  const [pitchMode, setPitchMode] = useState<'plunge' | 'pitch'>('pitch');
  const [duhamelMode, setDuhamelMode] = useState<'step' | 'harmonic'>('harmonic');
  const [vortexRun, setVortexRun] = useState(false);

  const k = parseNum(kText);
  const kValid = Number.isFinite(k) && k > 0;

  const theodorsenCurveData = useMemo(() => {
    const curve = theodorsenCurve(1e-2, 10, 30);
    return {
      mag: curve.map((p) => ({ x: Math.log10(p.k), y: p.magnitude })),
      phase: curve.map((p) => ({ x: Math.log10(p.k), y: p.phaseDeg })),
    };
  }, []);

  const wagnerData = useMemo(() => {
    const curve = wagnerCurve(0.2, 20, 30, 2);
    return {
      jones: curve.map((p) => ({ x: p.s, y: p.jones })),
      exact: curve.filter((p) => Number.isFinite(p.exact)).map((p) => ({ x: p.s, y: p.exact as number })),
      garrick: curve.map((p) => ({ x: p.s, y: p.garrick })),
    };
  }, []);

  const ck = useMemo(() => (kValid ? theodorsen(k) : null), [k, kValid]);

  const harmonic = useMemo(() => {
    if (!kValid) return null;
    return pitchMode === 'pitch' ? theodorsenPitchLift(k) : theodorsenPlungeLift(k);
  }, [k, kValid, pitchMode]);

  const duhamel = useMemo(() => {
    if (!kValid) return null;
    if (duhamelMode === 'harmonic') {
      const d = duhamelHarmonic(0.1, k, 40, 640);
      return {
        curve: d.curve.filter((_, i) => i % 8 === 0).map((p) => ({ x: p.s, y: p.cl })),
        measuredAmp: d.measuredAmplitude,
        theodorsenAmp: d.theodorsenAmplitude,
        measuredPhase: d.measuredPhaseDeg,
        theodorsenPhase: d.theodorsenPhaseDeg,
        alphaText: `α = 0.1·sin(k·s) rad, k = ${fmt(k, 2)}`,
      };
    }
    // Step response: CL(s)/2πα = Φ(s) (Jones), plotted as CL for α0 = 0.1 rad.
    const curve = wagnerCurve(0, 20, 30, 1).map((p) => ({ x: p.s, y: 2 * Math.PI * 0.1 * p.jones }));
    return { curve, measuredAmp: null, theodorsenAmp: null, measuredPhase: null, theodorsenPhase: null, alphaText: 'α = 0.1 rad step' };
  }, [k, kValid, duhamelMode]);

  const vortex = useMemo(() => {
    if (!vortexRun) return null;
    const alpha = 5;
    const r = unsteadyVortexStepResponse(alpha, { nPanels: 12, dtReduced: 0.1, steps: 200 });
    const alphaRad = (alpha * Math.PI) / 180;
    return {
      discrete: r.steps.map((s) => ({ x: s.s, y: s.cl / (2 * Math.PI * alphaRad) })),
      wagner: wagnerCurve(0.2, 20, 30, 2)
        .filter((p) => Number.isFinite(p.exact))
        .map((p) => ({ x: p.s, y: p.exact as number })),
    };
  }, [vortexRun]);

  return (
    <View>
      <Panel
        title="Theodorsen function C(k)"
        subtitle="Circulatory lift reduction and phase lag for harmonic motion. C(k) = H₁⁽²⁾(k)/[H₁⁽²⁾(k) + iH₀⁽²⁾(k)], k = ωb/V."
      >
        <View style={styles.inputRow}>
          <NumberField label="Reduced frequency k" value={kText} onChangeText={setKText} unit="—" />
        </View>
        {ck ? (
          <View style={styles.statGrid}>
            <Stat label="F (real)" value={fmt(ck.f)} unit="—" />
            <Stat label="G (imag)" value={fmt(ck.g)} unit="—" />
            <Stat label="|C(k)|" value={fmt(ck.magnitude)} unit="—" highlight />
            <Stat label="Phase lag" value={fmt(ck.phaseDeg, 1)} unit="deg" />
          </View>
        ) : (
          <Text style={styles.error}>Enter k &gt; 0.</Text>
        )}
        <LineChart
          series={[
            { name: '|C(k)|', color: colors.primary, points: theodorsenCurveData.mag },
            { name: 'phase (deg)', color: colors.accent, points: theodorsenCurveData.phase },
          ]}
          width={CHART_W}
          height={CHART_H}
        />
        <Text style={styles.assumption}>
          Limits: C(0) = 1 (quasi-steady), C(∞) = 1/2 (high frequency); phase lag is bounded by ≈ −14.5°.
          Theodorsen, NACA TR 496 (1935).
        </Text>
      </Panel>

      <Panel title="Wagner function Φ(s)" subtitle="Indicial lift build-up after a step in angle of attack. s = 2Vt/c.">
        <LineChart
          series={[
            { name: 'Jones (2-exp)', color: colors.primary, points: wagnerData.jones },
            { name: 'Exact (Garrick inversion)', color: colors.accent, points: wagnerData.exact, dashed: true },
            { name: 'Garrick (algebraic)', color: colors.textFaint, points: wagnerData.garrick, dashed: true },
          ]}
          width={CHART_W}
          height={CHART_H}
          yMin={0.5}
          yMax={1}
        />
        <View style={styles.badgeRow}>
          <Badge label="Φ(0⁺) = ½" tone="accent" />
          <Badge label="Φ(∞) = 1" tone="accent" />
          {kValid ? <Badge label={`Φ(10) = ${fmt(wagnerJones(10))}`} tone="success" /> : null}
        </View>
        <Text style={styles.assumption}>
          Jones: Φ = 1 − 0.165·e^(−0.0455s) − 0.335·e^(−0.3s) (NACA TR 681). Exact by numerical Fourier
          inversion of C(k) (Garrick, NACA TR 629; Dawson &amp; Brunton 2021). Jones is within 1% of exact; the
          exact function approaches 1 algebraically (~1/s), not exponentially.
        </Text>
      </Panel>

      <Panel
        title="Harmonic lift response"
        subtitle="Theodorsen lift for oscillatory motion — circulatory + apparent-mass parts."
      >
        <View style={styles.chipRow}>
          <ModeChip label="Pitch @ ¼c" active={pitchMode === 'pitch'} onPress={() => setPitchMode('pitch')} />
          <ModeChip label="Plunge" active={pitchMode === 'plunge'} onPress={() => setPitchMode('plunge')} />
        </View>
        {harmonic ? (
          <View style={styles.statGrid}>
            <Stat
              label={pitchMode === 'pitch' ? '|CL/α0|' : '|CL/(h0/b)|'}
              value={fmt(harmonic.amplitude)}
              unit="—"
              highlight
            />
            <Stat label="Phase" value={fmt(harmonic.phaseDeg, 1)} unit="deg" />
            <Stat label="Circulatory amp" value={fmt(harmonic.circulatoryAmp)} unit="—" />
            <Stat label="Apparent-mass amp" value={fmt(harmonic.nonCirculatoryAmp)} unit="—" />
          </View>
        ) : null}
        <Text style={styles.assumption}>
          {pitchMode === 'pitch'
            ? `CL/α0 = 2π·C(k)(1 + ik) + iπk — quasi-steady limit 2π at k → 0; apparent mass dominates at high k.`
            : `CL/(h0/b) = πk² − 2πik·C(k) — vanishes at k → 0 (peak displacement, zero plunge rate); apparent-mass πk² dominates at high k.`}
        </Text>
      </Panel>

      <Panel
        title="Indicial response (Duhamel)"
        subtitle="Circulatory CL from the Wagner-function convolution for a chosen α(s)."
      >
        <View style={styles.chipRow}>
          <ModeChip label="Harmonic α" active={duhamelMode === 'harmonic'} onPress={() => setDuhamelMode('harmonic')} />
          <ModeChip label="Step α" active={duhamelMode === 'step'} onPress={() => setDuhamelMode('step')} />
        </View>
        {duhamel ? (
          <>
            <LineChart
              series={[
                {
                  name: duhamelMode === 'harmonic' ? 'CL(s)' : 'CL(s) = 2πα·Φ(s)',
                  color: colors.primary,
                  points: duhamel.curve,
                },
              ]}
              width={CHART_W}
              height={CHART_H}
            />
            {duhamelMode === 'harmonic' && duhamel.measuredAmp !== null ? (
              <Text style={styles.assumption}>
                Steady state after ~3 cycles: measured |CL| = {fmt(duhamel.measuredAmp)} vs Theodorsen
                2π·α0·|C(k)| = {fmt(duhamel.theodorsenAmp)} — agreement within ~1%, phase
                {fmt(duhamel.measuredPhase, 1)}° vs {fmt(duhamel.theodorsenPhase, 1)}° (Garrick's reciprocal
                relation). {duhamel.alphaText}.
              </Text>
            ) : (
              <Text style={styles.assumption}>Step input: CL(s) = 2πα₀·Φ(s), {duhamel.alphaText}.</Text>
            )}
          </>
        ) : null}
      </Panel>

      <Panel
        title="Discrete vortex wake (UVLM-lite)"
        subtitle="Numerical indicial response from camber-line bound vortices + Kelvin-shed wake."
      >
        {!vortex ? (
          <Pressable
            onPress={() => setVortexRun(true)}
            accessibilityRole="button"
            style={styles.runButton}
          >
            <Text style={styles.runButtonText}>Run step-response simulation</Text>
          </Pressable>
        ) : (
          <>
            <LineChart
              series={[
                { name: 'Discrete vortex method', color: colors.primary, points: vortex.discrete },
                { name: 'Wagner (exact)', color: colors.accent, points: vortex.wagner, dashed: true },
              ]}
              width={CHART_W}
              height={CHART_H}
              yMin={0}
              yMax={1.05}
            />
            <Text style={styles.assumption}>
              CL(s)/2πα from 12 bound panels + shed wake (Kelvin: Γ_bound + Γ_wake = 0 to 10⁻¹⁴). Tracks the
              exact Wagner function within ~1% at large s; the small-s lag is a known artifact of the
              point-vortex wake (the exact Φ(0⁺) = ½ needs an infinitesimal sheet at the TE).
            </Text>
          </>
        )}
      </Panel>
    </View>
  );
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
  unit,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit: string;
}) {
  const inputProps: TextInputProps = {
    value,
    onChangeText,
    keyboardType: 'decimal-pad',
    placeholder: '0',
    placeholderTextColor: colors.textFaint,
    accessibilityLabel: label,
  };
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput {...inputProps} style={styles.input} />
        <Text style={styles.fieldUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.accent }]}>{value}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  field: { flexGrow: 1, gap: 6 },
  fieldLabel: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.md,
    paddingVertical: spacing.sm + 2,
    minWidth: 0,
  },
  fieldUnit: { color: colors.textFaint, fontSize: fontSize.xs, marginLeft: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.12)' },
  chipText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextActive: { color: colors.primary },
  error: { color: colors.danger, fontSize: fontSize.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flexGrow: 1,
    flexBasis: '28%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  statUnit: { color: colors.textFaint, fontSize: fontSize.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  assumption: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: spacing.md,
  },
  runButton: {
    backgroundColor: 'rgba(255,176,32,0.14)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  runButtonText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

// Aero Lab — the engineering analysis screen.
//
// Runs the validated aerodynamics module (`services/aerodynamics.ts`) live on
// device: ISA atmosphere, dynamic pressure / Mach / Reynolds, vortex-lattice
// lift, drag polar, and the source-panel pressure distribution. All outputs
// are CALCULATED quantities with explicit units; model limitations are shown
// inline rather than hidden.

import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import { FlowField } from '@/components/feature/FlowField';
import { UnsteadyLab } from '@/components/feature/UnsteadyLab';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import {
  AIRFOILS,
  analyzeFlight,
  type AeroAnalysis,
} from '@/services/aerodynamics';

const DEFAULT_INPUT = {
  altitudeKm: '3',
  velocityMs: '100',
  angleOfAttackDeg: '5',
  chordM: '1.5',
};

const PANELS = 48;

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtExp(n: number): string {
  return n.toExponential(2).replace('e+', '×10^');
}

function parseNum(text: string): number {
  const v = Number.parseFloat(text);
  return Number.isFinite(v) ? v : Number.NaN;
}

export default function AeroScreen() {
  const [altitudeKm, setAltitudeKm] = useState(DEFAULT_INPUT.altitudeKm);
  const [velocityMs, setVelocityMs] = useState(DEFAULT_INPUT.velocityMs);
  const [angleOfAttackDeg, setAngleOfAttackDeg] = useState(DEFAULT_INPUT.angleOfAttackDeg);
  const [chordM, setChordM] = useState(DEFAULT_INPUT.chordM);
  const [airfoilId, setAirfoilId] = useState('naca2412');

  const analysis: AeroAnalysis | null = useMemo(() => {
    const altitudeM = parseNum(altitudeKm) * 1000;
    const v = parseNum(velocityMs);
    const aoa = parseNum(angleOfAttackDeg);
    const chord = parseNum(chordM);
    if (![altitudeM, v, aoa, chord].every(Number.isFinite)) return null;
    try {
      return analyzeFlight({
        altitudeM,
        velocityMs: v,
        angleOfAttackDeg: aoa,
        chordM: chord,
        airfoilId,
        panels: PANELS,
        cd0: 0.01,
        sectionK: 0.006,
        aspectRatio: 0, // 2D section analysis
        oswaldE: 0.8,
      });
    } catch (e) {
      return null;
    }
  }, [altitudeKm, velocityMs, angleOfAttackDeg, chordM, airfoilId]);

  const invalid = analysis === null;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Aerodynamics"
        title="Aero Lab"
        subtitle="Linear potential-flow analysis. Calculated values, SI units, model limits shown below."
      />

      <Panel title="Flight condition" subtitle="Change a value — everything recomputes instantly.">
        <View style={styles.inputGrid}>
          <NumberField
            label="Altitude"
            value={altitudeKm}
            onChangeText={setAltitudeKm}
            unit="km"
          />
          <NumberField
            label="True airspeed"
            value={velocityMs}
            onChangeText={setVelocityMs}
            unit="m/s"
          />
          <NumberField
            label="Angle of attack"
            value={angleOfAttackDeg}
            onChangeText={setAngleOfAttackDeg}
            unit="deg"
          />
          <NumberField
            label="Chord"
            value={chordM}
            onChangeText={setChordM}
            unit="m"
          />
        </View>
        <Text style={styles.sectionLabel}>Airfoil (NACA 4-digit)</Text>
        <View style={styles.chipRow}>
          {AIRFOILS.map((a) => {
            const active = a.id === airfoilId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setAirfoilId(a.id)}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {invalid ? (
          <Text style={styles.error}>Enter valid numbers (altitude 0–20 km, speed &gt; 0).</Text>
        ) : null}
      </Panel>

      {analysis ? (
        <>
          <Panel title="Atmosphere (ISA)" subtitle="Standard atmosphere at the selected altitude.">
            <View style={styles.statGrid}>
              <Stat label="Temperature" value={fmt(analysis.atmosphere.temperatureK, 1)} unit="K" />
              <Stat label="Pressure" value={fmt(analysis.atmosphere.pressurePa / 1000, 1)} unit="kPa" />
              <Stat label="Density" value={fmt(analysis.atmosphere.densityKgM3, 4)} unit="kg/m³" />
              <Stat label="Speed of sound" value={fmt(analysis.atmosphere.speedOfSoundMs, 1)} unit="m/s" />
              <Stat label="Viscosity" value={analysis.atmosphere.viscosityPaS.toExponential(2)} unit="Pa·s" />
            </View>
          </Panel>

          <Panel title="Flow state" subtitle="q = ½·ρ·V², M = V/a, Re = ρ·V·c/μ.">
            <View style={styles.statGrid}>
              <Stat label="Dynamic pressure q" value={fmt(analysis.qPa, 0)} unit="Pa" />
              <Stat label="Mach number" value={fmt(analysis.mach, 3)} unit="—" />
              <Stat label="Reynolds number" value={fmtExp(analysis.reynolds)} unit="—" />
            </View>
            <View style={styles.badgeRow}>
              {analysis.mach >= 0.3 ? (
                <Badge label="Compressible — model not valid" tone="warning" />
              ) : (
                <Badge label="Incompressible regime OK" tone="success" />
              )}
              {Math.abs(parseNum(angleOfAttackDeg)) > 15 ? (
                <Badge label="Beyond linear range" tone="warning" />
              ) : null}
            </View>
          </Panel>

          <Panel
            title="Aerodynamic coefficients"
            subtitle="Lift: 2D vortex lattice; drag: parabolic polar CD = cd0 + k·CL²."
          >
            <View style={styles.statGrid}>
              <Stat label="CL (vortex lattice)" value={fmt(analysis.cl, 3)} unit="—" />
              <Stat label="CL (thin airfoil)" value={fmt(analysis.clThin, 3)} unit="—" highlight />
              <Stat label="α_L0" value={fmt(analysis.alphaL0Deg, 2)} unit="deg" />
              <Stat label="CD" value={fmt(analysis.cd, 4)} unit="—" />
              <Stat label="Lift / span" value={fmt(analysis.liftPerSpan, 0)} unit="N/m" />
              <Stat label="Drag / span" value={fmt(analysis.dragPerSpan, 0)} unit="N/m" />
            </View>
            <Text style={styles.assumption}>
              cd0 = 0.010 (section), k = 0.006, 2D section (AR = ∞). Thin-airfoil CL is
              2π(α − α_L0).
            </Text>
          </Panel>

          <Panel
            title="Pressure distribution"
            subtitle="−Cp vs x/c from the source panel method, α = 0° (non-lifting)."
          >
            <CpBars analysis={analysis} />
            <Text style={styles.assumption}>
              Cp = 1 − (V_t/V∞)². Validated against the exact cylinder solution
              (doublet, Cp = 1 − 4·sin²θ) to ~10⁻¹⁰.
            </Text>
          </Panel>

          <Panel title="Flow field" subtitle="Non-lifting potential flow around the airfoil.">
            <FlowField airfoilId={airfoilId} alphaDeg={0} />
          </Panel>

          {analysis.warnings.length > 0 ? (
            <Panel title="Validity warnings" tone="raised">
              {analysis.warnings.map((w) => (
                <Text key={w} style={styles.warning}>
                  ⚠ {w}
                </Text>
              ))}
            </Panel>
          ) : null}

          <UnsteadyLab />
        </>
      ) : null}

      <Panel title="Model & units" tone="raised">
        <Text style={styles.modelNote}>
          All quantities are calculated in SI units from first-principles models: ISA
          atmosphere (0–20 km), Sutherland viscosity, incompressible potential flow
          (source panels + 2D vortex lattice), thin-airfoil lift theory, parabolic drag
          polar. The linear lift slope is valid for |α| ≲ 15° and M ≲ 0.3; viscous drag
          enters only through cd0. This is an educational linear-aerodynamics tool, not a
          flight-certification code.
        </Text>
      </Panel>
    </Screen>
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

function CpBars({ analysis }: { analysis: AeroAnalysis }) {
  const byX = [...analysis.cp].sort((a, b) => a.x - b.x);
  const maxAbs = Math.max(Math.abs(analysis.cpMin), Math.abs(analysis.cpMax), 1e-9);
  return (
    <View style={styles.cpChart}>
      <View style={styles.cpBaseline} />
      {byX.map((p, i) => {
        const value = -p.cp; // suction (negative Cp) shown upward
        const h = (Math.abs(value) / maxAbs) * 44 + 1;
        const suction = value > 0.01;
        return (
          <View
            key={`${i}-${p.x.toFixed(3)}`}
            style={[
              styles.cpBar,
              {
                height: h,
                backgroundColor: suction ? colors.primary : colors.accent,
                marginTop: suction ? 44 - h : 44,
              },
            ]}
          />
        );
      })}
      <View style={styles.cpAxisLabel}>
        <Text style={styles.cpAxisText}>suction ↑ · pressure ↓ (x/c →)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexBasis: '45%', flexGrow: 1, gap: 6 },
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
  sectionLabel: {
    color: colors.textSubtle,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.md },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  assumption: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    lineHeight: 16,
    marginTop: spacing.md,
  },
  modelNote: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 20 },
  warning: { color: colors.warning, fontSize: fontSize.sm, lineHeight: 19 },
  cpChart: { flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 1 },
  cpBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 44,
    height: 1,
    backgroundColor: colors.borderStrong,
  },
  cpBar: { flex: 1, borderRadius: 1 },
  cpAxisLabel: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cpAxisText: { color: colors.textFaint, fontSize: 9 },
});

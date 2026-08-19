// Powered by OnSpace.AI
// Aero Lab: a live potential-flow workbench built on the validated
// services/aero modules - NACA 4-digit geometry, source+vortex panel
// method (Cp, CL), and unsteady aerodynamics (Theodorsen, Wagner).
// All numbers are computed on device; the mathematics is cross-validated
// against benchmarks in scripts/validate_aero.py.

import Slider from '@react-native-community/slider';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { AeroChart, type AeroSeries } from '@/components/feature/AeroChart';
import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { generateAirfoil } from '@/services/aero/airfoil';
import { buildPanels, solvePanelMethod } from '@/services/aero/panel';
import { theodorsenLiftDeficiency, wagnerJones } from '@/services/aero/unsteady';

const NACA_PRESETS = ['0012', '2412', '4415', '23012', '0006'];
const PANELS = 120;
const THIN_SLOPE = 2 * Math.PI;
const ALPHA_MAX = 10;

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]} hitSlop={4}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function AirfoilPreview({ points }: { points: Array<{ x: number; y: number }> }) {
  const [width, setWidth] = useState(0);
  const height = 120;
  const pad = 10;
  const plotW = Math.max(width - pad * 2, 1);
  const plotH = height - pad * 2;
  const px = (x: number) => pad + x * plotW;
  const py = (y: number) => pad + (0.15 - y) * (plotH / 0.3);
  const path = points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Line
            x1={px(0)}
            y1={py(0)}
            x2={px(1)}
            y2={py(0)}
            stroke={colors.borderStrong}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <Polyline points={path} fill="none" stroke={colors.primary} strokeWidth={1.6} />
        </Svg>
      )}
    </View>
  );
}

export default function AeroScreen() {
  const [codeDraft, setCodeDraft] = useState('0012');
  const [alpha, setAlpha] = useState(0);
  const code = /^\d{4}$/.test(codeDraft) ? codeDraft : '0012';

  // Main solve: geometry + panel method at the current angle of attack.
  const model = useMemo(() => {
    const points = generateAirfoil(code, PANELS);
    const geom = buildPanels(points);
    const sol = solvePanelMethod(geom, alpha);
    return { points, geom, sol };
  }, [code, alpha]);

  // Cp split into upper/lower surfaces, sorted by chord station.
  const cpSeries = useMemo(() => {
    const n = model.geom.xc.length;
    const upper: Array<[number, number]> = [];
    const lower: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
      const x = model.geom.xc[i];
      const y = -model.sol.cp[i];
      (i < n / 2 ? upper : lower).push([x, y]);
    }
    upper.sort((a, b) => a[0] - b[0]);
    lower.sort((a, b) => a[0] - b[0]);
    return { upper, lower };
  }, [model]);

  // Lift curve: panel method vs thin-airfoil theory.
  const liftCurve = useMemo(() => {
    const points = generateAirfoil(code, PANELS);
    const geom = buildPanels(points);
    const curve: Array<[number, number]> = [];
    for (let a = -ALPHA_MAX; a <= ALPHA_MAX + 0.001; a += 2.5) {
      curve.push([a, solvePanelMethod(geom, a).cl]);
    }
    const thin: Array<[number, number]> = [];
    for (let a = -ALPHA_MAX; a <= ALPHA_MAX + 0.001; a += 1) {
      thin.push([a, THIN_SLOPE * Math.sin((a * Math.PI) / 180)]);
    }
    return { curve, thin };
  }, [code]);

  // Unsteady: Theodorsen deficiency |C(k)| and Wagner indicial w(s).
  const unsteady = useMemo(() => {
    const def: Array<[number, number]> = [];
    for (let i = 0; i <= 30; i += 1) {
      const k = 0.05 + (i * 1.45) / 30;
      def.push([k, theodorsenLiftDeficiency(k).ratio]);
    }
    const wagner: Array<[number, number]> = [];
    for (let i = 0; i <= 20; i += 1) {
      const s = (i * 10) / 20;
      wagner.push([s, wagnerJones(s)]);
    }
    const at03 = theodorsenLiftDeficiency(0.3);
    return { def, wagner, at03, w1: wagnerJones(1), w5: wagnerJones(5) };
  }, []);

  const { sol } = model;
  const kuttaResidual = Math.abs(sol.vt[0] + sol.vt[sol.vt.length - 1]);

  const cpChartSeries: AeroSeries[] = [
    { points: cpSeries.upper, color: colors.primary },
    { points: cpSeries.lower, color: colors.accent },
  ];
  const liftChartSeries: AeroSeries[] = [
    { points: liftCurve.thin, color: colors.textFaint, dashed: true },
    { points: liftCurve.curve, color: colors.primary },
  ];
  const defChartSeries: AeroSeries[] = [
    { points: [[0, 1], [1.5, 1]], color: colors.textFaint, dashed: true },
    { points: [[0, 0.5], [1.5, 0.5]], color: colors.textFaint, dashed: true },
    { points: unsteady.def, color: colors.primary },
  ];
  const wagnerChartSeries: AeroSeries[] = [
    { points: [[0, 1], [10, 1]], color: colors.textFaint, dashed: true },
    { points: [[0, 0.5], [10, 0.5]], color: colors.textFaint, dashed: true },
    { points: unsteady.wagner, color: colors.accent },
  ];

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Aero Lab"
        title="Potential Flow"
        subtitle="Panel method, Cp, CL, Theodorsen and Wagner — computed live on device."
        right={<Badge label={code} tone="primary" />}
      />

      <Panel
        title="Airfoil"
        subtitle="NACA 4-digit section geometry"
        right={
          <TextInput
            value={codeDraft}
            onChangeText={setCodeDraft}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="2412"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        }
      >
        <View style={styles.chips}>
          {NACA_PRESETS.map((p) => (
            <Chip key={p} label={p} selected={code === p} onPress={() => setCodeDraft(p)} />
          ))}
        </View>
        <AirfoilPreview points={model.points} />
      </Panel>

      <Panel
        title="Angle of attack"
        right={<Text style={styles.alphaValue}>{alpha.toFixed(1)}°</Text>}
      >
        <Slider
          minimumValue={-ALPHA_MAX}
          maximumValue={ALPHA_MAX}
          step={0.5}
          value={alpha}
          onValueChange={setAlpha}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderStrong}
          thumbTintColor={colors.primary}
        />
      </Panel>

      <Panel
        title="Pressure distribution"
        subtitle={`−Cp vs x/c at α = ${alpha.toFixed(1)}°`}
      >
        <AeroChart series={cpChartSeries} xDomain={[0, 1]} height={190} />
        <View style={styles.legend}>
          <Text style={styles.legendKey}>
            <Text style={{ color: colors.primary }}>■</Text> upper{'  '}
            <Text style={{ color: colors.accent }}>■</Text> lower
          </Text>
        </View>
        <View style={styles.stats}>
          <Stat label="CL" value={sol.cl.toFixed(3)} color={colors.primary} />
          <Stat label="Stag. Cp" value={Math.max(...sol.cp).toFixed(3)} color={colors.accent} />
          <Stat label="Kutta res." value={kuttaResidual.toExponential(1)} color={colors.textSubtle} />
        </View>
      </Panel>

      <Panel title="Lift curve" subtitle="CL vs α: panel method (solid) vs thin-airfoil 2π (dashed)">
        <AeroChart
          series={liftChartSeries}
          xDomain={[-ALPHA_MAX, ALPHA_MAX]}
          height={190}
          formatYTick={(v) => v.toFixed(1)}
        />
      </Panel>

      <Panel title="Unsteady" subtitle="Theodorsen's lift deficiency and Wagner's indicial response">
        <Text style={styles.chartCaption}>|C(k)| — harmonic lift deficiency vs reduced frequency</Text>
        <AeroChart series={defChartSeries} xDomain={[0, 1.5]} yDomain={[0.4, 1.05]} height={150} />
        <View style={styles.stats}>
          <Stat label="|C(0.3)|" value={unsteady.at03.ratio.toFixed(3)} color={colors.primary} />
          <Stat
            label="Phase lag"
            value={`${unsteady.at03.phaseDeg.toFixed(1)}°`}
            color={colors.accent}
          />
        </View>

        <Text style={styles.chartCaption}>w(s) — lift ratio after a step in angle of attack</Text>
        <AeroChart series={wagnerChartSeries} xDomain={[0, 10]} yDomain={[0.4, 1.05]} height={150} />
        <View style={styles.stats}>
          <Stat label="w(1)" value={unsteady.w1.toFixed(3)} color={colors.primary} />
          <Stat label="w(5)" value={unsteady.w5.toFixed(3)} color={colors.accent} />
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    width: 64,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,176,32,0.14)',
  },
  chipText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  chipTextSelected: { color: colors.primary },
  alphaValue: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  legend: { marginTop: spacing.xs, alignItems: 'flex-end' },
  legendKey: { color: colors.textFaint, fontSize: fontSize.xs },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  stat: { flex: 1 },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: 2 },
  statValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  chartCaption: {
    color: colors.textSubtle,
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
});

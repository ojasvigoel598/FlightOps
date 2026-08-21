// Aero Lab: a live potential-flow workbench built on the validated
// services/aero modules - panel method (Cp, CL), and unsteady aerodynamics
// (Theodorsen, Wagner). All numbers are computed on device.
//
// Now with XFoil/UIUC database integration — search any airfoil by name.

import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { AeroChart, type AeroSeries } from '@/components/feature/AeroChart';
import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { generateAirfoil, type AirfoilPoint } from '@/services/aero/airfoil';
import { buildPanels, solvePanelMethod } from '@/services/aero/panel';
import { theodorsenLiftDeficiency, wagnerJones } from '@/services/aero/unsteady';
import {
  searchAirfoils,
  fetchAirfoilCoords,
  detectFamily,
  type AirfoilEntry,
  type AirfoilCoords,
} from '@/services/aero/xfoil';

const PANELS = 120;
const THIN_SLOPE = 2 * Math.PI;
const ALPHA_MAX = 10;

// ---------------------------------------------------------------------------
// Quick-select presets (families)
// ---------------------------------------------------------------------------

const FAMILY_PRESETS = [
  { label: 'NACA 0012', code: 'naca0012' },
  { label: 'NACA 2412', code: 'naca2412' },
  { label: 'NACA 4412', code: 'naca4412' },
  { label: 'Clark Y', code: 'clarky' },
  { label: 'Eppler 387', code: 'e387' },
  { label: 'RAE 2822', code: 'rae2822' },
  { label: 'Selig 1210', code: 's1210' },
  { label: 'Wortmann', code: 'fx60100' },
];

// ---------------------------------------------------------------------------
// Stat component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Airfoil shape preview (SVG)
// ---------------------------------------------------------------------------

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
            x1={px(0)} y1={py(0)} x2={px(1)} y2={py(0)}
            stroke={colors.borderStrong} strokeWidth={1} strokeDasharray="4 4"
          />
          <Polyline points={path} fill="none" stroke={colors.primary} strokeWidth={1.6} />
        </Svg>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AeroScreen() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AirfoilEntry[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedName, setSelectedName] = useState('naca0012');
  const [selectedDisplayName, setSelectedDisplayName] = useState('NACA 0012');
  const [isLoading, setIsLoading] = useState(false);
  const [xfoilCoords, setXfoilCoords] = useState<AirfoilCoords | null>(null);
  const [alpha, setAlpha] = useState(0);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const results = searchAirfoils(searchQuery);
    setSearchResults(results);
    setShowResults(results.length > 0);
  }, [searchQuery]);

  // Select an airfoil from search results
  const selectAirfoil = useCallback(async (entry: AirfoilEntry) => {
    setSelectedName(entry.name);
    setSelectedDisplayName(entry.displayName);
    setSearchQuery('');
    setShowResults(false);
    setIsLoading(true);

    try {
      const coords = await fetchAirfoilCoords(entry.name);
      setXfoilCoords(coords);
    } catch {
      setXfoilCoords(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select from quick presets
  const selectPreset = useCallback(async (name: string) => {
    setSelectedName(name);
    const entry = searchAirfoils(name)[0];
    setSelectedDisplayName(entry?.displayName ?? name);
    setIsLoading(true);

    try {
      const coords = await fetchAirfoilCoords(name);
      setXfoilCoords(coords);
    } catch {
      setXfoilCoords(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate airfoil geometry for panel method
  // If we have XFoil coords, use them; otherwise generate NACA
  const points = useMemo(() => {
    if (xfoilCoords && xfoilCoords.all.length > 10) {
      return xfoilCoords.all;
    }
    // For NACA 4-digit codes, generate locally
    if (/^\d{4}$/.test(selectedName.replace('naca', ''))) {
      return generateAirfoil(selectedName.replace('naca', ''), PANELS);
    }
    // For XFoil names, try to use the coords
    if (xfoilCoords && xfoilCoords.all.length > 0) {
      return xfoilCoords.all;
    }
    // Fallback to NACA 0012
    return generateAirfoil('0012', PANELS);
  }, [selectedName, xfoilCoords]);

  // Panel method solve
  const model = useMemo(() => {
    if (points.length < 5) {
      // Not enough points for panel method
      return null;
    }
    const geom = buildPanels(points);
    const sol = solvePanelMethod(geom, alpha);
    return { points, geom, sol };
  }, [points, alpha]);

  // Cp series
  const cpSeries = useMemo(() => {
    if (!model) return { upper: [], lower: [] };
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

  // Lift curve
  const liftCurve = useMemo(() => {
    if (!model) return { curve: [], thin: [] };
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
  }, [points]);

  // Unsteady
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

  const sol = model?.sol;
  const kuttaResidual = sol ? Math.abs(sol.vt[0] + sol.vt[sol.vt.length - 1]) : 0;

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

  const family = detectFamily(selectedName);

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Aero Lab"
        title="Airfoil Database"
        subtitle="Search XFoil/UIUC — any airfoil, panel method, Cp, CL, Theodorsen."
        right={<Badge label={family} tone="primary" />}
      />

      {/* XFoil Search Bar */}
      <Panel
        title="🔍 Search Airfoils"
        subtitle="Type to search the XFoil/UIUC database (100+ airfoils)"
      >
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text.length > 0) setShowResults(true);
            }}
            placeholder="Search: Clark Y, Eppler 387, Wortmann, Selig..."
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(''); setShowResults(false); }} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <View style={styles.resultsDropdown}>
            <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
              {searchResults.slice(0, 15).map((entry) => (
                <Pressable
                  key={entry.name}
                  style={[styles.resultItem, selectedName === entry.name && styles.resultItemActive]}
                  onPress={() => selectAirfoil(entry)}
                >
                  <Text style={styles.resultName}>{entry.displayName}</Text>
                  <Text style={styles.resultFamily}>{detectFamily(entry.name)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {showResults && searchResults.length === 0 && searchQuery.length > 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No airfoils found for "{searchQuery}"</Text>
          </View>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Fetching from UIUC database...</Text>
          </View>
        )}

        {/* Current selection */}
        <View style={styles.currentSelection}>
          <Text style={styles.currentLabel}>Selected:</Text>
          <Text style={styles.currentName}>{selectedDisplayName}</Text>
          <Badge label={family} tone="accent" />
        </View>
      </Panel>

      {/* Quick presets */}
      <Panel title="⚡ Quick Select" subtitle="Popular airfoils from different families.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FAMILY_PRESETS.map((p) => (
            <Chip
              key={p.code}
              label={p.label}
              selected={selectedName === p.code}
              onPress={() => selectPreset(p.code)}
            />
          ))}
        </ScrollView>
      </Panel>

      {/* Airfoil preview */}
      <Panel title="📐 Airfoil Shape" subtitle={`${selectedDisplayName} — ${points.length} points`}>
        <AirfoilPreview points={points} />
      </Panel>

      {/* Angle of attack */}
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

      {/* Pressure distribution */}
      {model && (
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
            <Stat label="CL" value={sol!.cl.toFixed(3)} color={colors.primary} />
            <Stat label="Stag. Cp" value={Math.max(...sol!.cp).toFixed(3)} color={colors.accent} />
            <Stat label="Kutta res." value={kuttaResidual.toExponential(1)} color={colors.textSubtle} />
          </View>
        </Panel>
      )}

      {/* Lift curve */}
      <Panel title="Lift curve" subtitle="CL vs α: panel method (solid) vs thin-airfoil 2π (dashed)">
        <AeroChart
          series={liftChartSeries}
          xDomain={[-ALPHA_MAX, ALPHA_MAX]}
          height={190}
          formatYTick={(v) => v.toFixed(1)}
        />
      </Panel>

      {/* Unsteady */}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Search
  searchContainer: { position: 'relative', flexDirection: 'row', alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fontSize.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  clearBtn: {
    position: 'absolute', right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  // Results dropdown
  resultsDropdown: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    maxHeight: 200,
    overflow: 'hidden',
  },
  resultsScroll: { maxHeight: 200 },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultItemActive: { backgroundColor: 'rgba(255,176,32,0.1)' },
  resultName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  resultFamily: { color: colors.textFaint, fontSize: fontSize.xs },
  noResults: { padding: spacing.md, alignItems: 'center' },
  noResultsText: { color: colors.textFaint, fontSize: fontSize.sm },
  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { color: colors.textFaint, fontSize: fontSize.xs },
  // Current selection
  currentSelection: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.sm, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  currentLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  currentName: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, flex: 1 },
  // Chips
  chips: { gap: spacing.sm },
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
  // Alpha
  alphaValue: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  // Charts
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

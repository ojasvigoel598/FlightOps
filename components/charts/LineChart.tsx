// LineChart — lightweight multi-series line chart for the Aero Lab curves.
//
// Renders with react-native-svg (works on web, iOS and Android). Data series
// are normalised to a fixed plot box; the y-axis labels are the caller's
// responsibility (kept minimal on purpose — this is an educational tool, not
// a charting library).

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { colors, fontSize, spacing } from '@/constants/theme';

export interface ChartSeries {
  /** display name (used in the legend) */
  name: string;
  color: string;
  points: { x: number; y: number }[];
  /** dashed strokes for comparison/reference curves */
  dashed?: boolean;
}

export interface LineChartProps {
  series: ChartSeries[];
  width: number;
  height: number;
  /** optional y-range; auto-scaled (with padding) when omitted */
  yMin?: number;
  yMax?: number;
  xMin?: number;
  xMax?: number;
  /** legend position */
  showLegend?: boolean;
}

const PAD_X = 6;
const PAD_Y = 10;
const LEGEND_H = 18;

export function LineChart({
  series,
  width,
  height,
  yMin,
  yMax,
  xMin,
  xMax,
  showLegend = true,
}: LineChartProps) {
  const plotH = showLegend ? height - LEGEND_H : height;

  let loX = Infinity;
  let hiX = -Infinity;
  let loY = Infinity;
  let hiY = -Infinity;
  for (const s of series) {
    for (const p of s.points) {
      if (p.x < loX) loX = p.x;
      if (p.x > hiX) hiX = p.x;
      if (p.y < loY) loY = p.y;
      if (p.y > hiY) hiY = p.y;
    }
  }
  const x0 = xMin ?? loX;
  const x1 = xMax ?? hiX;
  let y0 = yMin ?? loY;
  let y1 = yMax ?? hiY;
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const spanY = y1 - y0;
  y0 -= spanY * 0.08;
  y1 += spanY * 0.08;

  const sx = (x: number) => PAD_X + ((x - x0) / (x1 - x0 || 1)) * (width - 2 * PAD_X);
  const sy = (y: number) => PAD_Y + (1 - (y - y0) / (y1 - y0 || 1)) * (plotH - 2 * PAD_Y);

  return (
    <View>
      <Svg width={width} height={plotH}>
        {/* frame */}
        <Line x1={PAD_X} y1={plotH - PAD_Y} x2={width - PAD_X} y2={plotH - PAD_Y} stroke={colors.border} strokeWidth={1} />
        <Line x1={PAD_X} y1={PAD_Y} x2={PAD_X} y2={plotH - PAD_Y} stroke={colors.border} strokeWidth={1} />
        {series.map((s) => (
          <Polyline
            key={s.name}
            points={s.points.map((p) => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={1.6}
            strokeDasharray={s.dashed ? '4 3' : undefined}
          />
        ))}
      </Svg>
      {showLegend ? (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.name} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 10, height: 3, borderRadius: 1 },
  legendText: { color: colors.textFaint, fontSize: fontSize.xs },
});

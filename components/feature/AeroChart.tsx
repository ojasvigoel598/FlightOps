// Powered by OnSpace.AI
// Lightweight SVG line chart for aerodynamics plots (Cp, CL, |C(k)|, w(s)).
// No chart-library dependency: draws axes, "nice" gridlines and polylines
// with react-native-svg, matching the mission-control dark theme.

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/theme';

export interface AeroSeries {
  /** Data points as [x, y] pairs. */
  points: Array<[number, number]>;
  color: string;
  /** Render as a dashed reference line. */
  dashed?: boolean;
}

interface AeroChartProps {
  series: AeroSeries[];
  height?: number;
  xDomain?: [number, number];
  yDomain?: [number, number];
  xTicks?: number;
  yTicks?: number;
  formatYTick?: (v: number) => string;
}

const PAD = { left: 42, right: 12, top: 12, bottom: 26 };

/** "Nice" step size between tick marks (Heer's algorithm). */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

function ticksFor(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];
  const step = niceStep(max - min, count);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) {
    out.push(v);
  }
  return out;
}

const fmt = (v: number): string => {
  const s = v.toFixed(3);
  return s.replace(/\.?0+$/, '');
};

export function AeroChart({
  series,
  height = 180,
  xDomain,
  yDomain,
  xTicks = 4,
  yTicks = 4,
  formatYTick = fmt,
}: AeroChartProps) {
  const [width, setWidth] = useState(0);

  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const xMin = xDomain ? xDomain[0] : Math.min(...xs);
  const xMax = xDomain ? xDomain[1] : Math.max(...xs);
  const rawYMin = yDomain ? yDomain[0] : Math.min(...ys);
  const rawYMax = yDomain ? yDomain[1] : Math.max(...ys);
  const yPad = Math.max((rawYMax - rawYMin) * 0.08, 0.05);
  const yMin = rawYMin - yPad;
  const yMax = rawYMax + yPad;

  const plotW = Math.max(width - PAD.left - PAD.right, 1);
  const plotH = Math.max(height - PAD.top - PAD.bottom, 1);
  const sx = xMax - xMin || 1;
  const sy = yMax - yMin || 1;

  const px = (x: number) => PAD.left + ((x - xMin) / sx) * plotW;
  const py = (y: number) => PAD.top + ((yMax - y) / sy) * plotH;

  const yt = ticksFor(yMin, yMax, yTicks);
  const xt = ticksFor(xMin, xMax, xTicks);

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {yt.map((v) => (
            <Line
              key={`gy-${v}`}
              x1={PAD.left}
              y1={py(v)}
              x2={width - PAD.right}
              y2={py(v)}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          ))}
          {yt.map((v) => (
            <SvgText
              key={`ly-${v}`}
              x={PAD.left - 6}
              y={py(v) + 3}
              fill={colors.textFaint}
              fontSize={9}
              textAnchor="end"
            >
              {formatYTick(v)}
            </SvgText>
          ))}
          {xt.map((v) => (
            <SvgText
              key={`lx-${v}`}
              x={px(v)}
              y={height - 8}
              fill={colors.textFaint}
              fontSize={9}
              textAnchor="middle"
            >
              {fmt(v)}
            </SvgText>
          ))}
          {series.map((s, i) => (
            <Polyline
              key={`s-${i}`}
              points={s.points.map(([x, y]) => `${px(x)},${py(y)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 1.4 : 2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
            />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});

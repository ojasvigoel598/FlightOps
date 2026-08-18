// FlowField — velocity-vector plot of the non-lifting potential flow around
// the selected airfoil (freestream + source panels, the same solution that
// produces the Cp distribution). Every arrow is a real computed velocity —
// nothing decorative. Uses react-native-svg (web/native).

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { colors, fontSize, spacing } from '@/constants/theme';
import { AIRFOILS, nacaGeometry, velocityField } from '@/services/aerodynamics';

const W = 320;
const H = 180;
const XMIN = -1.4;
const XMAX = 2.2;
const YMIN = -1.2;
const YMAX = 1.2;

export function FlowField({ airfoilId, alphaDeg }: { airfoilId: string; alphaDeg: number }) {
  const data = useMemo(() => {
    const airfoil = AIRFOILS.find((a) => a.id === airfoilId) ?? AIRFOILS[0];
    const body = nacaGeometry(airfoil).points(48);
    const field = velocityField(body, alphaDeg, XMIN, XMAX, YMIN, YMAX, 21, 12);
    // Arrow scale: ~18% of the box height per unit velocity.
    const scale = 0.18 * H;
    const sx = (x: number) => ((x - XMIN) / (XMAX - XMIN)) * W;
    const sy = (y: number) => H - ((y - YMIN) / (YMAX - YMIN)) * H;
    const bodyPath = body
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`)
      .join(' ');
    return { field, scale, sx, sy, bodyPath };
  }, [airfoilId, alphaDeg]);

  const { field, scale, sx, sy, bodyPath } = data;

  return (
    <View>
      <Svg width={W} height={H}>
        {/* velocity arrows (shaft + short head) */}
        {field.map((p, i) => {
          const x0 = sx(p.x);
          const y0 = sy(p.y);
          const x1 = x0 + p.u * scale;
          const y1 = y0 - p.v * scale; // screen y is inverted
          const len = Math.hypot(x1 - x0, y1 - y0);
          if (len < 0.5) return null;
          const head = Math.min(4, len * 0.3);
          const ang = Math.atan2(y1 - y0, x1 - x0);
          const hx = x1 - head * Math.cos(ang);
          const hy = y1 - head * Math.sin(ang);
          return (
            <Line
              key={`s${i}`}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke={colors.accent}
              strokeWidth={1.1}
              opacity={0.85}
            />
          );
        })}
        {/* airfoil outline */}
        <Path d={bodyPath} fill="rgba(255,176,32,0.18)" stroke={colors.primary} strokeWidth={1.4} />
      </Svg>
      <Text style={styles.caption}>
        Velocity field (non-lifting, α = 0°): freestream + source panels, |v| scaled to arrow length.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16, marginTop: spacing.sm },
});

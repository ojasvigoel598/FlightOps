// Powered by OnSpace.AI
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { clamp } from '@/utils/math';

interface StatBarProps {
  label: string;
  value: number; // 0-100
  suffix?: string;
  hint?: string;
  invert?: boolean; // when true, low is good
}

function toneColor(value: number, invert?: boolean): string {
  const v = invert ? 100 - value : value;
  if (v >= 70) return colors.success;
  if (v >= 45) return colors.warning;
  return colors.danger;
}

export function StatBar({ label, value, suffix, hint, invert }: StatBarProps) {
  const pct = clamp(value, 0, 100);
  const tint = toneColor(value, invert);
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: tint }]}>
          {Math.round(value)}
          {suffix ?? ' / 100'}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tint }]} />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  label: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  value: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  hint: { color: colors.textFaint, fontSize: fontSize.xs },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import type { Telemetry } from '@/types/game';
import { clamp } from '@/utils/math';

interface TelemetryDeckProps {
  telemetry: Telemetry;
}

function tone(value: number) {
  if (value >= 60) return colors.success;
  if (value >= 30) return colors.warning;
  return colors.danger;
}

export function TelemetryDeck({ telemetry }: TelemetryDeckProps) {
  const progress = clamp(telemetry.progress, 0, 100);
  return (
    <View style={styles.wrap}>
      <View style={styles.routeRow}>
        <MaterialCommunityIcons name="airport" size={18} color={colors.textSubtle} />
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
          <View style={[styles.plane, { left: `${progress}%` }]}>
            <MaterialCommunityIcons name="airplane" size={18} color={colors.primary} />
          </View>
        </View>
        <MaterialCommunityIcons name="flag-checkered" size={18} color={colors.textSubtle} />
      </View>
      <Text style={styles.routeLabel}>{Math.round(progress)}% of route complete</Text>

      <View style={styles.gauges}>
        <Gauge icon="fuel" label="Fuel" value={telemetry.fuel} />
        <Gauge icon="shield-airplane" label="Integrity" value={telemetry.integrity} />
        <Gauge icon="engine" label="Engine" value={telemetry.engineHealth} />
      </View>
    </View>
  );
}

function Gauge({
  icon,
  label,
  value,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: number;
}) {
  const c = tone(value);
  return (
    <View style={styles.gauge}>
      <MaterialCommunityIcons name={icon} size={20} color={c} />
      <Text style={[styles.gaugeValue, { color: c }]}>{Math.round(value)}%</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    gap: spacing.md,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
  },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accentDim },
  plane: { position: 'absolute', marginLeft: -9 },
  routeLabel: { color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center' },
  gauges: { flexDirection: 'row', gap: spacing.sm },
  gauge: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  gaugeValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  gaugeLabel: { color: colors.textFaint, fontSize: fontSize.xs },
});

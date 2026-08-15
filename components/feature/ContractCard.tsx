// Powered by OnSpace.AI
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import type { Contract } from '@/types/game';
import { Badge } from '../ui/Badge';

const DIFF_TONE = {
  Routine: 'success',
  Standard: 'accent',
  Demanding: 'warning',
  Critical: 'danger',
} as const;

interface ContractCardProps {
  contract: Contract;
  active?: boolean;
  onPress: () => void;
}

export function ContractCard({ contract, active, onPress }: ContractCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.client}>{contract.client}</Text>
          <Text style={styles.title}>{contract.title}</Text>
        </View>
        <Badge label={contract.difficulty} tone={DIFF_TONE[contract.difficulty]} />
      </View>

      <View style={styles.metrics}>
        <Metric icon="weight-kilogram" value={`${contract.payloadKg} kg`} label="Payload" />
        <Metric icon="map-marker-distance" value={`${contract.distanceKm} km`} label="Distance" />
        <Metric icon="cash" value={`£${contract.reward}M`} label="Reward" highlight />
      </View>

      {active ? (
        <View style={styles.activeTag}>
          <MaterialCommunityIcons name="check-circle" size={14} color={colors.primary} />
          <Text style={styles.activeText}>Active contract</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Metric({
  icon,
  value,
  label,
  highlight,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <MaterialCommunityIcons
        name={icon}
        size={16}
        color={highlight ? colors.primary : colors.textSubtle}
      />
      <Text style={[styles.metricValue, highlight && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  active: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  client: {
    color: colors.accent,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: 2 },
  metrics: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'flex-start', gap: 2, flex: 1 },
  metricValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  metricLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import type { MissionEvent } from '@/types/game';

interface EventCardProps {
  event: MissionEvent;
  hasAi: boolean;
  onChoose: (key: string) => void;
}

export function EventCard({ event, hasAi, onChoose }: EventCardProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={event.icon as never} size={26} color={colors.danger} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.alert}>WARNING</Text>
          <Text style={styles.title}>{event.title}</Text>
        </View>
      </View>

      <Text style={styles.description}>{event.description}</Text>

      <View style={styles.diagnosis}>
        <MaterialCommunityIcons name="chart-line-variant" size={16} color={colors.accent} />
        <Text style={styles.diagnosisText}>{event.diagnosis}</Text>
      </View>

      {hasAi ? (
        <View style={styles.aiBanner}>
          <MaterialCommunityIcons name="robot" size={16} color={colors.primary} />
          <Text style={styles.aiText}>
            AI Co-Pilot recommends:{' '}
            <Text style={styles.aiHighlight}>
              {event.options.find((o) => o.key === event.recommended)?.label}
            </Text>
          </Text>
        </View>
      ) : null}

      <View style={styles.options}>
        {event.options.map((opt) => {
          const advised = hasAi && opt.key === event.recommended;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onChoose(opt.key)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              style={({ pressed }) => [
                styles.option,
                advised && styles.optionAdvised,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.optionFlex}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <Text style={styles.optionHint}>{opt.hint}</Text>
              </View>
              {advised ? (
                <MaterialCommunityIcons name="star-check" size={18} color={colors.primary} />
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textFaint} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(248,113,113,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  alert: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
  },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  description: { color: colors.textSubtle, fontSize: fontSize.md, lineHeight: 22 },
  diagnosis: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  diagnosisText: { color: colors.accent, fontSize: fontSize.sm, flex: 1, lineHeight: 18 },
  aiBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aiText: { color: colors.textSubtle, fontSize: fontSize.sm, flex: 1 },
  aiHighlight: { color: colors.primary, fontWeight: fontWeight.bold },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionAdvised: { borderColor: colors.primary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  optionFlex: { flex: 1 },
  optionLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  optionHint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
});

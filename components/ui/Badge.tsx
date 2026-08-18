import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'primary';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceHigh, fg: colors.textSubtle },
  success: { bg: 'rgba(52,211,153,0.15)', fg: colors.success },
  warning: { bg: 'rgba(251,191,36,0.15)', fg: colors.warning },
  danger: { bg: 'rgba(248,113,113,0.15)', fg: colors.danger },
  accent: { bg: 'rgba(56,189,248,0.15)', fg: colors.accent },
  primary: { bg: 'rgba(255,176,32,0.16)', fg: colors.primary },
};

interface BadgeProps {
  label: string;
  tone?: Tone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.3 },
});

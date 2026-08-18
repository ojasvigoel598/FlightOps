import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

interface PanelProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
  tone?: 'default' | 'raised';
}

export function Panel({ children, title, subtitle, right, style, tone = 'default' }: PanelProps) {
  return (
    <View
      style={[
        styles.panel,
        tone === 'raised' && styles.raised,
        style,
      ]}
    >
      {title ? (
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  raised: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  title: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  subtitle: {
    color: colors.textSubtle,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});

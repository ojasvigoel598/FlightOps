import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';

export default function ResultScreen() {
  const router = useRouter();
  const { lastResult } = useGame();

  useEffect(() => {
    if (!lastResult) router.replace('/');
  }, [lastResult, router]);

  if (!lastResult) return null;

  const success = lastResult.success;
  const accent = success ? colors.success : colors.danger;

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="New Contract" icon="clipboard-text" fullWidth onPress={() => router.replace('/contracts')} />
          <Button label="Back to Hangar" variant="ghost" fullWidth onPress={() => router.replace('/')} />
        </View>
      }
    >
      <View style={[styles.banner, { borderColor: accent }]}>
        <MaterialCommunityIcons
          name={success ? 'trophy' : 'alert-octagon'}
          size={56}
          color={accent}
        />
        <Text style={[styles.status, { color: accent }]}>
          {success ? 'MISSION SUCCESS' : 'MISSION LOST'}
        </Text>
        <Text style={styles.summary}>{lastResult.summary}</Text>
      </View>

      <View style={styles.ledger}>
        <LedgerRow label="Contract reward" value={`+£${lastResult.reward}M`} tone={colors.success} />
        <LedgerRow label="Vehicle build cost" value={`-£${lastResult.cost}M`} tone={colors.danger} />
        <View style={styles.divider} />
        <LedgerRow
          label="Net result"
          value={`${lastResult.net >= 0 ? '+' : ''}£${lastResult.net}M`}
          tone={lastResult.net >= 0 ? colors.success : colors.danger}
          bold
        />
        <LedgerRow label="XP earned" value={`+${lastResult.xp} XP`} tone={colors.accent} />
      </View>

      <View style={styles.finalState}>
        <Text style={styles.sectionTitle}>Final vehicle state</Text>
        <View style={styles.gauges}>
          <Gauge label="Fuel" value={lastResult.telemetry.fuel} />
          <Gauge label="Integrity" value={lastResult.telemetry.integrity} />
          <Gauge label="Engine" value={lastResult.telemetry.engineHealth} />
        </View>
      </View>

      <View style={styles.logPanel}>
        <Text style={styles.sectionTitle}>Mission debrief</Text>
        {lastResult.log.map((line, idx) => (
          <View key={`${idx}-${line}`} style={styles.logRow}>
            <MaterialCommunityIcons name="circle-small" size={16} color={colors.textFaint} />
            <Text style={styles.logText}>{line}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function LedgerRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={[styles.ledgerLabel, bold && { color: colors.text, fontWeight: fontWeight.bold }]}>{label}</Text>
      <Text style={[styles.ledgerValue, { color: tone }, bold && { fontSize: fontSize.xl }]}>{value}</Text>
    </View>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  const c = value >= 60 ? colors.success : value >= 30 ? colors.warning : colors.danger;
  return (
    <View style={styles.gauge}>
      <Text style={[styles.gaugeValue, { color: c }]}>{Math.round(value)}%</Text>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  status: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: 1 },
  summary: { color: colors.textSubtle, fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 },
  ledger: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ledgerLabel: { color: colors.textSubtle, fontSize: fontSize.md },
  ledgerValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  finalState: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  gauges: { flexDirection: 'row', gap: spacing.sm },
  gauge: { flex: 1, backgroundColor: colors.backgroundAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  gaugeValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  gaugeLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  logPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  logText: { color: colors.textSubtle, fontSize: fontSize.sm, flex: 1, lineHeight: 18 },
  footer: { gap: spacing.sm },
});

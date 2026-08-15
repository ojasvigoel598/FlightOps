// Powered by OnSpace.AI
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, EventCard, TelemetryDeck } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useMission } from '@/hooks/useMission';

export default function MissionScreen() {
  const router = useRouter();
  const {
    activeContract,
    stats,
    hasAi,
    status,
    telemetry,
    currentEvent,
    log,
    start,
    advance,
    choose,
  } = useMission();

  const booted = useRef(false);

  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      if (!activeContract) router.replace('/');
    }
  }, [activeContract, router]);

  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(() => router.replace('/result'), 500);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (!activeContract || !stats || status === 'done') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="radar" size={40} color={colors.primary} />
          <Text style={styles.finalizing}>Finalizing mission report…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const recentLog = log.slice(-5).reverse();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        {status !== 'event' ? (
          <Pressable onPress={() => router.replace('/')} hitSlop={10} accessibilityLabel="Abort">
            <MaterialCommunityIcons name="close" size={24} color={colors.textSubtle} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.topTitle}>MISSION CONTROL</Text>
        <Badge label={activeContract.difficulty} tone="primary" />
      </View>

      <View style={styles.body}>
        {status === 'briefing' ? (
          <View style={styles.briefing}>
            <Image source={require('@/assets/images/mission-hud.png')} style={styles.hud} contentFit="cover" transition={250} />
            <Text style={styles.briefTitle}>{activeContract.title}</Text>
            <Text style={styles.briefSub}>
              {activeContract.payloadKg} kg over {activeContract.distanceKm} km
            </Text>
            <View style={styles.briefStats}>
              <BriefStat label="Safety" value={`${stats.safety}`} />
              <BriefStat label="Reserve" value={`${stats.reservePct}%`} />
              <BriefStat label="Reliability" value={`${stats.reliability}`} />
            </View>
            {!stats.feasible ? (
              <Text style={styles.warn}>⚠ Fuel range is below the required distance.</Text>
            ) : null}
            <Button label="Begin Mission" icon="airplane-takeoff" fullWidth onPress={start} />
          </View>
        ) : null}

        {status === 'flying' ? (
          <View style={styles.flying}>
            <TelemetryDeck telemetry={telemetry} />
            <View style={styles.logPanel}>
              <Text style={styles.logTitle}>Flight log</Text>
              {recentLog.map((line, idx) => (
                <View key={`${idx}-${line}`} style={styles.logRow}>
                  <MaterialCommunityIcons
                    name={idx === 0 ? 'chevron-right' : 'circle-small'}
                    size={16}
                    color={idx === 0 ? colors.primary : colors.textFaint}
                  />
                  <Text style={[styles.logText, idx === 0 && styles.logTextActive]}>{line}</Text>
                </View>
              ))}
            </View>
            <Button label="Advance Flight" icon="fast-forward" fullWidth onPress={advance} />
          </View>
        ) : null}

        {status === 'event' && currentEvent ? (
          <>
            <TelemetryDeck telemetry={telemetry} />
            <View style={styles.eventWrap}>
              <EventCard event={currentEvent} hasAi={hasAi} onChoose={choose} />
            </View>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function BriefStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.briefStat}>
      <Text style={styles.briefStatValue}>{value}</Text>
      <Text style={styles.briefStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  finalizing: { color: colors.textSubtle, fontSize: fontSize.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold, letterSpacing: 2 },
  body: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  briefing: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  hud: { width: '100%', height: 160, borderRadius: radius.md },
  briefTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  briefSub: { color: colors.textSubtle, fontSize: fontSize.sm, marginTop: -6 },
  briefStats: { flexDirection: 'row', gap: spacing.sm },
  briefStat: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  briefStatValue: { color: colors.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  briefStatLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  warn: { color: colors.warning, fontSize: fontSize.sm },
  flying: { gap: spacing.lg },
  logPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  logTitle: { color: colors.textSubtle, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, marginBottom: spacing.xs },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  logText: { color: colors.textFaint, fontSize: fontSize.sm, flex: 1, lineHeight: 18 },
  logTextActive: { color: colors.text, fontWeight: fontWeight.medium },
  eventWrap: { flex: 1 },
});

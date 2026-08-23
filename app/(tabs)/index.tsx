import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  PartSelector,
  Screen,
  ScreenHeader,
  StatReadout,
  type PartOption,
} from '@/components';
import { ENGINES, FUELS, WINGS } from '@/constants/config';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { computeVehicleStats } from '@/services/simulation';
import { useAlert } from '@/template/ui';

const toOptions = (record: Record<string, PartOption>): PartOption[] => Object.values(record);

export default function HangarScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { company, activeContract, design, updateDesign, launchMission } = useGame();

  const stats = useMemo(() => {
    if (!activeContract) return null;
    return computeVehicleStats(
      design,
      activeContract.payloadKg,
      activeContract.distanceKm,
      company.upgrades,
    );
  }, [activeContract, design, company.upgrades]);

  const onLaunch = () => {
    if (!activeContract || !stats) return;
    if (company.money < stats.cost) {
      showAlert('Insufficient funds', `You need £${stats.cost}M to build this vehicle.`);
      return;
    }
    if (!stats.feasible) {
      showAlert(
        'Range warning',
        'This vehicle cannot reach the destination on its fuel. Launch anyway?',
        [
          { text: 'Rework design', style: 'cancel' },
          {
            text: 'Launch anyway',
            style: 'destructive',
            onPress: () => {
              launchMission(stats.cost);
              router.push('/mission');
            },
          },
        ],
      );
      return;
    }
    launchMission(stats.cost);
    router.push('/mission');
  };

  if (!activeContract) {
    return (
      <Screen>
        <ScreenHeader eyebrow="Flight Ops" title="The Hangar" subtitle="Build it. Fly it. Break it. Save it." />
        <Image source={require('@/assets/images/hangar-hero.png')} style={styles.hero} contentFit="cover" transition={250} />
        <View style={styles.empty}>
          <MaterialCommunityIcons name="clipboard-alert" size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>No active contract</Text>
          <Text style={styles.emptyText}>
            Pick a contract from the board, then design a vehicle to fly it.
          </Text>
          <Button label="Browse contracts" icon="clipboard-text" onPress={() => router.navigate('/contracts')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerLabel}>Build cost</Text>
            <Text style={styles.footerCost}>£{stats?.cost}M</Text>
          </View>
          <Button label="Launch Mission" icon="rocket-launch" onPress={onLaunch} style={styles.footerBtn} />
        </View>
      }
    >
      <ScreenHeader
        eyebrow={activeContract.client}
        title={activeContract.title}
        subtitle={`${activeContract.payloadKg} kg  ·  ${activeContract.distanceKm} km  ·  Reward £${activeContract.reward}M`}
        right={<Badge label={activeContract.difficulty} tone="primary" />}
      />

      <Image source={require('@/assets/images/hangar-hero.png')} style={styles.heroSmall} contentFit="cover" transition={250} />

      <View style={styles.workshop}>
        <Text style={styles.sectionTitle}>Workshop</Text>
        <PartSelector title="Wings" icon="airplane" options={toOptions(WINGS)} selectedId={design.wing} onSelect={(id) => updateDesign({ wing: id as never })} />
        <PartSelector title="Engine" icon="engine" options={toOptions(ENGINES)} selectedId={design.engine} onSelect={(id) => updateDesign({ engine: id as never })} />
        <PartSelector title="Fuel" icon="fuel" options={toOptions(FUELS)} selectedId={design.fuel} onSelect={(id) => updateDesign({ fuel: id as never })} />
      </View>

      {stats ? (
        <View style={styles.readout}>
          <StatReadout stats={stats} contract={activeContract} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 180, borderRadius: radius.lg },
  heroSmall: { width: '100%', height: 120, borderRadius: radius.lg },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  emptyText: { color: colors.textSubtle, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  workshop: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  readout: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footerInfo: { gap: 2 },
  footerLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  footerCost: { color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  footerBtn: { flex: 1 },
});

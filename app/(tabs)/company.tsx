import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Panel, Screen, ScreenHeader, StatBar, UpgradeCard } from '@/components';
import { UPGRADES } from '@/constants/config';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useGame } from '@/hooks/useGame';
import { useAlert } from '@/template';

export default function CompanyScreen() {
  const { showAlert } = useAlert();
  const { company, purchaseUpgrade, resetGame } = useGame();

  const totalMissions = company.missionsCompleted + company.missionsFailed;
  const successRate = totalMissions ? Math.round((company.missionsCompleted / totalMissions) * 100) : 0;
  const xpIntoLevel = company.xp % 120;

  const onBuy = (id: string, cost: number, name: string) => {
    const ok = purchaseUpgrade(id, cost);
    showAlert(
      ok ? 'Upgrade installed' : 'Cannot purchase',
      ok ? `${name} is now available on every build.` : 'Not enough funds for this upgrade.',
    );
  };

  const onReset = () => {
    showAlert('Reset company?', 'This wipes all progress and starts a new save.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetGame },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader eyebrow="Operations" title="Company HQ" subtitle="Your aerospace firm at a glance." />

      <View style={styles.moneyCard}>
        <View>
          <Text style={styles.moneyLabel}>Treasury</Text>
          <Text style={[styles.money, company.money < 0 && { color: colors.danger }]}>£{company.money}M</Text>
        </View>
        <View style={styles.levelBadge}>
          <MaterialCommunityIcons name="star-four-points" size={16} color={colors.primary} />
          <Text style={styles.levelText}>Level {company.level}</Text>
        </View>
      </View>

      <Panel title="Progress">
        <StatBar label={`XP to level ${company.level + 1}`} value={(xpIntoLevel / 120) * 100} suffix="%" hint={`${company.xp} XP total`} />
        <View style={styles.statGrid}>
          <Stat icon="account-hard-hat" value={`${company.engineers}`} label="Engineers" />
          <Stat icon="check-circle" value={`${company.missionsCompleted}`} label="Completed" />
          <Stat icon="close-circle" value={`${company.missionsFailed}`} label="Failed" />
          <Stat icon="percent" value={`${successRate}%`} label="Success rate" />
        </View>
      </Panel>

      <Panel title="R&D Lab" subtitle="Permanent upgrades applied to every vehicle.">
        <View style={styles.upgrades}>
          {UPGRADES.map((u) => (
            <UpgradeCard
              key={u.id}
              upgrade={u}
              owned={company.upgrades.includes(u.id)}
              affordable={company.money >= u.cost}
              onBuy={() => onBuy(u.id, u.cost, u.name)}
            />
          ))}
        </View>
      </Panel>

      <Button label="Reset company" variant="ghost" icon="restart" onPress={onReset} />
    </Screen>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  moneyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
  },
  moneyLabel: { color: colors.textSubtle, fontSize: fontSize.sm },
  money: { color: colors.primary, fontSize: fontSize.xxxl, fontWeight: fontWeight.bold },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,176,32,0.14)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  levelText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: '22%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  statLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  upgrades: { gap: spacing.sm },
});

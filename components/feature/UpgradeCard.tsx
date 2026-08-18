import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import type { UpgradeSpec } from '@/constants/config';
import { Button } from '../ui/Button';

interface UpgradeCardProps {
  upgrade: UpgradeSpec;
  owned: boolean;
  affordable: boolean;
  onBuy: () => void;
}

export function UpgradeCard({ upgrade, owned, affordable, onBuy }: UpgradeCardProps) {
  return (
    <View style={[styles.card, owned && styles.owned]}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={upgrade.icon as never} size={22} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.name}>{upgrade.name}</Text>
        <Text style={styles.desc}>{upgrade.desc}</Text>
      </View>
      <View style={styles.action}>
        {owned ? (
          <View style={styles.ownedTag}>
            <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
            <Text style={styles.ownedText}>Owned</Text>
          </View>
        ) : (
          <Button
            label={`£${upgrade.cost}M`}
            variant={affordable ? 'primary' : 'secondary'}
            disabled={!affordable}
            onPress={onBuy}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  owned: { borderColor: colors.success, opacity: 0.9 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,176,32,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  desc: { color: colors.textSubtle, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  action: { minWidth: 78, alignItems: 'flex-end' },
  ownedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownedText: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});

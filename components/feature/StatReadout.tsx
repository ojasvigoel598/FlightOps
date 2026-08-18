import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { ratingLabel } from '@/services/simulation';
import type { Contract, VehicleStats } from '@/types/game';
import { Badge } from '../ui/Badge';
import { StatBar } from '../ui/StatBar';

interface StatReadoutProps {
  stats: VehicleStats;
  contract: Contract;
}

export function StatReadout({ stats, contract }: StatReadoutProps) {
  const rangeMargin = stats.rangeKm - contract.distanceKm;
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Flight readiness</Text>
        {stats.feasible ? (
          <Badge label="RANGE OK" tone="success" />
        ) : (
          <Badge label="INSUFFICIENT RANGE" tone="danger" />
        )}
      </View>

      <StatBar label="Aerodynamic efficiency" value={stats.aeroEfficiency} hint={ratingLabel(stats.aeroEfficiency)} />
      <StatBar label="Engine reliability" value={stats.reliability} hint={ratingLabel(stats.reliability)} />
      <StatBar label="Low-speed handling" value={stats.lowSpeed} hint={ratingLabel(stats.lowSpeed)} />
      <StatBar label="Overall safety" value={stats.safety} hint={ratingLabel(stats.safety)} />

      <View style={styles.grid}>
        <Cell
          icon="map-marker-distance"
          label="Range"
          value={`${stats.rangeKm} km`}
          sub={`${rangeMargin >= 0 ? '+' : ''}${Math.round(rangeMargin)} km margin`}
          good={rangeMargin >= 0}
        />
        <Cell
          icon="fuel"
          label="Reserve"
          value={`${stats.reservePct}%`}
          sub={stats.reservePct > 40 ? 'comfortable' : 'tight'}
          good={stats.reservePct > 40}
        />
        <Cell icon="weight" label="Weight" value={`${(stats.weightKg / 1000).toFixed(1)} t`} sub="all-up" />
        <Cell icon="cash" label="Build cost" value={`£${stats.cost}M`} sub="per mission" highlight />
      </View>
    </View>
  );
}

function Cell({
  icon,
  label,
  value,
  sub,
  good,
  highlight,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  sub: string;
  good?: boolean;
  highlight?: boolean;
}) {
  const color = highlight ? colors.primary : good === false ? colors.danger : colors.text;
  return (
    <View style={styles.cell}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.textSubtle} />
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, { color }]}>{value}</Text>
      <Text style={styles.cellSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  cell: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  cellLabel: { color: colors.textFaint, fontSize: fontSize.xs },
  cellValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  cellSub: { color: colors.textSubtle, fontSize: fontSize.xs },
});

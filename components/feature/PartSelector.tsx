// Powered by OnSpace.AI
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

export interface PartOption {
  id: string;
  name: string;
  tag: string;
  cost: number;
  pros: string[];
  cons: string[];
}

interface PartSelectorProps {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  options: PartOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PartSelector({ title, icon, options, selectedId, onSelect }: PartSelectorProps) {
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.segments}>
        {options.map((opt) => {
          const isSelected = opt.id === selectedId;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onSelect(opt.id)}
              accessibilityRole="button"
              accessibilityLabel={`${title} ${opt.name}`}
              style={({ pressed }) => [
                styles.segment,
                isSelected && styles.segmentSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                {opt.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.detail}>
        <View style={styles.detailHeader}>
          <Text style={styles.detailTag}>{selected.tag}</Text>
          <Text style={styles.detailCost}>£{selected.cost}M</Text>
        </View>
        <View style={styles.consPros}>
          <View style={styles.col}>
            {selected.pros.map((p) => (
              <Row key={p} icon="thumb-up" color={colors.success} text={p} />
            ))}
          </View>
          <View style={styles.col}>
            {selected.cons.map((c) => (
              <Row key={c} icon="thumb-down" color={colors.danger} text={c} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function Row({
  icon,
  color,
  text,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  text: string;
}) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  segments: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.85 },
  segmentText: { color: colors.textSubtle, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  segmentTextSelected: { color: '#1A1206' },
  detail: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailTag: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  detailCost: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  consPros: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { color: colors.textSubtle, fontSize: fontSize.xs, flex: 1 },
});

// Design tab — switches between Fun Mode (intuitive) and Engineering Mode (Sadraey-style).
//
// Mode A (Fun): visual choices, no equations, learn by experimenting.
// Mode B (Engineering): equations, Sadraey workflow, detailed analysis.
// Mode choice persists in AsyncStorage.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import EngineeringSimulation from '@/components/EngineeringSimulation';
import FunMode from '@/components/FunMode';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useLearningMode } from '@/contexts/ModeContext';

export default function DesignScreen() {
  const { mode, setMode, isFun, isEngineering } = useLearningMode();

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Design"
        title="Aircraft Designer"
        subtitle="Choose your learning mode and design an aircraft."
      />

      {/* Mode switcher */}
      <Panel title="Learning mode" subtitle="Switch between modes anytime.">
        <View style={s.modeRow}>
          <Pressable
            onPress={() => setMode('fun')}
            style={[s.modeCard, isFun && s.modeCardActive]}
          >
            <Text style={s.modeIcon}>🎮</Text>
            <Text style={[s.modeTitle, isFun && s.modeTitleActive]}>Fun Mode</Text>
            <Text style={s.modeDesc}>
              Pick shapes, see what happens. No equations — learn by experimenting.
            </Text>
            <Badge label="Beginner" tone={isFun ? 'accent' : 'neutral'} />
          </Pressable>

          <Pressable
            onPress={() => setMode('engineering')}
            style={[s.modeCard, isEngineering && s.modeCardActive]}
          >
            <Text style={s.modeIcon}>📐</Text>
            <Text style={[s.modeTitle, isEngineering && s.modeTitleActive]}>Engineering Mode</Text>
            <Text style={s.modeDesc}>
              Sadraey-style design process. Equations, methods, and detailed analysis.
            </Text>
            <Badge label="Advanced" tone={isEngineering ? 'accent' : 'neutral'} />
          </Pressable>
        </View>
      </Panel>

      {/* Active mode content */}
      {isFun ? <FunMode /> : <EngineeringSimulation />}
    </Screen>
  );
}

const s = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: spacing.md },
  modeCard: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  modeCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,176,32,0.08)' },
  modeIcon: { fontSize: 28 },
  modeTitle: { color: colors.textSubtle, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  modeTitleActive: { color: colors.primary },
  modeDesc: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 15 },
});

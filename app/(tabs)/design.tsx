// Design tab — switches between Fun Mode (intuitive) and Engineering Mode (Sadraey-style).
//
// Mode A (Fun): visual choices, no equations, learn by experimenting.
// Mode B (Engineering): equations, Sadraey workflow, detailed analysis.
// Mode choice persists in AsyncStorage.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import EngineeringSimulation from '@/components/EngineeringSimulation';
import FunMode from '@/components/FunMode';
import GameLauncher from '@/components/GameLauncher';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { useLearningMode } from '@/contexts/ModeContext';

type ViewMode = 'selector' | 'fun' | 'engineering' | 'play';

export default function DesignScreen() {
  const { mode, setMode, isFun, isEngineering } = useLearningMode();
  const [viewMode, setViewMode] = useState<ViewMode>('selector');

  // If playing the standalone game, show fullscreen WebView
  if (viewMode === 'play') {
    return <GameLauncher onBack={() => setViewMode('selector')} />;
  }

  // If a mode is selected, show it with a back button
  if (viewMode === 'fun' || viewMode === 'engineering') {
    return (
      <Screen>
        <View style={s.topRow}>
          <Pressable onPress={() => setViewMode('selector')} style={s.backBtn}>
            <Text style={s.backBtnText}>← Modes</Text>
          </Pressable>
          <Text style={s.activeTitle}>{viewMode === 'fun' ? '🎮 Fun Mode' : '📐 Engineering Mode'}</Text>
          <Pressable onPress={() => setViewMode('play')} style={s.playBtn}>
            <Text style={s.playBtnText}>▶ Play</Text>
          </Pressable>
        </View>
        {viewMode === 'fun' ? <FunMode /> : <EngineeringSimulation />}
      </Screen>
    );
  }

  // Mode selector
  return (
    <Screen>
      <ScreenHeader
        eyebrow="Design"
        title="Aircraft Designer"
        subtitle="Choose your learning mode and design an aircraft."
      />

      {/* Quick play button */}
      <Pressable onPress={() => setViewMode('play')} style={s.quickPlay}>
        <Text style={s.quickPlayIcon}>🎮</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.quickPlayTitle}>▶ Play Flight Game</Text>
          <Text style={s.quickPlayDesc}>Interactive flight simulator — design, fly, and score</Text>
        </View>
        <Badge label="Launch" tone="accent" />
      </Pressable>

      {/* Mode switcher */}
      <Panel title="Learning mode" subtitle="Switch between modes anytime.">
        <View style={s.modeRow}>
          <Pressable
            onPress={() => { setMode('fun'); setViewMode('fun'); }}
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
            onPress={() => { setMode('engineering'); setViewMode('engineering'); }}
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
    </Screen>
  );
}

const s = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.backgroundAlt,
  },
  backBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  activeTitle: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },
  playBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  playBtnText: { color: '#000', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  quickPlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,176,32,0.08)',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  quickPlayIcon: { fontSize: 32 },
  quickPlayTitle: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  quickPlayDesc: { color: colors.textFaint, fontSize: fontSize.xs },
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

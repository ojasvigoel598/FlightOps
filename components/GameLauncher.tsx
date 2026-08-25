// GameLauncher — Loads the standalone HTML5 flight game in a WebView.
//
// This provides an interactive, browser-quality game experience
// directly inside the React Native app. The game runs as a self-contained
// HTML5 Canvas application with real flight physics.

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';

const GAME_URL = 'https://ojasvigoel598.github.io/FlightOps/FLIGHT_GAME.html';

interface GameLauncherProps {
  /** Called when user wants to go back to the app */
  onBack?: () => void;
}

export default function GameLauncher({ onBack }: GameLauncherProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={s.container}>
      {/* Top bar with back button */}
      <View style={s.topBar}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Text style={s.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={s.title}>✈️ Flight Ops — Fly Now</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFB020" />
          <Text style={s.loadingText}>Loading flight simulator...</Text>
        </View>
      )}

      {/* Error state */}
      {error && (
        <View style={s.errorOverlay}>
          <Text style={s.errorIcon}>⚠️</Text>
          <Text style={s.errorTitle}>Failed to load game</Text>
          <Text style={s.errorText}>{error}</Text>
          <Pressable onPress={() => { setError(null); setLoading(true); }} style={s.retryBtn}>
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* WebView with the game */}
      <WebView
        source={{ uri: GAME_URL }}
        style={s.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onLoadStart={() => { setLoading(true); setError(null); }}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          setLoading(false);
          setError((e.nativeEvent as any).desc || (e.nativeEvent as any).message || 'Network error');
        }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        mixedContentMode="always"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,176,32,0.2)',
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtnText: {
    color: '#FFB020',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  title: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  errorTitle: {
    color: '#F87171',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: '#94A3B8',
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#FFB020',
  },
  retryBtnText: {
    color: '#000',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
});

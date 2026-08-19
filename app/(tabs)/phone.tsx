// Open on phone — live QR code.
//
// The QR payload is resolved at runtime from the URL this app is actually
// served from (window.location.origin on web, or the Expo dev-server host URI
// in native development builds). When the origin is localhost, we attempt
// WebRTC-based LAN IP detection (no API key required). If that also fails,
// a manual URL input lets the user paste the reachable URL directly.

import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { buildLanUrl, detectLanIp, resolveReachableUrl } from '@/services/reachable-url';

const QR_SIZE = 216;
const QUIET_ZONE = 16;

export default function PhoneScreen() {
  const [manualUrl, setManualUrl] = useState('');
  const [detectedIp, setDetectedIp] = useState<string | null>(null);

  // Auto-detect the LAN IP via WebRTC (no API key, works on same WiFi)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    detectLanIp().then((ip) => {
      if (ip) setDetectedIp(ip);
    });
  }, []);

  // Determine the best URL: origin (non-loopback) > native host > detected LAN IP > manual
  const resolvedUrl = useCallback(() => {
    // 1. Try the origin directly
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      const fromOrigin = resolveReachableUrl({ origin: window.location.origin });
      if (fromOrigin) return fromOrigin;
    }
    // 2. Try native host URI
    if (Platform.OS !== 'web') {
      const fromHost = resolveReachableUrl({ hostUri: Constants.expoConfig?.hostUri });
      if (fromHost) return fromHost;
    }
    // 3. Try detected LAN IP
    if (detectedIp) return buildLanUrl(detectedIp);
    // 4. Fall back to manual URL
    if (manualUrl.trim()) {
      const trimmed = manualUrl.trim();
      return trimmed.startsWith('http') ? trimmed : `http://${trimmed}`;
    }
    return null;
  }, [detectedIp, manualUrl]);

  const url = resolvedUrl();

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Mobile access"
        title="Open on phone"
        subtitle="Scan the QR code with your phone to open this app in its mobile browser."
      />

      <Panel tone="raised" style={styles.qrCard}>
        <Text style={styles.scanLabel}>Scan to open on phone</Text>
        {url ? (
          <>
            <View style={styles.qrFrame}>
              <QRCode
                value={url}
                size={QR_SIZE}
                quietZone={QUIET_ZONE}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
            <Text style={styles.instructions}>Scan this QR code with your phone</Text>
            <Text selectable style={styles.urlText}>
              {url}
            </Text>
            <View style={styles.badgeRow}>
              {detectedIp ? <Badge label="LAN detected" tone="success" /> : null}
              <Badge label="No localhost" tone="accent" />
            </View>
          </>
        ) : (
          <View style={styles.noUrl}>
            <Text style={styles.noUrlTitle}>Enter a reachable URL</Text>
            <Text style={styles.noUrlText}>
              The app could not auto-detect a phone-reachable URL. Enter the preview or deployment
              URL below (your phone and computer must be on the same network).
            </Text>
            <TextInput
              style={styles.manualInput}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="http://192.168.1.x:8081"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="Manual reachable URL"
            />
            {manualUrl.trim() ? (
              <View style={[styles.qrFrame, { marginTop: spacing.lg }]}>
                <QRCode
                  value={
                    manualUrl.trim().startsWith('http')
                      ? manualUrl.trim()
                      : `http://${manualUrl.trim()}`
                  }
                  size={QR_SIZE}
                  quietZone={QUIET_ZONE}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              </View>
            ) : null}
          </View>
        )}
      </Panel>

      <Panel title="How to use">
        <Step n={1} text="Open this screen on your computer and keep it visible." />
        <Step
          n={2}
          text="Open your phone camera (iOS) or Google Lens (Android) and point it at the QR code."
        />
        <Step
          n={3}
          text="Tap the link to open Flight Ops in the phone browser. It will stay usable while the preview session is running."
        />
        <Step
          n={4}
          text="On Android/Chrome you can install it as an app: menu -> Add to Home screen (installable PWA on the static build)."
        />
      </Panel>

      <Panel title="About the URL" tone="raised">
        <Text style={styles.note}>
          The QR payload is resolved at runtime from the origin the app is actually served from, or
          auto-detected via WebRTC LAN IP discovery. Nothing is hard-coded. If auto-detection
          fails (e.g. the browser blocks WebRTC), paste the preview URL manually above.
        </Text>
      </Panel>
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrCard: { alignItems: 'center' },
  scanLabel: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.lg,
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: QUIET_ZONE,
  },
  instructions: {
    color: colors.textSubtle,
    fontSize: fontSize.sm,
    marginTop: spacing.lg,
  },
  urlText: {
    color: colors.accent,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  noUrl: { gap: spacing.sm, paddingVertical: spacing.sm, width: '100%' },
  noUrlTitle: { color: colors.warning, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  noUrlText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 19 },
  manualInput: {
    color: colors.text,
    fontSize: fontSize.md,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
    width: '100%',
  },
  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,176,32,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  stepText: { flex: 1, color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 19 },
  note: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16 },
});

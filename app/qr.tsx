// Standalone QR code page — accessible at /qr.
// Always shows a working QR code with multiple fallback strategies:
// 1. Non-loopback web origin (works on deployed/preview URLs)
// 2. WebRTC LAN IP detection (same WiFi)
// 3. Manual URL input (user pastes the preview URL)
// The page auto-refreshes the URL every 5 seconds to catch new sessions.

import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { buildLanUrl, detectLanIp, resolveReachableUrl } from '@/services/reachable-url';

const QR_SIZE = 280;
const QUIET_ZONE = 20;

export default function QrScreen() {
  const [manualUrl, setManualUrl] = useState('');
  const [detectedIp, setDetectedIp] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-detect LAN IP
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    detectLanIp().then((ip) => { if (ip) setDetectedIp(ip); });
  }, []);

  // Auto-refresh every 5 seconds to catch new preview sessions
  useEffect(() => {
    intervalRef.current = setInterval(() => setRefreshKey((k) => k + 1), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const resolvedUrl = useCallback(() => {
    // 1. Try the origin directly (works on Freebuff preview / deployed URLs)
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
  }, [detectedIp, manualUrl, refreshKey]); // refreshKey triggers re-evaluation

  const url = resolvedUrl();

  // Pre-fill the manual input with the current page URL as a hint
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flight Ops</Text>
      <Text style={styles.subtitle}>Scan to open on your phone</Text>

      {url ? (
        <View style={styles.qrCard}>
          <View style={styles.qrFrame}>
            <QRCode
              value={url}
              size={QR_SIZE}
              quietZone={QUIET_ZONE}
              backgroundColor="#FFFFFF"
              color="#000000"
            />
          </View>
          <Text selectable style={styles.urlText}>{url}</Text>
          <Text style={styles.hint}>
            Point your phone camera at the code above.{'\n'}
            Phone and computer must be on the same network.
          </Text>
        </View>
      ) : (
        <View style={styles.qrCard}>
          <Text style={styles.noUrlTitle}>Enter a reachable URL</Text>
          <Text style={styles.noUrlText}>
            Paste the preview URL from the Freebuff UI below.
          </Text>
          <TextInput
            style={styles.manualInput}
            value={manualUrl}
            onChangeText={setManualUrl}
            placeholder={currentUrl || 'https://your-preview-url.net'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Manual reachable URL"
          />
          {manualUrl.trim() ? (
            <View style={[styles.qrFrame, { marginTop: spacing.xl }]}>
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

      <Text style={styles.footer}>
        Flight Ops — Aerospace Aircraft Design Simulator{'\n'}by Ojasvi Goel
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060A12',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: fontWeight.bold, letterSpacing: 1 },
  subtitle: { color: colors.textSubtle, fontSize: fontSize.lg, marginBottom: spacing.md },
  qrCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 400,
    width: '100%',
  },
  qrFrame: { backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: QUIET_ZONE },
  urlText: { color: colors.accent, fontSize: fontSize.md, textAlign: 'center', marginTop: spacing.sm },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 16, marginTop: spacing.sm },
  noUrlTitle: { color: colors.warning, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  noUrlText: { color: colors.textSubtle, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 19 },
  manualInput: {
    color: colors.text, fontSize: fontSize.md,
    backgroundColor: colors.backgroundAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2, marginTop: spacing.md, width: '100%',
  },
  footer: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'center', lineHeight: 16, marginTop: spacing.lg },
});

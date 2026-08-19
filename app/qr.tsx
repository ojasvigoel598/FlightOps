// Standalone QR code page — accessible at /qr for quick phone scanning.
// Shows the same reachable-URL QR as the Phone tab but as a dedicated,
// easily-bookmarkable route.

import Constants from 'expo-constants';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { buildLanUrl, detectLanIp, resolveReachableUrl } from '@/services/reachable-url';

const QR_SIZE = 280;
const QUIET_ZONE = 20;

export default function QrScreen() {
  const [manualUrl, setManualUrl] = useState('');
  const [detectedIp, setDetectedIp] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    detectLanIp().then((ip) => {
      if (ip) setDetectedIp(ip);
    });
  }, []);

  const resolvedUrl = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      const fromOrigin = resolveReachableUrl({ origin: window.location.origin });
      if (fromOrigin) return fromOrigin;
    }
    if (Platform.OS !== 'web') {
      const fromHost = resolveReachableUrl({ hostUri: Constants.expoConfig?.hostUri });
      if (fromHost) return fromHost;
    }
    if (detectedIp) return buildLanUrl(detectedIp);
    if (manualUrl.trim()) {
      const trimmed = manualUrl.trim();
      return trimmed.startsWith('http') ? trimmed : `http://${trimmed}`;
    }
    return null;
  }, [detectedIp, manualUrl]);

  const url = resolvedUrl();

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
          <Text selectable style={styles.urlText}>
            {url}
          </Text>
          <Text style={styles.hint}>
            Point your phone camera at the code above. Phone and computer must be on the same
            network.
          </Text>
        </View>
      ) : (
        <View style={styles.qrCard}>
          <Text style={styles.noUrlTitle}>Enter a reachable URL</Text>
          <Text style={styles.noUrlText}>
            Paste the preview URL from the Freebuff UI or your local network address.
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
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  subtitle: {
    color: colors.textSubtle,
    fontSize: fontSize.lg,
    marginBottom: spacing.md,
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 400,
    width: '100%',
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: QUIET_ZONE,
  },
  urlText: {
    color: colors.accent,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  hint: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  noUrlTitle: {
    color: colors.warning,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  noUrlText: {
    color: colors.textSubtle,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 19,
  },
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
  footer: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: spacing.lg,
  },
});

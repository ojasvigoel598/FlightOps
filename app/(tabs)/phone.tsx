// Open on phone — live QR code.
//
// The QR payload is resolved at runtime from the URL this app is actually
// served from (window.location.origin on web, or the Expo dev-server host URI
// in native development builds). Loopback-only addresses (localhost,
// 127.0.0.1, 0.0.0.0) are never encoded — when no phone-reachable URL can be
// derived, guidance is shown instead of an unusable QR code.

import Constants from 'expo-constants';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Badge, Panel, Screen, ScreenHeader } from '@/components';
import { colors, fontSize, fontWeight, radius, spacing } from '@/constants/theme';
import { resolveReachableUrl } from '@/services/reachable-url';

const QR_SIZE = 216;
const QUIET_ZONE = 16;

export default function PhoneScreen() {
  const url = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      return resolveReachableUrl({ origin: window.location.origin });
    }
    return resolveReachableUrl({ hostUri: Constants.expoConfig?.hostUri });
  }, []);

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
              <QRCode value={url} size={QR_SIZE} quietZone={QUIET_ZONE} backgroundColor="#FFFFFF" color="#000000" />
            </View>
            <Text style={styles.instructions}>Scan this QR code with your phone</Text>
            <Text selectable style={styles.urlText}>
              {url}
            </Text>
            <View style={styles.badgeRow}>
              <Badge label="Same network" tone="success" />
              <Badge label="No localhost" tone="accent" />
            </View>
          </>
        ) : (
          <View style={styles.noUrl}>
            <Text style={styles.noUrlTitle}>No reachable URL available</Text>
            <Text style={styles.noUrlText}>
              The QR code is only shown when the app is served from a URL a phone can reach. This
              usually means the preview is running on a loopback address (localhost). Open the
              preview from a hosted/preview URL, then return here.
            </Text>
          </View>
        )}
      </Panel>

      <Panel title="How to use">
        <Step n={1} text="Open this screen on your computer and keep it visible." />
        <Step n={2} text="Open your phone camera (iOS) or Google Lens (Android) and point it at the QR code." />
        <Step n={3} text="Tap the link to open Flight Ops in the phone browser. It will stay usable while the preview session is running." />
        <Step n={4} text="On Android/Chrome you can install it as an app: menu → Add to Home screen (installable PWA on the static build)." />
      </Panel>

      <Panel title="About the URL" tone="raised">
        <Text style={styles.note}>
          The QR payload is resolved at runtime from the origin the app is actually served from —
          nothing is hard-coded, so the code always points at the real reachable preview or
          deployment URL, and it is validated to reject localhost-style addresses.
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
  noUrl: { gap: spacing.sm, paddingVertical: spacing.sm },
  noUrlTitle: { color: colors.warning, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  noUrlText: { color: colors.textSubtle, fontSize: fontSize.sm, lineHeight: 19 },
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

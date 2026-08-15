// Powered by OnSpace.AI
// Mission-control design tokens.

export const colors = {
  background: '#060A12',
  backgroundAlt: '#0A1120',
  surface: '#0F1626',
  surfaceAlt: '#141E33',
  surfaceHigh: '#1A2740',
  border: '#22314F',
  borderStrong: '#2E4266',

  primary: '#FFB020', // amber
  primaryDim: '#8A6220',
  accent: '#38BDF8', // cyan
  accentDim: '#1E5A78',

  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',

  text: '#EAF1FB',
  textSubtle: '#93A2BE',
  textFaint: '#5E6E8C',

  overlay: 'rgba(4,8,16,0.72)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const theme = { colors, spacing, radius, fontSize, fontWeight, shadow };
export type Theme = typeof theme;

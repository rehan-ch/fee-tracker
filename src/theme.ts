/**
 * Design tokens (docs/DESIGN.md sections 3, 4, 5, 6, 8.2 and 10). Screens use
 * these tokens and the shared components, never raw hex values.
 * Every key that existed before the design pass is kept so older screens still compile.
 */

export const colors = {
  // Brand (3.1)
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  primaryDark: '#115E59',
  primarySoft: '#CCFBF1',
  /** Alias of primarySoft (M3 primaryContainer): tonal buttons, selected chips, nav indicator. */
  primaryContainer: '#CCFBF1',
  onPrimaryContainer: '#134E4A',
  /** Selected list row tint, avatar background. */
  primarySubtle: '#F0FDFA',
  /** Secondary text on the teal hero (4.86:1 on primary). */
  onPrimaryMuted: '#CCFBF1',

  // Premium only (3.1)
  tertiary: '#4338CA',
  tertiaryContainer: '#E0E7FF',
  onTertiaryContainer: '#3730A3',

  // Neutrals (3.1)
  bg: '#F4F6F8',
  card: '#FFFFFF',
  /** Alias of card (M3 surfaceContainerLowest): cards, sheets, app bar, tab bar. */
  surface: '#FFFFFF',
  surfaceContainer: '#EEF2F6',
  surfaceContainerHigh: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  /** Captions, hints, placeholders, axis text (5.29:1 on bg). */
  muted: '#5B6779',
  /** Control boundaries: text fields, outlined buttons, chips (3.63:1 on white). */
  outline: '#7C8799',
  /** Decorative dividers and hairlines. */
  border: '#E2E8F0',
  /** Alias of border. */
  outlineVariant: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.45)',
  /** Alias of overlay: sheet and dialog backdrop. */
  scrim: 'rgba(15, 23, 42, 0.45)',
  /** android_ripple on light surfaces. */
  ripple: 'rgba(15, 118, 110, 0.12)',
  /** android_ripple on filled primary. */
  rippleOnPrimary: 'rgba(255, 255, 255, 0.24)',
  /** android_ripple on neutral list rows. */
  rippleNeutral: 'rgba(15, 23, 42, 0.08)',
  /** Message preview bubble (reminders, messages). */
  bubble: '#DCF8C6',
  /** Switch track when off (7.3). */
  switchTrackOff: '#CBD5E1',
  /** Bottom-sheet drag handle (7.4). */
  handle: '#CBD5E1',

  // Status (4); keep using statusColors for new code.
  paid: '#15803D',
  paidSoft: '#DCFCE7',
  unpaid: '#B91C1C',
  unpaidSoft: '#FEE2E2',
  partial: '#B45309',
  partialSoft: '#FEF3C7',

  // Feedback roles (3.2): banners and validation only, never due status.
  danger: '#B91C1C',
  error: '#B91C1C',
  errorContainer: '#FEE2E2',
  onErrorContainer: '#7F1D1D',
  warning: '#B45309',
  warningContainer: '#FFFBEB',
  warningBorder: '#FCD34D',
  onWarningContainer: '#92400E',
  info: '#1D4ED8',
  infoContainer: '#EFF6FF',
  onInfoContainer: '#1E40AF',
  success: '#15803D',
  successContainer: '#F0FDF4',
  onSuccessContainer: '#166534',

  white: '#FFFFFF',
};

/** Feedback roles grouped for Banner and validation (3.2). */
export const feedbackColors = {
  error: {
    fg: colors.error,
    container: colors.errorContainer,
    onContainer: colors.onErrorContainer,
    border: colors.errorContainer,
    icon: 'close-circle',
  },
  warning: {
    fg: colors.warning,
    container: colors.warningContainer,
    onContainer: colors.onWarningContainer,
    border: colors.warningBorder,
    icon: 'warning',
  },
  info: {
    fg: colors.info,
    container: colors.infoContainer,
    onContainer: colors.onInfoContainer,
    border: colors.infoContainer,
    icon: 'information-circle',
  },
  success: {
    fg: colors.success,
    container: colors.successContainer,
    onContainer: colors.onSuccessContainer,
    border: colors.successContainer,
    icon: 'checkmark-circle',
  },
} as const;

/**
 * Reserved due-status colours (4). `bg` is the soft container, `onSoft` the
 * text on it, `icon` the Ionicons name that always ships with the colour.
 */
export const statusColors = {
  paid: { fg: colors.paid, bg: colors.paidSoft, onSoft: '#166534', icon: 'checkmark-circle' },
  unpaid: { fg: colors.unpaid, bg: colors.unpaidSoft, onSoft: '#B91C1C', icon: 'alert-circle' },
  partial: { fg: colors.partial, bg: colors.partialSoft, onSoft: '#92400E', icon: 'contrast' },
} as const;

/** Inactive customer (4), same shape as a statusColors entry. */
export const inactiveColors = {
  fg: colors.textSecondary,
  bg: colors.surfaceContainerHigh,
  onSoft: colors.textSecondary,
  icon: 'pause-circle',
} as const;

/** Advance / credit uses the paid colours with its own icon (4). */
export const advanceColors = {
  fg: colors.paid,
  bg: colors.paidSoft,
  onSoft: '#166534',
  icon: 'add-circle',
} as const;

/** Chart colours (8.2). Method colours follow the entity, never the rank. */
export const chart = {
  accent: '#0F766E',
  accentTrack: '#CCFBF1',
  context: '#CBD5E1',
  grid: '#E2E8F0',
  axisText: '#5B6779',
  /** Meter track on the teal hero; the white fill measures 3.47:1 against it. */
  heroTrack: 'rgba(255, 255, 255, 0.24)',
  heroFill: '#FFFFFF',
  method: {
    cash: '#2a78d6',
    jazzcash: '#eb6834',
    easypaisa: '#1baf7a',
    bank: '#eda100',
  },
} as const;

// ---------------------------------------------------------------------------
// Typography (5)
// ---------------------------------------------------------------------------

export type FontWeightValue = 400 | 500 | 600 | 700;
export interface TypeStyle {
  fontSize: number;
  /** Omitted only for single-line Urdu controls, which use the font's natural line. */
  lineHeight?: number;
  fontWeight: FontWeightValue;
}

/** Latin scale, Inter (5.2). Sizes in sp. */
const latinScale = {
  hero: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
  headline: { fontSize: 28, lineHeight: 36, fontWeight: 700 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  h2: { fontSize: 17, lineHeight: 24, fontWeight: 600 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: 400 },
  muted: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  small: { fontSize: 13, lineHeight: 18, fontWeight: 400 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: 600 },
  button: { fontSize: 16, lineHeight: 22, fontWeight: 600 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: 600 },
} satisfies Record<string, TypeStyle>;

export type TypeRole = keyof typeof latinScale;

/**
 * Urdu scale, Noto Nastaliq Urdu (5.3). Line height is at least 2.0x the size.
 * `hero` and `headline` stay Inter because they are numbers.
 */
const urduScale: Record<TypeRole, TypeStyle> = {
  hero: latinScale.hero,
  headline: latinScale.headline,
  title: { fontSize: 22, lineHeight: 44, fontWeight: 700 },
  h2: { fontSize: 18, lineHeight: 36, fontWeight: 700 },
  bodyLarge: { fontSize: 17, lineHeight: 34, fontWeight: 400 },
  body: { fontSize: 16, lineHeight: 32, fontWeight: 400 },
  muted: { fontSize: 15, lineHeight: 30, fontWeight: 400 },
  small: { fontSize: 14, lineHeight: 28, fontWeight: 400 },
  label: { fontSize: 14, lineHeight: 28, fontWeight: 700 },
  button: { fontSize: 16, lineHeight: 32, fontWeight: 700 },
  labelLarge: { fontSize: 14, lineHeight: 28, fontWeight: 700 },
  labelSmall: { fontSize: 13, lineHeight: 26, fontWeight: 700 },
};

export const typography = {
  /** Font family names registered by useAppFonts (src/components/ds/fonts.ts). */
  family: { latin: 'Inter', urdu: 'UrduNastaliq' },
  latin: latinScale as Record<TypeRole, TypeStyle>,
  urdu: urduScale,
  /** Minimum Urdu line height as a multiple of the font size. */
  urduMinLineRatio: 2,
} as const;

/** Same object as `typography` (the spec calls it `type`). */
export const type = typography;

// ---------------------------------------------------------------------------
// Layout (6)
// ---------------------------------------------------------------------------

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 28, pill: 999 };

/** RN 0.88 `boxShadow` strings (6.3). Don't use Android `elevation:`. */
export const elevation = {
  level0: 'none',
  level1: '0px 1px 2px rgba(15, 23, 42, 0.06), 0px 1px 3px 1px rgba(15, 23, 42, 0.06)',
  level2: '0px 1px 2px rgba(15, 23, 42, 0.08), 0px 2px 6px 2px rgba(15, 23, 42, 0.08)',
  level3: '0px 4px 8px 3px rgba(15, 23, 42, 0.10), 0px 1px 3px rgba(15, 23, 42, 0.12)',
} as const;

/** Ready-made style objects for the elevation levels. */
export const shadow = {
  level0: {},
  level1: { boxShadow: elevation.level1 },
  level2: { boxShadow: elevation.level2 },
  level3: { boxShadow: elevation.level3 },
} as const;

/** Component sizes in dp (6.4). */
export const size = {
  touch: 48,
  icon: 24,
  iconSm: 18,
  iconLg: 28,
  avatar: 40,
  avatarLg: 56,
  statusIcon: 40,
  button: 48,
  buttonLg: 56,
  field: 56,
  fab: 56,
  navMin: 64,
  appBar: 56,
  meter: 8,
  segBarThin: 8,
  segBarTall: 28,
} as const;

/** Hero gradient (6.5). Urdu uses 225deg so the light corner sits on the reading start. */
export const gradients = {
  hero: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
  heroRTL: 'linear-gradient(225deg, #0F766E 0%, #115E59 100%)',
  /** Solid fallback drawn underneath (and used alone if gradients don't render). */
  heroFallback: '#0F766E',
} as const;

/** Motion (10). Use RN Animated with the native driver; respect reduce motion. */
export const motion = {
  fast: 150,
  base: 250,
  slow: 350,
  /** Cubic-bezier control points; pass to Easing.bezier(...). */
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    decelerate: [0.05, 0.7, 0.1, 1] as const,
  },
} as const;

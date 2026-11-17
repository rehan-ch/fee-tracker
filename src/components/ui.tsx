/**
 * Shared building blocks (docs/DESIGN.md section 7). They follow the active
 * language's reading direction (Urdu is right-to-left) via `useApp().isRTL` /
 * `rowDir`, set Latin text and numbers in Inter and Urdu in Nastaliq, use
 * tokens from ../theme only, and give press feedback with `android_ripple`.
 * Larger pieces (sheet, FAB, meters, stat tiles, tab bar) live in ./ds/.
 */
import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DueStatus } from '../lib/dues';
import { useApp } from '../state/app';
import {
  advanceColors,
  colors,
  feedbackColors,
  gradients,
  inactiveColors,
  radius,
  shadow,
  size,
  space,
  statusColors,
  typography,
  type TypeRole,
} from '../theme';
import { fontStyleFor, snapWeight, useFontsLoaded } from './ds/fonts';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * LEFT-TO-RIGHT ISOLATE and POP DIRECTIONAL ISOLATE, written as escapes so no
 * invisible characters sit in the source.
 */
const LRI = '\u2066';
const PDI = '\u2069';

/**
 * Wraps text in a left-to-right isolate (U+2066 ... U+2069). Use it when a
 * number or phone number sits inside an Urdu sentence built in code, so
 * "Rs 2,000" is not reordered.
 */
export function bidiIsolate(s: string): string {
  return `${LRI}${s}${PDI}`;
}

/** Arabic-script letters (Urdu, Arabic and their presentation forms). */
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * True when the text contains Urdu (Arabic-script) letters. Use it for text
 * the business wrote itself (names, templates, payment details), whose
 * language can differ from the app's.
 */
export function hasUrdu(s: string): boolean {
  return ARABIC_SCRIPT.test(s);
}

/**
 * The symbol money() puts before amounts ("Rs" for PKR, otherwise the
 * currency code), for Field `prefix`. Mirrors formatMoney in src/lib/money.ts;
 * switch to a currencySymbol() export from there once it exists.
 */
export function useCurrencyPrefix(): string {
  const { business } = useApp();
  const currency = business?.currency ?? 'PKR';
  return currency === 'PKR' ? 'Rs' : currency;
}

/** Joins the parts of a spoken (TalkBack) label with the script's comma, skipping empty parts. */
export function joinA11y(parts: (string | number | null | undefined | false)[], isRTL: boolean): string {
  return parts
    .filter((p): p is string | number => p !== null && p !== undefined && p !== false && p !== '')
    .join(isRTL ? '، ' : ', ');
}

/**
 * `boxShadow` needs Android 9+ (RN 0.88, New Architecture). On older phones
 * elevated surfaces get a hairline border instead so they stay visible.
 */
export const SHADOWS_SUPPORTED = Platform.OS !== 'android' || Number(Platform.Version) >= 28;

/** Hairline border used in place of a shadow where boxShadow isn't drawn. */
export const shadowFallback: ViewStyle = SHADOWS_SUPPORTED
  ? {}
  : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.outlineVariant };

/** True inside a `Card variant="hero"`: text defaults to white there. */
const OnHeroContext = createContext(false);

/** Whether the component sits on the teal hero (white content). */
export function useOnHero(): boolean {
  return useContext(OnHeroContext);
}

/**
 * Font, size, weight and line height for a type role (docs/DESIGN.md 5.2-5.3).
 * `urdu` picks Nastaliq and the Urdu scale; `naturalLine` drops the Urdu line
 * height for single-line controls (buttons, chips, tabs), whose containers grow.
 */
export function scriptTextStyle(
  role: TypeRole,
  urdu: boolean,
  loaded: boolean,
  opts: { weight?: number; naturalLine?: boolean } = {},
): TextStyle {
  const scale = urdu ? typography.urdu[role] : typography.latin[role];
  return {
    fontSize: scale.fontSize,
    lineHeight: urdu && opts.naturalLine ? undefined : scale.lineHeight,
    ...fontStyleFor(opts.weight ?? scale.fontWeight, urdu, loaded),
    ...(urdu ? { letterSpacing: 0 } : null),
  };
}

/** Hook form of scriptTextStyle for raw Text / TextInput in screens. */
export function useScriptTextStyle(
  role: TypeRole,
  opts: { weight?: number; naturalLine?: boolean; latin?: boolean } = {},
): TextStyle {
  const { isRTL } = useApp();
  const loaded = useFontsLoaded();
  const numeric = role === 'hero' || role === 'headline';
  return scriptTextStyle(role, isRTL && !opts.latin && !numeric, loaded, opts);
}

const STYLE_INNER_KEYS = new Set([
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'gap',
  'rowGap',
  'columnGap',
  'alignItems',
  'justifyContent',
  'flexDirection',
  'flexWrap',
]);

/** Splits a style into the outer box (margins, size, colours) and inner layout (padding, gap). */
function splitStyle(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const k of Object.keys(flat)) (STYLE_INNER_KEYS.has(k) ? inner : outer)[k] = flat[k];
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

// ---------------------------------------------------------------------------
// Text and layout
// ---------------------------------------------------------------------------

export type TxtVariant =
  | 'hero'
  | 'headline'
  | 'title'
  | 'h2'
  | 'bodyLarge'
  | 'body'
  | 'muted'
  | 'small'
  | 'label';

export type TextTone =
  | 'text'
  | 'secondary'
  | 'muted'
  | 'primary'
  | 'onPrimary'
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'danger';

const TONE_COLOR: Record<TextTone, string> = {
  text: colors.text,
  secondary: colors.textSecondary,
  muted: colors.muted,
  primary: colors.primary,
  onPrimary: colors.onPrimary,
  paid: statusColors.paid.fg,
  partial: statusColors.partial.fg,
  unpaid: statusColors.unpaid.fg,
  danger: colors.danger,
};

const VARIANT_COLOR: Record<TxtVariant, string> = {
  hero: colors.text,
  headline: colors.text,
  title: colors.text,
  h2: colors.text,
  bodyLarge: colors.text,
  body: colors.text,
  muted: colors.textSecondary,
  small: colors.muted,
  label: colors.textSecondary,
};

const HERO_VARIANT_COLOR: Record<TxtVariant, string> = {
  ...VARIANT_COLOR,
  hero: colors.onPrimary,
  headline: colors.onPrimary,
  title: colors.onPrimary,
  h2: colors.onPrimary,
  bodyLarge: colors.onPrimary,
  body: colors.onPrimary,
  muted: colors.onPrimaryMuted,
  small: colors.onPrimaryMuted,
  label: colors.onPrimaryMuted,
};

/**
 * Text in the app's type scale. Picks Inter or Nastaliq by language (hero and
 * headline always Inter, they are numbers), applies the Urdu sizes and line
 * heights, and aligns to the reading side. `ltr` keeps Latin text (phones,
 * codes) in Inter and left-to-right.
 */
export function Txt({
  children,
  variant = 'body',
  color,
  tone,
  weight,
  bold,
  center,
  align,
  numberOfLines,
  header,
  ltr,
  style,
  accessibilityLabel,
  maxFontSizeMultiplier,
  adjustsFontSizeToFit,
  minimumFontScale,
  selectable,
}: {
  children: ReactNode;
  variant?: TxtVariant;
  color?: string;
  /** Token colour; `color` wins over it. */
  tone?: TextTone;
  weight?: 400 | 500 | 600 | 700;
  /** Same as weight={700}. */
  bold?: boolean;
  center?: boolean;
  /** Reading-side alignment; `center` wins over it. */
  align?: 'start' | 'end' | 'center';
  numberOfLines?: number;
  /** Announce as a heading (accessibilityRole="header"). */
  header?: boolean;
  /** Latin text that must stay left-to-right in Urdu (Inter font). */
  ltr?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  maxFontSizeMultiplier?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
  selectable?: boolean;
}) {
  const { isRTL } = useApp();
  const loaded = useFontsLoaded();
  const onHero = useContext(OnHeroContext);
  const numeric = variant === 'hero' || variant === 'headline';
  const urdu = isRTL && !ltr && !numeric;
  const scale = urdu ? typography.urdu[variant] : typography.latin[variant];

  // Screens may still pass fontSize / fontWeight in `style`. Keep line height
  // in proportion (never clip) and map the weight to a loaded face.
  const flat = style ? (StyleSheet.flatten(style) as TextStyle) : undefined;
  let rest: TextStyle | undefined;
  let lineHeight = scale.lineHeight;
  let w: number = weight ?? (bold ? 700 : scale.fontWeight);
  if (flat) {
    const { fontWeight: styleWeight, ...others } = flat;
    rest = others;
    if (styleWeight != null) w = snapWeight(styleWeight);
    if (typeof rest.fontSize === 'number' && rest.lineHeight == null && scale.lineHeight) {
      const ratio = scale.lineHeight / scale.fontSize;
      lineHeight = Math.ceil(
        rest.fontSize * (urdu ? Math.max(typography.urduMinLineRatio, ratio) : ratio),
      );
    }
  }

  const textAlign: TextStyle['textAlign'] =
    center || align === 'center'
      ? 'center'
      : align === 'end'
        ? isRTL
          ? 'left'
          : 'right'
        : isRTL
          ? 'right'
          : 'left';
  const hero = variant === 'hero';

  return (
    <Text
      accessibilityRole={header ? 'header' : undefined}
      accessibilityLabel={accessibilityLabel}
      selectable={selectable}
      numberOfLines={numberOfLines ?? (hero ? 1 : undefined)}
      adjustsFontSizeToFit={adjustsFontSizeToFit ?? (hero ? true : undefined)}
      minimumFontScale={minimumFontScale ?? (hero ? 0.6 : undefined)}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (hero ? 1.3 : undefined)}
      style={[
        {
          fontSize: scale.fontSize,
          lineHeight,
          color: (onHero ? HERO_VARIANT_COLOR : VARIANT_COLOR)[variant],
          textAlign,
          writingDirection: urdu ? 'rtl' : 'ltr',
        },
        fontStyleFor(w, urdu, loaded),
        numeric ? styles.proportionalNums : null,
        tone ? { color: TONE_COLOR[tone] } : null,
        color ? { color } : null,
        rest ?? null,
        urdu ? styles.urduText : null,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A money amount: `useApp().money(value)` in Inter, left-to-right, Latin
 * digits. Use `tabular` in columns (list rows, tables) and leave it off for
 * standalone figures. Alignment follows the reading side unless set.
 */
export function Amount({
  value,
  variant = 'body',
  tone,
  color,
  weight,
  tabular,
  align = 'start',
  numberOfLines,
  accessibilityLabel,
  style,
}: {
  value: number;
  variant?: 'hero' | 'headline' | 'title' | 'h2' | 'bodyLarge' | 'body' | 'small' | 'label';
  tone?: TextTone;
  color?: string;
  weight?: 400 | 500 | 600 | 700;
  tabular?: boolean;
  align?: 'start' | 'end' | 'center';
  numberOfLines?: number;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { money } = useApp();
  const text = money(value);
  return (
    <Txt
      variant={variant}
      tone={tone}
      color={color}
      weight={weight}
      align={align}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel ?? text}
      ltr
      style={[tabular ? styles.tabularNums : styles.proportionalNums, style]}
    >
      {text}
    </Txt>
  );
}

/**
 * Horizontal layout that follows the reading direction (row-reverse in Urdu).
 * `accessible` + `accessibilityLabel` make the whole row one TalkBack item
 * (for example a label and its amount).
 */
export function Row({
  children,
  gap = space.sm,
  align = 'center',
  justify,
  wrap,
  style,
  accessible,
  accessibilityLabel,
}: {
  children: ReactNode;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
}) {
  const { rowDir } = useApp();
  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          flexDirection: rowDir,
          alignItems: align,
          justifyContent: justify,
          gap,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type CardVariant = 'elevated' | 'outlined' | 'filled' | 'tonal' | 'hero';

const CARD_VARIANT: Record<CardVariant, ViewStyle> = {
  elevated: { backgroundColor: colors.card, ...shadow.level1, ...shadowFallback },
  outlined: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.outlineVariant },
  filled: { backgroundColor: colors.surfaceContainer },
  tonal: { backgroundColor: colors.primarySubtle },
  hero: {
    backgroundColor: gradients.heroFallback,
    borderRadius: radius.xl,
    padding: 20,
    ...shadow.level2,
  },
};

/**
 * Card container (7.4). `elevated` (default, white + level1 shadow),
 * `outlined`, `filled`, `tonal`, or `hero` (teal gradient, white text inside).
 * With `onPress` the whole card is a button with ripple.
 */
export function Card({
  children,
  style,
  variant = 'elevated',
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { isRTL } = useApp();
  const hero = variant === 'hero';
  const base: StyleProp<ViewStyle> = [
    styles.card,
    CARD_VARIANT[variant],
    hero ? { backgroundImage: isRTL ? gradients.heroRTL : gradients.hero } : null,
  ];
  const content = hero ? <OnHeroContext value>{children}</OnHeroContext> : children;

  if (!onPress) return <View style={[base, style]}>{content}</View>;

  // Outer box keeps the shadow and colour; the inner clip keeps the ripple inside the corners.
  const { outer, inner } = splitStyle([base, style]);
  return (
    <View style={[outer, styles.noPadding]}>
      <View style={[styles.clip, styles.grow, { borderRadius: outer.borderRadius ?? radius.lg }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          onPress={onPress}
          android_ripple={{ color: hero ? colors.rippleOnPrimary : colors.ripple }}
          style={[styles.grow, inner]}
        >
          {content}
        </Pressable>
      </View>
    </View>
  );
}

/** Scrolling screen body with 16dp padding. `safeTop` pads by the status bar (screens without a header). */
export function Screen({
  children,
  contentStyle,
  safeTop,
}: {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  safeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenContent,
        safeTop ? { paddingTop: insets.top + space.lg } : null,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/**
 * Section heading (7.5): sentence case, `label` style, announced as a header,
 * with an optional text-button action at the end.
 */
export function SectionHeader({
  title,
  action,
  style,
}: {
  title: string;
  /** End-aligned text button. `iconFlipForRTL` mirrors direction icons (arrow, trending-up) in Urdu. */
  action?: { label: string; onPress: () => void; icon?: IconName; iconFlipForRTL?: boolean };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row justify="space-between" gap={space.sm} style={[styles.sectionHeader, style]}>
      <View style={styles.flex}>
        <Txt variant="label" header>
          {title}
        </Txt>
      </View>
      {action ? (
        <Button
          title={action.label}
          icon={action.icon}
          iconFlipForRTL={action.iconFlipForRTL}
          variant="text"
          onPress={action.onPress}
          compact
        />
      ) : null}
    </Row>
  );
}

/** Older name for a section heading; now sentence case with no letter spacing. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Txt variant="label" header style={styles.sectionTitle}>
      {children}
    </Txt>
  );
}

/** Ionicons glyph. Decorative (hidden from TalkBack); give the parent the label. */
export function Icon({
  name,
  size: iconSize = 22,
  color = colors.text,
  flipForRTL,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Mirror direction-dependent icons (arrows, chevrons) in Urdu. */
  flipForRTL?: boolean;
}) {
  const { isRTL } = useApp();
  return (
    <Ionicons
      name={name}
      size={iconSize}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={flipForRTL && isRTL ? styles.flipped : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'filled'
  | 'tonal'
  | 'outlined'
  | 'text';

type ButtonKind = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

const BUTTON_KIND: Record<ButtonVariant, ButtonKind> = {
  primary: 'filled',
  filled: 'filled',
  secondary: 'tonal',
  tonal: 'tonal',
  ghost: 'text',
  text: 'text',
  outlined: 'outlined',
  danger: 'danger',
};

const BUTTON_COLORS: Record<ButtonKind, { bg: string; fg: string; border?: string; ripple: string }> = {
  filled: { bg: colors.primary, fg: colors.onPrimary, ripple: colors.rippleOnPrimary },
  tonal: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer, ripple: colors.ripple },
  outlined: { bg: 'transparent', fg: colors.primary, border: colors.outline, ripple: colors.ripple },
  text: { bg: 'transparent', fg: colors.primary, ripple: colors.ripple },
  danger: { bg: colors.errorContainer, fg: colors.error, ripple: colors.rippleNeutral },
};

/**
 * M3 button (7.2). Variants: filled/primary, tonal/secondary, outlined,
 * text/ghost, danger. `size="lg"` is 56dp high. `destructive` turns an
 * outlined or text button red. While `loading`, a spinner replaces the
 * content and the button keeps its width.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size: buttonSize = 'md',
  icon,
  iconFlipForRTL,
  disabled,
  loading,
  destructive,
  compact,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: IconName;
  /** Mirror a direction-bearing icon (arrow, send) in Urdu. */
  iconFlipForRTL?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Red content (and border) for outlined / text buttons that delete or remove. */
  destructive?: boolean;
  /** Less horizontal padding (12dp), for text buttons in headers and banners. */
  compact?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { rowDir, isRTL } = useApp();
  const loaded = useFontsLoaded();
  const kind = BUTTON_KIND[variant];
  const c = BUTTON_COLORS[kind];
  const red = destructive && (kind === 'outlined' || kind === 'text');
  const fg = red ? colors.error : c.fg;
  const border = red && kind === 'outlined' ? colors.error : c.border;
  const lg = buttonSize === 'lg';
  const inactive = !!(disabled || loading);
  return (
    <View
      style={[
        styles.buttonOuter,
        disabled && !loading ? styles.disabled : null,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: inactive, busy: !!loading }}
        onPress={onPress}
        disabled={inactive}
        android_ripple={{ color: c.ripple }}
        style={[
          styles.buttonInner,
          {
            flexDirection: rowDir,
            backgroundColor: c.bg,
            minHeight: lg ? size.buttonLg : size.button,
            paddingHorizontal: compact ? space.md : lg ? space.xl : 20,
          },
          border ? { borderWidth: 1, borderColor: border } : null,
        ]}
      >
        <View style={[styles.buttonContent, { flexDirection: rowDir }, loading ? styles.invisible : null]}>
          {icon ? <Icon name={icon} size={20} color={fg} flipForRTL={iconFlipForRTL} /> : null}
          <Text
            style={[
              scriptTextStyle('button', isRTL, loaded, { naturalLine: true }),
              styles.buttonText,
              { color: fg },
            ]}
          >
            {title}
          </Text>
        </View>
        {loading ? (
          <View style={styles.buttonSpinner}>
            <ActivityIndicator color={fg} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const ICON_BUTTON_COLORS = {
  standard: { bg: 'transparent', fg: colors.primary, border: undefined },
  tonal: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer, border: undefined },
  filled: { bg: colors.primary, fg: colors.onPrimary, border: undefined },
  outlined: { bg: 'transparent', fg: colors.primary, border: colors.outline },
} as const;

/**
 * Icon-only button with a 48x48 touch target (7.2). `label` is required and
 * is what TalkBack reads. `standard` has a borderless ripple; `tonal`,
 * `filled` and `outlined` draw a 40dp circle.
 */
export function IconButton({
  name,
  onPress,
  label,
  color,
  flipForRTL,
  variant = 'standard',
  disabled,
  iconSize = 24,
  accessibilityHint,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  flipForRTL?: boolean;
  variant?: 'standard' | 'tonal' | 'filled' | 'outlined';
  disabled?: boolean;
  iconSize?: number;
  accessibilityHint?: string;
}) {
  const c = ICON_BUTTON_COLORS[variant];
  const fg = color ?? c.fg;
  const icon = <Icon name={name} color={fg} size={iconSize} flipForRTL={flipForRTL} />;
  const a11y = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: label,
    accessibilityHint,
    accessibilityState: { disabled: !!disabled },
  };
  if (variant === 'standard') {
    return (
      <Pressable
        {...a11y}
        onPress={onPress}
        disabled={disabled}
        android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
        style={[styles.iconButton, disabled ? styles.disabledControl : null]}
      >
        {icon}
      </Pressable>
    );
  }
  return (
    <Pressable
      {...a11y}
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconButton, disabled ? styles.disabledControl : null]}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: c.bg },
            c.border ? { borderWidth: 1, borderColor: c.border } : null,
          ]}
        >
          {pressed ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: variant === 'filled' ? colors.rippleOnPrimary : colors.ripple },
              ]}
            />
          ) : null}
          {icon}
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * M3 outlined text field with the label above (7.3). 56dp, 1dp outline, 2dp
 * primary on focus, 2dp red with an announced error row. `prefix` (e.g. "Rs")
 * sits on the reading-start side; `size="amount"` is a big centred number.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  keyboardType,
  multiline,
  maxLength,
  autoFocus,
  ltr,
  secure,
  prefix,
  size: fieldSize = 'default',
  onSubmitEditing,
  returnKeyType,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  /** Keep left-to-right even in Urdu (phone numbers, amounts). */
  ltr?: boolean;
  /** Hide the text (passwords, PINs). */
  secure?: boolean;
  /** Short Latin text before the value, for example "Rs". */
  prefix?: string;
  /** 'amount': Inter 28 bold, centred, number pad, left-to-right. */
  size?: 'default' | 'amount';
  onSubmitEditing?: () => void;
  returnKeyType?: ReturnKeyTypeOptions;
  editable?: boolean;
}) {
  const { isRTL, rowDir, t } = useApp();
  const loaded = useFontsLoaded();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const amount = fieldSize === 'amount';
  const keepLtr = !!ltr || amount;
  const urdu = isRTL && !keepLtr;
  const noCaps = secure || keyboardType === 'email-address' || keyboardType === 'url';
  const borderWidth = error || focused ? 2 : 1;
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.outline;
  const fontStyle: TextStyle = amount
    ? { fontSize: 28, ...fontStyleFor(700, false, loaded) }
    : { fontSize: urdu ? 17 : 16, ...fontStyleFor(400, urdu, loaded) };

  return (
    <View style={styles.field}>
      <Txt variant="label">{label}</Txt>
      <Pressable
        accessible={false}
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.inputBox,
          {
            flexDirection: rowDir,
            borderWidth,
            borderColor,
            paddingHorizontal: space.lg - (borderWidth - 1),
          },
          multiline ? styles.inputBoxMultiline : null,
          editable === false ? styles.inputBoxReadOnly : null,
        ]}
      >
        {prefix ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[
              amount
                ? { fontSize: 20, ...fontStyleFor(600, false, loaded) }
                : { fontSize: 16, ...fontStyleFor(500, false, loaded) },
              styles.prefix,
            ]}
          >
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={prefix ? `${label} (${prefix})` : label}
          accessibilityHint={error ?? hint}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          keyboardType={keyboardType ?? (amount ? 'number-pad' : undefined)}
          multiline={multiline}
          maxLength={maxLength}
          autoFocus={autoFocus}
          secureTextEntry={secure}
          autoCapitalize={noCaps ? 'none' : undefined}
          autoCorrect={noCaps ? false : undefined}
          onSubmitEditing={onSubmitEditing ? () => onSubmitEditing() : undefined}
          returnKeyType={returnKeyType}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            fontStyle,
            {
              textAlign: amount ? 'center' : isRTL ? 'right' : 'left',
              writingDirection: urdu ? 'rtl' : 'ltr',
            },
            multiline ? styles.inputMultiline : null,
          ]}
        />
      </Pressable>
      {error ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={t('designErrorLabel', { message: error })}
          style={[styles.errorRow, { flexDirection: rowDir }]}
        >
          <Icon name="alert-circle" size={18} color={colors.danger} />
          <View style={styles.flex}>
            <Txt variant="small" color={colors.danger}>
              {error}
            </Txt>
          </View>
        </View>
      ) : hint ? (
        <Txt variant="small">{hint}</Txt>
      ) : null}
    </View>
  );
}

/** Pill search field on surfaceContainer with a labelled clear button. */
export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const { isRTL, rowDir, t } = useApp();
  const loaded = useFontsLoaded();
  return (
    <View
      style={[
        styles.search,
        { flexDirection: rowDir },
        value ? (isRTL ? { paddingLeft: space.xs } : { paddingRight: space.xs }) : null,
      ]}
    >
      <Icon name="search" size={20} color={colors.textSecondary} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[
          styles.searchInput,
          { fontSize: isRTL ? 17 : 16, ...fontStyleFor(400, isRTL, loaded) },
          { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
        ]}
        returnKeyType="search"
      />
      {value ? (
        <IconButton
          name="close-circle"
          label={t('designClearSearch')}
          color={colors.textSecondary}
          iconSize={20}
          onPress={() => onChangeText('')}
        />
      ) : null}
    </View>
  );
}

/**
 * M3 chip (7.3). `filter` (default): selected chips fill with
 * primaryContainer and show a check. `assist`: no check, keeps its icon
 * (actions like "Edit message"). 40dp visual, 48dp touch.
 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  variant = 'filter',
  disabled,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  variant?: 'filter' | 'assist';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { rowDir, isRTL } = useApp();
  const loaded = useFontsLoaded();
  const on = variant === 'filter' && !!selected;
  const leading: IconName | undefined = on ? 'checkmark' : icon;
  const fg = on ? colors.onPrimaryContainer : colors.text;
  return (
    <View
      hitSlop={4}
      style={[
        styles.chipOuter,
        on ? styles.chipSelected : styles.chipUnselected,
        disabled ? styles.disabledControl : null,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: variant === 'filter' ? !!selected : undefined, disabled: !!disabled }}
        onPress={onPress}
        disabled={disabled}
        hitSlop={4}
        android_ripple={{ color: colors.ripple }}
        style={[
          styles.chipInner,
          { flexDirection: rowDir },
          leading ? (isRTL ? styles.chipIconRtl : styles.chipIconLtr) : null,
        ]}
      >
        {leading ? (
          <Icon name={leading} size={size.iconSm} color={on ? colors.onPrimaryContainer : colors.primary} />
        ) : null}
        <Text
          style={[
            scriptTextStyle('labelLarge', isRTL, loaded, { naturalLine: true }),
            { color: fg, writingDirection: isRTL ? 'rtl' : 'ltr' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Horizontal scrolling row of chips in reading order. `bleed` lets the row
 * scroll to the screen edges inside a 16dp-padded screen.
 */
export function ChipRow({ children, bleed }: { children: ReactNode; bleed?: boolean }) {
  const { rowDir, isRTL } = useApp();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolledFor = useRef<boolean | null>(null);
  // In Urdu the first chip is at the right end of the content: start scrolled there.
  const onContentSizeChange = () => {
    if (scrolledFor.current === isRTL) return;
    scrolledFor.current = isRTL;
    if (isRTL) ref.current?.scrollToEnd({ animated: false });
    else ref.current?.scrollTo({ x: 0, animated: false });
  };
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={onContentSizeChange}
      style={bleed ? styles.chipRowBleed : null}
      contentContainerStyle={[
        styles.chipRow,
        { flexDirection: rowDir },
        bleed ? styles.chipRowBleedContent : null,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Status keys that have reserved colours and icons. */
export type StatusKey = DueStatus | 'inactive' | 'advance';

const STATUS_SET: Record<
  StatusKey,
  { fg: string; bg: string; onSoft: string; icon: IconName }
> = {
  paid: statusColors.paid,
  partial: statusColors.partial,
  unpaid: statusColors.unpaid,
  inactive: inactiveColors,
  advance: advanceColors,
};

function toneFromColor(color: string | undefined): DueStatus | undefined {
  if (!color) return undefined;
  return (Object.keys(statusColors) as DueStatus[]).find((k) => statusColors[k].fg === color);
}

/**
 * M3 segmented buttons (7.3), used for tabs like Unpaid / Partial / Paid.
 * Options may carry an `icon`, a `count` (shown as "· 12") and a status
 * `tone` (status soft fill and icon when selected).
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: {
    key: K;
    label: string;
    count?: number;
    /** Older API: a status fg colour. Mapped to the matching `tone`. */
    color?: string;
    icon?: IconName;
    tone?: DueStatus;
  }[];
  value: K;
  onChange: (k: K) => void;
  /** What the group chooses (e.g. "Language"), read by TalkBack before the options. */
  accessibilityLabel?: string;
}) {
  const { rowDir, isRTL } = useApp();
  const loaded = useFontsLoaded();
  return (
    <View
      style={[styles.segmented, { flexDirection: rowDir }]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o, i) => {
        const selected = o.key === value;
        const tone = o.tone ?? toneFromColor(o.color);
        const st = tone ? STATUS_SET[tone] : undefined;
        const icon: IconName | undefined = st ? st.icon : selected ? 'checkmark' : o.icon;
        const fg = selected ? (st ? st.onSoft : colors.onPrimaryContainer) : colors.text;
        const iconColor = st ? (selected ? st.onSoft : st.fg) : fg;
        return (
          <View key={o.key} style={[styles.segmentWrap, { flexDirection: rowDir }]}>
            {i > 0 ? <View style={styles.segmentDivider} /> : null}
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={o.count !== undefined ? `${o.label}, ${o.count}` : o.label}
              onPress={() => onChange(o.key)}
              android_ripple={{ color: colors.ripple }}
              style={[
                styles.segment,
                { flexDirection: rowDir },
                selected ? { backgroundColor: st ? st.bg : colors.primaryContainer } : null,
              ]}
            >
              {icon ? <Icon name={icon} size={size.iconSm} color={iconColor} /> : null}
              <Text
                numberOfLines={2}
                style={[
                  scriptTextStyle('labelLarge', isRTL, loaded, { naturalLine: true }),
                  styles.segmentText,
                  { color: fg, writingDirection: isRTL ? 'rtl' : 'ltr' },
                ]}
              >
                {o.label}
                {o.count !== undefined ? (
                  <Text style={[fontStyleFor(600, false, loaded), styles.tabularNums]}>
                    {` · ${o.count}`}
                  </Text>
                ) : null}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** RN Switch with the app's track colours; `accessibilityLabel` is required. */
export function AppSwitch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.switchTrackOff, true: colors.primary }}
      thumbColor={colors.white}
    />
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Small text style for badges: Inter 12/600, Urdu 13/700 with a 2x line. */
function useBadgeText(): TextStyle {
  const { isRTL } = useApp();
  const loaded = useFontsLoaded();
  return { ...scriptTextStyle('labelSmall', isRTL, loaded), writingDirection: isRTL ? 'rtl' : 'ltr' };
}

/**
 * Due status pill: soft colour, status icon and word (never colour alone).
 * In a column, pass `style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }}` to keep it compact.
 */
export function StatusBadge({ status, style }: { status: DueStatus; style?: StyleProp<ViewStyle> }) {
  const { t, rowDir } = useApp();
  const textStyle = useBadgeText();
  const c = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, flexDirection: rowDir }, style]}>
      <Icon name={c.icon} size={14} color={c.fg} />
      <Text maxFontSizeMultiplier={1.3} style={[textStyle, { color: c.onSoft }]}>
        {t(status)}
      </Text>
    </View>
  );
}

export type BadgeTone =
  | 'neutral'
  | 'premium'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | StatusKey;

const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string; icon?: IconName; iconColor?: string }> = {
  neutral: { bg: colors.surfaceContainerHigh, fg: colors.textSecondary },
  premium: { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer, icon: 'star', iconColor: colors.tertiary },
  info: { bg: colors.infoContainer, fg: colors.onInfoContainer },
  success: { bg: colors.successContainer, fg: colors.onSuccessContainer },
  warning: { bg: colors.warningContainer, fg: colors.onWarningContainer },
  error: { bg: colors.errorContainer, fg: colors.onErrorContainer },
  paid: { bg: statusColors.paid.bg, fg: statusColors.paid.onSoft, icon: statusColors.paid.icon, iconColor: statusColors.paid.fg },
  partial: { bg: statusColors.partial.bg, fg: statusColors.partial.onSoft, icon: statusColors.partial.icon, iconColor: statusColors.partial.fg },
  unpaid: { bg: statusColors.unpaid.bg, fg: statusColors.unpaid.onSoft, icon: statusColors.unpaid.icon, iconColor: statusColors.unpaid.fg },
  inactive: { bg: inactiveColors.bg, fg: inactiveColors.onSoft, icon: inactiveColors.icon, iconColor: inactiveColors.fg },
  advance: { bg: advanceColors.bg, fg: advanceColors.onSoft, icon: advanceColors.icon, iconColor: advanceColors.fg },
};

/** Small labelled pill: neutral, premium (indigo + star), info, feedback or a status tone. */
export function Badge({
  label,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { rowDir } = useApp();
  const textStyle = useBadgeText();
  const c = BADGE_TONES[tone];
  const name = icon ?? c.icon;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, flexDirection: rowDir }, style]}>
      {name ? <Icon name={name} size={14} color={c.iconColor ?? c.fg} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={[textStyle, { color: c.fg }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * 40dp status circle (soft colour, status icon in fg): the leading element of
 * due rows. Hidden from TalkBack unless given a label; put the status word in
 * the row's label.
 */
export function StatusIcon({
  status,
  size: circle = size.statusIcon,
  accessibilityLabel,
}: {
  status: StatusKey;
  size?: number;
  accessibilityLabel?: string;
}) {
  const c = STATUS_SET[status];
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!accessibilityLabel}
      style={[styles.circle, { width: circle, height: circle, backgroundColor: c.bg }]}
    >
      <Icon name={c.icon} size={Math.round(circle * 0.55)} color={c.fg} />
    </View>
  );
}

/** Decorative initial in a primarySubtle circle (40 or 56dp). Handles Urdu names. */
export function Avatar({ name, size: diameter = 40 }: { name: string; size?: 40 | 56 }) {
  const loaded = useFontsLoaded();
  const initial = Array.from(name.trim())[0]?.toUpperCase();
  const urdu = !!initial && hasUrdu(initial);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        styles.clip,
        { width: diameter, height: diameter, backgroundColor: colors.primarySubtle },
      ]}
    >
      {initial ? (
        <Text
          allowFontScaling={false}
          style={[
            { fontSize: diameter === 56 ? 22 : 16, color: colors.onPrimaryContainer, textAlign: 'center' },
            fontStyleFor(600, urdu, loaded),
          ]}
        >
          {initial}
        </Text>
      ) : (
        <Icon name="person" size={diameter === 56 ? 26 : 20} color={colors.onPrimaryContainer} />
      )}
    </View>
  );
}

const EMPTY_TONES = {
  primary: { bg: colors.primarySubtle, fg: colors.primary },
  success: { bg: colors.successContainer, fg: colors.success },
  premium: { bg: colors.tertiaryContainer, fg: colors.tertiary },
  neutral: { bg: colors.surfaceContainer, fg: colors.textSecondary },
} as const;

/** Empty / done state: 72dp tonal icon circle, centred title and body, action below (max 320). */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'primary',
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: keyof typeof EMPTY_TONES;
}) {
  const c = EMPTY_TONES[tone];
  return (
    <View style={styles.empty}>
      <View style={[styles.circle, styles.emptyCircle, { backgroundColor: c.bg }]}>
        <Icon name={icon} size={36} color={c.fg} />
      </View>
      <Txt variant="h2" center header>
        {title}
      </Txt>
      {body ? (
        <Txt variant="muted" center>
          {body}
        </Txt>
      ) : null}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const TONAL_TONES = {
  primary: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  danger: { bg: colors.errorContainer, fg: colors.error },
  neutral: { bg: colors.surfaceContainer, fg: colors.textSecondary },
  premium: { bg: colors.tertiaryContainer, fg: colors.tertiary },
  success: { bg: colors.successContainer, fg: colors.success },
  warning: { bg: colors.warningContainer, fg: colors.warning },
} as const;

export type TonalTone = keyof typeof TONAL_TONES;

/**
 * Decorative 40dp tonal circle with a 20dp icon: the ListItem leading icon,
 * and the same look for info rows, welcome benefits, area and payment rows.
 * Hidden from TalkBack; the text beside it carries the meaning.
 */
export function TonalIcon({ name, tone = 'primary' }: { name: IconName; tone?: TonalTone }) {
  const c = TONAL_TONES[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, styles.listIcon, { backgroundColor: c.bg }]}
    >
      <Icon name={name} size={20} color={c.fg} />
    </View>
  );
}

/**
 * List row (7.5): leading icon in a 40dp tonal circle (or any `leading`
 * node, e.g. an Avatar), title, optional subtitle, and `right` content or a
 * chevron when pressable. 56dp high, 72dp with a subtitle. `right` sits
 * inside the row's button, so put a real button (delete, undo) in
 * `trailingAction` instead: it renders beside the row, where TalkBack can
 * reach it on its own.
 */
export function ListItem({
  icon,
  title,
  subtitle,
  onPress,
  danger,
  right,
  trailingAction,
  leading,
  iconTone,
  accessibilityLabel,
  disabled,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
  /** A separate button at the end of the row (e.g. a labelled IconButton). */
  trailingAction?: ReactNode;
  leading?: ReactNode;
  iconTone?: TonalTone;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const { rowDir } = useApp();
  const row = (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={onPress ? { disabled: !!disabled } : undefined}
      onPress={onPress}
      disabled={!onPress || disabled}
      android_ripple={onPress ? { color: colors.rippleNeutral } : undefined}
      style={[
        styles.listItem,
        { flexDirection: rowDir, minHeight: subtitle ? 72 : 56 },
        disabled ? styles.disabled : null,
      ]}
    >
      {leading ?? (icon ? <TonalIcon name={icon} tone={danger ? 'danger' : (iconTone ?? 'primary')} /> : null)}
      <View style={styles.listText}>
        <Txt color={danger ? colors.danger : undefined}>{title}</Txt>
        {subtitle ? <Txt variant="small">{subtitle}</Txt> : null}
      </View>
      {right ??
        (onPress ? (
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} flipForRTL />
        ) : null)}
    </Pressable>
  );
  if (!trailingAction) return row;
  return (
    <View style={[styles.listSplit, { flexDirection: rowDir }]}>
      <View style={styles.flex}>{row}</View>
      <View style={styles.listTrailing}>{trailingAction}</View>
    </View>
  );
}

/** Hairline divider; `inset` indents it from the reading start (72 under leading icons). */
export function Divider({ inset = 0 }: { inset?: number }) {
  const { isRTL } = useApp();
  return (
    <View style={[styles.divider, inset ? (isRTL ? { marginRight: inset } : { marginLeft: inset }) : null]} />
  );
}

/**
 * Feedback banner (7.4): info, warning, error or success colours, a leading
 * icon, optional title, body and an end-aligned text action. Error banners
 * are always announced; pass `live` to announce other tones when they appear
 * or change (for example a note that reacts to typing).
 */
export function Banner({
  tone,
  title,
  body,
  action,
  live,
}: {
  tone: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  body: string;
  action?: { label: string; onPress: () => void };
  /** Announce changes politely (TalkBack live region). Always on for `error`. */
  live?: boolean;
}) {
  const { rowDir, isRTL } = useApp();
  const loaded = useFontsLoaded();
  const c = feedbackColors[tone];
  return (
    <View
      accessibilityLiveRegion={tone === 'error' || live ? 'polite' : undefined}
      style={[styles.banner, { backgroundColor: c.container, borderColor: c.border }]}
    >
      <View style={[styles.bannerRow, { flexDirection: rowDir }]}>
        <View style={styles.bannerIcon}>
          <Icon name={c.icon} size={20} color={c.fg} />
        </View>
        <View style={styles.listText}>
          {title ? (
            <Txt bold color={c.onContainer}>
              {title}
            </Txt>
          ) : null}
          <Txt variant="muted" color={c.onContainer}>
            {body}
          </Txt>
        </View>
      </View>
      {action ? (
        <View style={[styles.bannerActions, { flexDirection: rowDir }]}>
          <View style={[styles.clip, styles.bannerActionClip]}>
            <Pressable
              accessibilityRole="button"
              onPress={action.onPress}
              android_ripple={{ color: colors.rippleNeutral }}
              style={styles.bannerAction}
            >
              <Text
                style={[
                  scriptTextStyle('labelLarge', isRTL, loaded, { naturalLine: true }),
                  { color: c.onContainer },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  clip: { overflow: 'hidden' },
  grow: { flexGrow: 1 },
  noPadding: { padding: 0, gap: 0 },
  flipped: { transform: [{ scaleX: -1 }] },
  disabled: { opacity: 0.5 },
  disabledControl: { opacity: 0.38 },
  invisible: { opacity: 0 },
  urduText: { letterSpacing: 0, textTransform: 'none', fontStyle: 'normal' },
  tabularNums: { fontVariant: ['tabular-nums'] },
  proportionalNums: { fontVariant: ['proportional-nums'] },
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  sectionHeader: { marginTop: space.sm },
  sectionTitle: { marginTop: space.sm },
  buttonOuter: { borderRadius: radius.pill, overflow: 'hidden' },
  buttonInner: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
  },
  buttonContent: { alignItems: 'center', justifyContent: 'center', gap: space.sm, flexShrink: 1 },
  buttonText: { textAlign: 'center', flexShrink: 1 },
  buttonSpinner: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: size.touch,
    height: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 6 },
  inputBox: {
    minHeight: size.field,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: space.sm,
  },
  inputBoxMultiline: { alignItems: 'flex-start' },
  inputBoxReadOnly: { backgroundColor: colors.surfaceContainer },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: size.field - 4,
    paddingVertical: space.sm,
    paddingHorizontal: 0,
    color: colors.text,
    textAlignVertical: 'center',
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: space.md },
  prefix: { color: colors.textSecondary },
  errorRow: { alignItems: 'flex-start', gap: space.xs },
  search: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: size.touch,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    paddingVertical: space.sm,
    paddingHorizontal: 0,
  },
  // flexGrow: short rows still start at the reading side (right in Urdu).
  chipRow: { gap: space.sm, paddingVertical: 4, flexGrow: 1 },
  chipRowBleed: { marginHorizontal: -space.lg },
  chipRowBleedContent: { paddingHorizontal: space.lg },
  chipOuter: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
  },
  chipSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primaryContainer },
  chipUnselected: { backgroundColor: colors.card, borderColor: colors.outline },
  chipInner: {
    alignItems: 'center',
    gap: space.xs,
    minHeight: 38,
    paddingHorizontal: space.lg,
  },
  chipIconLtr: { paddingLeft: space.sm },
  chipIconRtl: { paddingRight: space.sm },
  segmented: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: 'hidden',
  },
  segmentWrap: { flex: 1 },
  segmentDivider: { width: 1, backgroundColor: colors.outline },
  segment: {
    flex: 1,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  segmentText: { textAlign: 'center', flexShrink: 1 },
  badge: {
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: 10,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  circle: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  emptyCircle: { width: 72, height: 72, marginBottom: space.xs },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyAction: { alignSelf: 'center', alignItems: 'stretch', width: '100%', maxWidth: 320, marginTop: space.sm },
  listItem: {
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  listIcon: { width: size.avatar, height: size.avatar },
  listText: { flex: 1, gap: 2 },
  listSplit: { alignItems: 'center' },
  listTrailing: { minWidth: size.touch, paddingHorizontal: space.xs, alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineVariant },
  banner: { borderRadius: radius.md, padding: space.md, gap: space.xs, borderWidth: 1 },
  bannerRow: { alignItems: 'flex-start', gap: space.md },
  bannerIcon: { paddingTop: 2 },
  bannerActions: { justifyContent: 'flex-end' },
  bannerActionClip: { borderRadius: radius.pill },
  bannerAction: {
    minHeight: size.touch,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

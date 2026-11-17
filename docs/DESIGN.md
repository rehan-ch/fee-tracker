# Fee Tracker design spec

This spec covers the visual and interaction design for Fee Tracker (Expo SDK 58, React Native
0.88, Android, light theme only). It is the source of truth for the design pass. Every
value in it is concrete: implement what is written. If you need a value that isn't here,
take the closest token and note it in your report.

- Brand: teal `#0F766E`, kept. It is already on the icon, splash, notification colour and
  store graphics, and white text on it measures 5.47:1.
- Platform: Material Design 3 (M3) on Android, adapted for Urdu right-to-left and for
  Expo Go. No native builds, so only modules that ship in Expo Go.
- Data display (Home and Reports) follows the `dataviz` method: choose the form first,
  colour last, validated palettes, thin marks, never colour alone.

---

## 1. Design principles

1. **Money first, status always obvious.** Every screen answers "how much?" and "who?"
   within a second. Show each status three ways: colour, icon and word (for example
   red + `alert-circle` + "Unpaid"). Never use colour alone.
2. **Keep the 3-tap flow exactly as it is.** Home → Open unpaid list → tap customer →
   Save payment. The redesign restyles this flow; it doesn't move or add steps. Khatabook
   saw users leave after a big one-shot UI change, so keep layout positions familiar.
3. **Quiet surfaces, loud data.** White cards on a cool grey page and one teal accent.
   Use status colours only for status, and allow one hero number per screen.
4. **Designed for Urdu, not just translated.** Mirror layouts with the shared components,
   set Urdu in Nastaliq with room to breathe, and keep numbers and phone numbers in
   Latin digits, left-to-right.
5. **Large, forgiving touch targets.** Collectors use the app one-handed, outdoors and
   in sunlight. Touch targets are at least 48dp, the primary action sits low on the
   screen, and text contrast is at least 4.5:1 (we aim for 5:1 or more).
6. **Fast and offline.** No network fonts or images (fonts are bundled from npm
   packages), no animation libraries, and lists use FlatList.
7. **Honest and safe.** Destructive actions always confirm. The premium screen shows
   price, period and terms clearly (Play policy). No ads, no trackers, and no personal
   data in logs.

---

## 2. What the current UI gets wrong (audit, measured)

| Issue | Where | Measurement / fix |
| --- | --- | --- |
| Muted text fails contrast on the page background | `colors.muted #64748B` on `bg #F4F6F8` (section titles, hints) | 4.39:1 (needs 4.5). New `muted #5B6779` gives 5.29:1 on bg and 5.74:1 on white |
| Unpaid text on its soft badge fails | `#DC2626` on `#FEE2E2` | 3.95:1. New `unpaid #B91C1C` gives 5.30:1 on soft and 6.47:1 on white |
| Input borders are invisible | `border #E2E8F0` on white | 1.23:1 (WCAG 1.4.11 needs 3:1 for control boundaries). New `outline #7C8799` gives 3.63:1 |
| Placeholder text too faint | `#94A3B8` on white | 2.56:1. Use `muted #5B6779` |
| Segmented control unselected text fails | `#64748B` on `#E2E8F0` | 3.86:1. Rebuild as M3 segmented buttons on white |
| Uppercase and letter-spaced section titles | `SectionTitle` | `textTransform`/`letterSpacing` do nothing for Urdu, and letter spacing can break cursive joining. Use sentence case and zero letter spacing |
| Hard-coded English accessibility label | `SearchBar` "Clear search" | Must go through `t()` |
| Tab bar doesn't mirror in Urdu | `(tabs)/_layout.tsx` | React Navigation reads the native direction (LTR because `supportsRTL` is off). Needs a custom `tabBar` |
| Progress bar mixes hues | Home meter: green fill on red track | Dataviz meter rule: the track is a lighter step of the same ramp |
| Year chart overlaps two pale bars, no legend or axis | Reports, year view | Replace with the column chart in section 8.4 |
| Customer counts as `✓ · ½ · ✗` glyphs | Reports, month view | Use a status split bar with icon and label legend |
| Premium badge reuses the "partial" amber | Settings | Status colours are reserved. Premium gets its own indigo role |
| PINs typed in clear text on shared phones | `SwitchUserSheet`, `staff/edit` | Add `secure` to the PIN fields (security) |
| `tel:` URL built from raw stored phone | `customer/[id]/index.tsx` | Validate before `Linking.openURL` (security) |

---

## 3. Colour tokens (light theme)

All values live in `src/theme.ts`. **Keep every existing key name** (`primary`,
`primaryDark`, `primarySoft`, `bg`, `card`, `text`, `muted`, `border`, `paid*`, `unpaid*`,
`partial*`, `danger`, `white`, `overlay`) so screens that haven't migrated still compile.
Change values where marked and add the new roles.

### 3.1 Brand and neutrals

| Token (`colors.`) | Hex | M3 role | Use | Contrast (measured) |
| --- | --- | --- | --- | --- |
| `primary` | `#0F766E` | primary | Filled buttons, links, active icons, focus ring, chart accent | white on it 5.47; on bg 5.05 |
| `onPrimary` (new) | `#FFFFFF` | onPrimary | Text and icons on primary | 5.47 |
| `primaryDark` | `#115E59` | – | Pressed primary, hero gradient end | white on it 7.58 |
| `primarySoft` = `primaryContainer` (new alias) | `#CCFBF1` | primaryContainer | Tonal buttons, selected chips/segments, nav indicator, meter track | – |
| `onPrimaryContainer` (new) | `#134E4A` | onPrimaryContainer | Text and icons on primaryContainer | 8.41 |
| `primarySubtle` (new) | `#F0FDFA` | – | Selected list row tint, avatar background | primary on it 5.25 |
| `onPrimaryMuted` (new) | `#CCFBF1` | – | Secondary text on the teal hero | 4.86 on `#0F766E` |
| `tertiary` (new) | `#4338CA` | tertiary | Premium only (badge text, star icon) | 7.90 on white |
| `tertiaryContainer` (new) | `#E0E7FF` | tertiaryContainer | Premium badge and hero background | – |
| `onTertiaryContainer` (new) | `#3730A3` | onTertiaryContainer | Text on tertiaryContainer | 8.06 |
| `bg` | `#F4F6F8` (keep; matches `app.json` and splash) | surface (page) | Screen background | – |
| `card` = `surface` (new alias) | `#FFFFFF` | surfaceContainerLowest | Cards, sheets, app bar, tab bar | – |
| `surfaceContainer` (new) | `#EEF2F6` | surfaceContainer | Search field fill, empty month cells, segmented track | text 15+; textSecondary 6.74 |
| `surfaceContainerHigh` (new) | `#E2E8F0` | surfaceContainerHigh | Inactive badge background | textSecondary 6.15 |
| `text` | `#0F172A` | onSurface | Primary text | 16.48 on bg, 17.85 on white |
| `textSecondary` (new) | `#475569` | onSurfaceVariant | Labels, subtitles, inactive nav icon and label | 6.99 on bg, 7.58 on white |
| `muted` (**change** from `#64748B`) | `#5B6779` | – | Captions, hints, placeholders, axis text | 5.29 on bg, 5.74 on white, 4.65 on `#E2E8F0` |
| `outline` (new) | `#7C8799` | outline | Text-field, outlined-button and chip borders | 3.63 on white, 3.35 on bg |
| `border` = `outlineVariant` (new alias) | `#E2E8F0` | outlineVariant | Dividers and card hairlines (decorative only) | – |
| `overlay` = `scrim` | `rgba(15, 23, 42, 0.45)` | scrim | Sheet and dialog backdrop | – |
| `ripple` (new) | `rgba(15, 118, 110, 0.12)` | pressed state layer | `android_ripple` on light surfaces | – |
| `rippleOnPrimary` (new) | `rgba(255, 255, 255, 0.24)` | – | Ripple on filled primary | – |
| `rippleNeutral` (new) | `rgba(15, 23, 42, 0.08)` | – | Ripple on neutral list rows | – |
| `bubble` (new) | `#DCF8C6` | – | Message preview bubble (reminders, messages) | text 15.54 |

Disabled state: content at opacity 0.5 (no ripple, `accessibilityState.disabled`).

### 3.2 Feedback roles (banners, errors)

| Token | fg (text/icon) | container | onContainer | Icon (Ionicons) |
| --- | --- | --- | --- | --- |
| `danger` / `error` | `#B91C1C` (6.47 on white) | `#FEE2E2` | `#7F1D1D` (8.20) | `close-circle` |
| `warning` (new) | `#B45309` | `#FFFBEB`, border `#FCD34D` | `#92400E` (6.84) | `warning` |
| `info` (new) | `#1D4ED8` | `#EFF6FF` | `#1E40AF` (8.01) | `information-circle` |
| `success` (new) | `#15803D` | `#F0FDF4` | `#166534` (6.81) | `checkmark-circle` |

The feedback roles are for banners and validation only. They are not due statuses.

---

## 4. Status colours (reserved)

Use status colours only when the colour **means** a due status. Each status always ships
with its icon and its word.

| Status | `fg` (marks, icons, text on white) | `soft` (container) | `onSoft` (text on soft) | Icon (Ionicons) | Word key |
| --- | --- | --- | --- | --- | --- |
| paid | `#15803D` (5.02 white, 4.63 bg) | `#DCFCE7` | `#166534` (6.49) | `checkmark-circle` | `paid` |
| partial | `#B45309` (5.02 white, 4.64 bg) | `#FEF3C7` | `#92400E` (6.37) | `contrast` (half circle) | `partial` |
| unpaid | `#B91C1C` (**change** from `#DC2626`; 6.47 white) | `#FEE2E2` | `#B91C1C` (5.30) | `alert-circle` | `unpaid` |
| inactive (customer) | `#475569` | `#E2E8F0` | `#475569` (6.15) | `pause-circle` | `inactive` |
| advance / credit | uses **paid** colours | | | `add-circle` | `advance` |

In `src/theme.ts`:
`statusColors = { paid: { fg, bg, onSoft, icon }, partial: {…}, unpaid: {…} }`. Keep the
`fg` and `bg` keys; `bg` is the soft colour. Also add `inactiveColors` with the same shape.

---

## 5. Typography

### 5.1 Fonts (exact packages and weights)

| Script | Package | Faces to load | Family name to register |
| --- | --- | --- | --- |
| Latin and **all numbers** | `@expo-google-fonts/inter` (0.4.x, OFL) | `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` | `Inter` (weights 400/500/600/700) |
| Urdu | `@expo-google-fonts/noto-nastaliq-urdu` (0.4.x, OFL) | `NotoNastaliqUrdu_400Regular`, `NotoNastaliqUrdu_700Bold` | `UrduNastaliq` (weights 400/700) |

Why these fonts:

- **Inter.** Very legible at small UI sizes, has true tabular figures for amount
  columns, and ships 4 weights at about 340 KB each.
- **Noto Nastaliq Urdu.** Pakistani readers expect Nastaliq for Urdu; Naskh reads as
  Arabic. The font also contains Latin letters and digits, so mixed names render.
- **Measured metrics.** From the TTFs: Nastaliq ascent 1.904em and descent 0.596em, so
  its natural line is **2.5x the font size** (Inter: 1.21x). That number drives the Urdu
  line heights below.
- **Poppins rejected.** Too wide for money columns on 360dp phones.
- **Noto Naskh Arabic rejected.** More compact, but it reads as Arabic to Pakistani users.

Loading (works in Expo Go, per the v58 fonts guide and the `expo-font` page, which is
"Included in Expo Go"):

- Install with
  `export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH && npx expo install @expo-google-fonts/inter @expo-google-fonts/noto-nastaliq-urdu`.
  Don't add them to the `expo-font` config plugin: embedding needs a native build.
- Load at runtime with `useFonts` from `expo-font`, passing a `FontFamilyDefinition[]` so
  `fontWeight` picks the face:
  ```ts
  useFonts([
    { fontFamily: 'Inter', fontDefinitions: [
      { path: Inter_400Regular, weight: 400 }, { path: Inter_500Medium, weight: 500 },
      { path: Inter_600SemiBold, weight: 600 }, { path: Inter_700Bold, weight: 700 } ] },
    { fontFamily: 'UrduNastaliq', fontDefinitions: [
      { path: NotoNastaliqUrdu_400Regular, weight: 400 }, { path: NotoNastaliqUrdu_700Bold, weight: 700 } ] },
  ]);
  ```
- **Check on the device in Expo Go** that `fontWeight: '700'` renders the bold face.
  **Fallback** if it doesn't: register each face under its own name (for example
  `Inter_700Bold`) and map weight to family in `fontFamilyFor(weight, isRTL)`. In that
  case set `fontWeight: 'normal'` to avoid faux bold.
- Gate rendering in `src/app/_layout.tsx`: keep the splash screen until
  `ready && (fontsLoaded || fontError)`. **Never block on a font error**: fall back to the
  system font.
- Never load fonts from a URL. They ship as package assets, so no network request and no
  data leaves the phone.

### 5.2 Latin type scale (Inter)

Sizes are in sp. Line height is fixed so text never clips. `Txt` variant names in brackets
are the API.

| Role (`Txt variant`) | Size / line | Weight | Colour | Use |
| --- | --- | --- | --- | --- |
| Hero figure (`hero`) | 40 / 48 | 700 | text or onPrimary | **One per screen**: Home "collected", customer balance, receipt amount. `fontVariant: ['proportional-nums']`, `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.6}` |
| Headline (`headline`) | 28 / 36 | 700 | text | Big secondary amounts, sheet amount input |
| Title (`title`) (existing) | 22 / 28 | 700 | text | Screen titles in content, business name |
| Title medium (`h2`) (existing) | 17 / 24 | 600 | text | Card titles, list primary line |
| Body large (`bodyLarge`) | 16 / 24 | 400 | text | Inputs, long text |
| Body (`body`) (existing) | 15 / 22 | 400 | text | Default |
| Body muted (`muted`) (existing) | 14 / 20 | 400 | textSecondary | Supporting text |
| Small (`small`) (existing, **12 → 13**) | 13 / 18 | 400 | muted | Captions, list second line, hints |
| Label (`label`) (existing) | 13 / 18 | 600 | textSecondary | Field labels, stat-tile labels, section headers |
| Button (internal) | 16 / 22 | 600 | per variant | Buttons |
| Label small (internal) | 12 / 16 | 600 | per use | Tab labels, badges, chart axis |

Numbers:

- Every amount uses the **Amount** component (Inter, LTR, Latin digits).
- Columns of amounts (list rows, tables, axis ticks) use `fontVariant: ['tabular-nums']`.
- Big standalone numbers (hero, stat tiles) use `['proportional-nums']`.

### 5.3 Urdu type scale (Noto Nastaliq Urdu)

The same `Txt` variants. When `isRTL` is true, `Txt` swaps to the Urdu family, bumps the
size and sets these line heights:

| Variant | Urdu size / line | Weight |
| --- | --- | --- |
| `title` | 22 / 44 | 700 |
| `h2` | 18 / 36 | 700 |
| `bodyLarge` | 17 / 34 | 400 |
| `body` | 16 / 32 | 400 |
| `muted` | 15 / 30 | 400 |
| `small` | 14 / 28 | 400 |
| `label` | 14 / 28 | 700 |
| Button | 16 / 32 | 700 |
| Label small (tabs, badges) | 13 / 26 | 700 |
| `hero`, `headline` | **stay Inter** (they are numbers) | |

Urdu rules:

- Line height is **at least 2.0x the font size** for Nastaliq. Never give a container that
  holds Urdu text a fixed `height` or `maxHeight`; use `minHeight` and padding.
- `letterSpacing: 0`, no `textTransform`, no italics in Urdu.
- Single-line Urdu labels (buttons, chips, tabs) may omit `lineHeight` so the natural 2.5x
  line applies. Their containers must grow (`minHeight`, no `height`).
- `TextInput` in Urdu: Nastaliq family, no `lineHeight`, `minHeight: 56`,
  `paddingVertical: 8`, `textAlignVertical: 'center'` (multiline: `'top'`).
- Latin digits stay Latin in Urdu: amounts, phones, dates, receipt numbers.
- Header titles (native stack) use `headerTitleStyle: { fontFamily: isRTL ? 'UrduNastaliq' : 'Inter', fontSize: 18, fontWeight: '700' }`.

### 5.4 Font scaling

- Never disable font scaling globally.
- `maxFontSizeMultiplier={1.3}` only on tab labels, badges and the hero figure, which also
  shrinks to fit.
- At `useWindowDimensions().fontScale > 1.3`, KPI rows and two-button rows switch from 2
  columns to 1.
- Test at system font sizes 1.0, 1.3 and 2.0 in both languages.

---

## 6. Layout: spacing, shape, elevation, sizes

### 6.1 Spacing (4dp grid), `space`

| Token | dp | Use |
| --- | --- | --- |
| `xxs` (new) | 2 | Chart gaps, hairline spacers |
| `xs` | 4 | Icon to label inside chips |
| `sm` | 8 | Gap between rows and list cards, inside small groups |
| `md` | 12 | Gap between cards, inside cards |
| `lg` | 16 | Screen padding, card padding |
| `xl` | 24 | Section spacing |
| `xxl` (new) | 32 | Above large section breaks, empty-state padding |
| `xxxl` (new) | 48 | Bottom padding for screens with a FAB or bottom bar (plus FAB height) |

Screen padding is 16. Cards get 16 padding and 12 between cards; a new section starts 24
below the previous card. Content keeps 16 clear of the bottom of the screen plus the safe
area.

### 6.2 Shape (M3 corner scale), `radius`

| Token | dp | Use |
| --- | --- | --- |
| `xs` (new) | 4 | Chart bar data-ends, small swatches |
| `sm` | 8 | Chips, badges with text, month cells |
| `md` | 12 | Text fields, list-row cards, plan cards |
| `lg` | 16 | Cards, FAB |
| `xl` (new) | 28 | Bottom-sheet top corners, hero card (M3 extra-large) |
| `pill` | 999 | Buttons, segmented control, search bar, nav indicator, avatars, meters |

### 6.3 Elevation (RN 0.88 `boxShadow`; New Architecture, Android 9+)

| Token (`elevation.`) | `boxShadow` string | Use |
| --- | --- | --- |
| `level0` | `none` | Flat surfaces, outlined cards |
| `level1` | `0px 1px 2px rgba(15, 23, 42, 0.06), 0px 1px 3px 1px rgba(15, 23, 42, 0.06)` | Cards, list-row cards |
| `level2` | `0px 1px 2px rgba(15, 23, 42, 0.08), 0px 2px 6px 2px rgba(15, 23, 42, 0.08)` | Hero card, selected plan card |
| `level3` | `0px 4px 8px 3px rgba(15, 23, 42, 0.10), 0px 1px 3px rgba(15, 23, 42, 0.12)` | FAB, bottom sheet, bottom action bar |

Cards drop their hairline border when they use `level1`. Outlined cards keep a 1dp
`outlineVariant` border and no shadow. Don't use `elevation:` on Android any more; it
renders a harsh grey shadow.

### 6.4 Sizes, `size`

`touch: 48`, `icon: 24`, `iconSm: 18`, `iconLg: 28`, `avatar: 40`, `avatarLg: 56`,
`statusIcon: 40`, `button: 48` (lg `56`), `field: 56`, `fab: 56`, `navMin: 64`,
`appBar: 56`, `meter: 8`, `segBarThin: 8`, `segBarTall: 28`.

### 6.5 Gradients

Use RN 0.88 core `backgroundImage` (documented on the 0.88 View style page). No
dependency needed.

- Hero: `backgroundImage: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)'`. In Urdu
  use `225deg`, so the light corner sits on the reading-start side.
- If it doesn't render on the owner's device in Expo Go, fall back to a solid `#0F766E`.
  Don't add a gradient library unless that fails.

---

## 7. Components (foundation; `src/components/ui.tsx` and new `src/components/ds/*`)

Every component reads `useApp().isRTL / rowDir`, uses tokens only (no hex in screens),
uses `android_ripple` for press feedback and has a touch target of at least 48dp. Keep all
existing exports and props working. New props are additive.

### 7.1 Text and numbers

- **`Txt`**
  - Keeps its existing props.
  - Adds variants `hero | headline | bodyLarge`, plus
    `tone?: 'text' | 'secondary' | 'muted' | 'primary' | 'onPrimary' | 'paid' | 'partial' | 'unpaid' | 'danger'`,
    `weight?: 400 | 500 | 600 | 700` and `header?: boolean` (sets
    `accessibilityRole="header"`).
  - Picks the font family by `isRTL` and applies the Latin or Urdu scale (section 5).
  - `bold` maps to weight 700.
- **`Amount`** (new): `{ value: number; variant?: 'hero' | 'headline' | 'title' | 'h2' | 'body' | 'small'; tone?; tabular?: boolean; align?: 'start' | 'end' | 'center' }`.
  - Renders `useApp().money(value)` in Inter with `writingDirection: 'ltr'`.
  - In Urdu, the default alignment follows the reading side.
  - `accessibilityLabel` is the same text.
- **`bidiIsolate(s)`** (new helper): returns `'⁦' + s + '⁩'` (left-to-right
  isolate). Use it when a number or phone number sits inside an Urdu sentence that you
  build in code, so "Rs 2,000" doesn't get reordered.

### 7.2 Buttons

- **`Button`**: `variant: 'primary' | 'secondary' | 'danger' | 'ghost'` (existing) plus the
  aliases `'filled' | 'tonal' | 'outlined' | 'text'`, `size?: 'md' | 'lg'`,
  `iconFlipForRTL?: boolean`.

  | Variant | Container | Content | Border |
  | --- | --- | --- | --- |
  | filled / primary | primary | onPrimary | – |
  | tonal / secondary | primaryContainer | onPrimaryContainer | – |
  | outlined | transparent | primary | 1dp outline |
  | text / ghost | transparent | primary | – |
  | danger | error container `#FEE2E2` | `#B91C1C` | – |

  - Shape `pill`, `minHeight` 48 (lg: 56) and horizontal padding 24 (`md`: 20).
  - 20dp icon, 8dp gap. The label is one line in Latin; it may wrap in Urdu (no fixed
    height).
  - The loading spinner keeps the button's width (render it in place of the content).
  - Ripple is `rippleOnPrimary` on filled and `ripple` on the others.
  - The pressed state uses the ripple only; drop the opacity change.
- **`IconButton`**: `{ name, label, onPress, color?, flipForRTL?, variant?: 'standard' | 'tonal' | 'filled' | 'outlined' }`.
  48x48 target, 40dp visual circle on tonal and filled, borderless ripple on standard. The
  `label` prop is required (it's the accessibilityLabel).
- **`Fab`** (new, `ds/Fab.tsx`): extended FAB `{ icon, label, onPress }`.
  - 56dp high, radius 16, primaryContainer container with onPrimaryContainer content,
    level3 shadow.
  - Positioned at the bottom end: `right: 16` in English, `left: 16` in Urdu (absolute
    positioning doesn't mirror because `supportsRTL` is off).
  - `bottom: 16`; screens add `paddingBottom: 56 + 32` to their list.

### 7.3 Inputs

- **`Field`**: M3 outlined text field, label above (not floating, which is safer for Urdu).
  - Input `minHeight` 56, radius 12, 1dp `outline` border.
  - Focused: 2dp `primary` border (track `onFocus`/`onBlur`).
  - Error: 2dp `danger` border, plus an error row with the `alert-circle` icon and
    `accessibilityLiveRegion="polite"`.
  - New props: `prefix?: string` (for example "Rs", always Latin, on the reading-start
    side), `size?: 'default' | 'amount'`, `onSubmitEditing?`, `returnKeyType?`.
  - `size="amount"`: Inter 28/36 bold, centred, `keyboardType="number-pad"`, LTR.
  - Placeholder colour is `muted`.
- **`SearchBar`**: pill, `surfaceContainer` fill, no border, `minHeight` 48, search icon at
  the start, clear `IconButton` (label via `t('designClearSearch')`).
- **`Chip`** (filter chip, M3):
  - 8dp radius, `minHeight` 40 visual with `hitSlop` 4 (48dp touch), 1dp `outline`
    border, Label Large 14/600 text.
  - Selected: `primaryContainer` fill, no border, a leading `checkmark` icon (18) and
    `accessibilityState.selected`.
  - Optional `icon`.
  - `variant: 'assist'` has no check and keeps its leading icon (used for "Edit message",
    "Manage areas").
- **`ChipRow`**: horizontal scroll with 8dp gap, 16dp padding inside the scroll. Its order
  follows `rowDir`.
- **`Segmented`** (M3 segmented buttons):
  - Pill outline container, 1dp `outline`, segments separated by 1dp `outline`, each
    segment `minHeight` 48.
  - Selected segment: `primaryContainer` fill, `onPrimaryContainer` text and a check icon.
  - With `tone` (status tabs): selected fill is the status `soft` colour, text is
    `onSoft`, and the status icon replaces the check.
  - Counts appear as `· 12` in tabular Inter, not in brackets.
  - Options gain `icon?` and `tone?: DueStatus`.
- **`Switch`** (RN core): `trackColor={{ false: '#CBD5E1', true: primary }}`,
  `thumbColor="#FFFFFF"`, always with an `accessibilityLabel`.

### 7.4 Containers

- **`Card`**: `variant?: 'elevated' (default) | 'outlined' | 'filled' | 'tonal' | 'hero'`,
  `onPress?`.
  - Radius 16, padding 16, gap 8.
  - elevated: white with level1. outlined: white with a 1dp outlineVariant border.
    filled: `surfaceContainer`. tonal: `primarySubtle`. hero: gradient with radius 28,
    padding 20, level2, white content.
  - With `onPress`, render a Pressable with ripple and `accessibilityRole="button"`.
- **`BottomSheet`** (new, `ds/Sheet.tsx`): `{ visible, onClose, title?, children, footer? }`.
  - RN `Modal` (`transparent`, `animationType="slide"`, `statusBarTranslucent`,
    `navigationBarTranslucent`) over a scrim backdrop that is pressable and labelled
    `t('close')`.
  - Sheet: white, top corners 28, level3, `maxHeight: '90%'`, max width 640 centred.
  - Drag-handle visual 32x4 (`#CBD5E1`, pill), centred inside a 48dp header zone. It's
    decorative, not a gesture (no gesture library).
  - Content in a ScrollView (`keyboardShouldPersistTaps="handled"`) inside a
    KeyboardAvoidingView.
  - `footer` is sticky below the scroll with a top hairline and
    `paddingBottom = 16 + insets.bottom`.
  - `accessibilityViewIsModal`. The close IconButton sits at the top end.
- **`BottomActionBar`** (new, `ds/BottomActionBar.tsx`): sticky footer for screen-level
  primary actions (form Save, Start sending).
  - White, top hairline, level3, padding 16, `paddingBottom = 16 + insets.bottom`.
  - Children stack vertically, 8dp gap.
- **`Banner`** (new): `{ tone: 'info' | 'warning' | 'error' | 'success'; title?; body; action?: { label; onPress } }`.
  - Container colour from section 3.2, radius 12, padding 12.
  - Leading 20dp icon, text in the onContainer colour, action as a `text` button
    aligned to the end.
- **`EmptyState`**: 72dp `primarySubtle` circle with a 36dp `primary` icon, `h2` title
  (centred), muted body, action below (full width, max 320). Vertical padding 32.

### 7.5 Lists and identity

- **`ListItem`**:
  - Leading icon inside a 40dp tonal circle (`iconTone?: 'primary' | 'danger' | 'neutral' | 'premium'`).
  - Title `body` 15 in Inter or 16 in Urdu, optional subtitle `small`, trailing `right`
    or a chevron (flipped in Urdu).
  - `minHeight` 56 with one line, 72 with a subtitle. Padding 16 horizontal and 12
    vertical. Ripple. `accessibilityRole="button"` when pressable.
  - New: `leading?: ReactNode` (for example an Avatar).
- **`Avatar`** (new): `{ name: string; size?: 40 | 56 }`.
  - Circle in `primarySubtle` with `onPrimaryContainer` text, 600 weight, 16 (or 22 at 56).
  - Initial: `Array.from(name.trim())[0]?.toUpperCase()`, which handles Urdu names.
  - Decorative: `accessibilityElementsHidden` / `importantForAccessibility="no"`.
- **`StatusBadge`**: pill with `soft` background, a 14dp status icon, the word in Label
  Small (Inter 12/600, Urdu 13/700) in `onSoft`, padding 4x10.
- **`Badge`** (new): `{ label; tone: 'neutral' | 'premium' | 'info' | DueStatus; icon? }`.
  The premium tone uses tertiaryContainer, onTertiaryContainer and a `star` icon.
- **`StatusIcon`** (new): 40dp circle in the status `soft` colour with a 22dp status icon
  in `fg`. Used as the leading element of due rows.
- **`SectionHeader`** (new; `SectionTitle` becomes an alias):
  - `{ title; action?: { label; onPress; icon? } }`.
  - `label` variant, sentence case, no letter spacing, `accessibilityRole="header"`,
    margin top 8. The action is a `text` button at the end.
- **`Divider`**: `inset?: number`. Default inset 72 inside lists with leading icons, 0
  otherwise.

### 7.6 Navigation chrome

- **`AppTabBar`** (new, `ds/AppTabBar.tsx`), passed as `tabBar={(p) => <AppTabBar {...p} />}`
  in `src/app/(tabs)/_layout.tsx`. Read the `BottomTabBarProps` type from `expo-router/tabs`;
  this fork exposes `state`, `descriptors`, `navigateToTab`, `emitter` and `insets`.
  - Layout: white container, 1dp outlineVariant top border, `minHeight` 64 +
    `insets.bottom`. Items in a `Row` (`rowDir`), so Urdu mirrors with Home on the right.
  - Item: `flex: 1`, `minHeight` 64, padding 6 top and 8 bottom. The indicator is a pill
    56x32. It's `primaryContainer` when focused and holds a 24dp icon (filled when
    focused, outline otherwise). Below it, 4dp gap, then the label (Label Small; Urdu
    13/700 Nastaliq; `numberOfLines={1}`, `maxFontSizeMultiplier={1.3}`).
  - Colours: active icon `onPrimaryContainer`, active label `primary`, inactive icon and
    label `textSecondary`.
  - Behaviour: `accessibilityRole="tab"` and `accessibilityState.selected`. Emit the
    `tabPress` event through `emitter` before navigating (keeps the default re-tap
    behaviour). Ripple is borderless on the indicator. Hide while the keyboard is open
    (`Keyboard` listeners) to mirror `tabBarHideOnKeyboard`.
  - Keep the `title` and `tabBarIcon` options per screen so a single source of
    icon names stays in `_layout`.
- **Top app bar** (native stack and tab headers):
  - White (`surface`), no shadow, `headerTitleAlign: 'center'`, title 18/700 in the
    script font, `headerTintColor: text`.
  - The system back arrow stays where Android puts it. The title is centred, so this
    reads correctly in both directions. Header actions (`headerRight`) are IconButtons
    with labels.
- **Home** hides its tab header (`options={{ headerShown: false }}` for `index` in
  `(tabs)/_layout.tsx`) and draws an in-content top bar (section 13.1).

### 7.7 Pickers (`src/components/pickers.tsx`)

- **`MonthPicker`**:
  - White pill (radius pill, level1, `minHeight` 52) with 48dp chevron IconButtons
    (flipped in Urdu).
  - The month label in the middle is `h2`, centred, with `accessibilityRole="button"`
    and `accessibilityHint={t('thisMonth')}`.
  - When the shown month isn't the current one, a small tonal "This month" text button
    appears under the label.
  - Disabled chevrons: opacity 0.38 and `accessibilityState.disabled`.
- **`DateField`**: looks like `Field` (56dp, outline, radius 12) with a trailing
  `calendar-outline` icon in primary.
- **`AreaFilter`**: uses the new `Chip`. "All areas" first, "No area" last.

---

## 8. Data display and charts (dataviz method)

Charts are **plain Views**, not SVG. Bars, meters and segments are rounded Views, which
mirror with `rowDir`, take ripple and accessibility props, and need no dependency. Run the
palette validator (`dataviz/scripts/validate_palette.js`) again if any chart colour changes.

### 8.1 Form choices

| Data | Form | Why |
| --- | --- | --- |
| Collected this month (Home) | **Hero figure** plus a **meter** against expected | One number leads, and it's a single ratio against a limit |
| Expected / Collected / Pending | **KPI row** of stat tiles | A handful of headline numbers |
| Paid / Partial / Unpaid customers | **Thin segmented bar** (8dp) above a 3-row legend (icon, word, count) | Part-to-whole in at most 6 parts, read beside its figures |
| By payment method | **Thin segmented bar** plus a list row per method (swatch, name, count, amount, %) | Part-to-whole beside figures; each row's swatch replaces the legend |
| By area | **Meter list** (name, bar and figure per row, bars aligned) | Several ratios (collected / billed), one per named row |
| By collector | **Ranked horizontal bars**, one hue, largest first | Compare magnitudes |
| Year: per month | **Column chart** (collected) over a grey **context column** (billed), plus a month-by-month list as the table view | Change over time, with the target as context |

### 8.2 Chart colour tokens (`theme.chart`)

| Token | Hex | Role |
| --- | --- | --- |
| `accent` | `#0F766E` | Single-series and emphasis marks (collected, collectors, area meters). 5.47:1 on white |
| `accentTrack` | `#CCFBF1` | Meter track (a lighter step of the same teal ramp) |
| `context` | `#CBD5E1` | Billed / target column (de-emphasis grey). 1.48:1, so relief is needed: the month list is the table view |
| `grid` | `#E2E8F0` | Hairline gridlines, solid, 1dp (never dashed) |
| `axisText` | `#5B6779` (muted) | Tick and axis labels |
| `method.cash` | `#2a78d6` | Categorical slot 1 |
| `method.jazzcash` | `#eb6834` | Slot 2 |
| `method.easypaisa` | `#1baf7a` | Slot 3 |
| `method.bank` | `#eda100` | Slot 4 |

The method colours follow the entity, in `PAYMENT_METHODS` order. They never get
reassigned by rank or filter. Validator result (light mode, surface `#FFFFFF`, adjacent
pairs):

- Lightness band PASS and chroma PASS.
- CVD worst adjacent ΔE 9.1, PASS (target 8 or more).
- Normal vision worst ΔE 22.9, PASS.
- Contrast WARN for aqua 2.82 and yellow 2.17. That obliges labels, which the per-method
  list rows provide (name and figures beside every swatch).
- The brand teal fails the categorical chroma floor (0.086), so it is **not** used as a
  categorical slot. It's the single-series accent only.

Status splits (paid / partial / unpaid) use the **status** colours from section 4. Those
colours mean good or bad, so each part ships with its icon and word in the legend.

### 8.3 Mark specs

- Bars are at most 24dp thick (ranked bars 12dp, columns 20dp max). The data end has a
  4dp radius; the baseline end is square. Bars grow from the reading-start side (the right
  in Urdu).
- Separate touching segments with a **2dp surface gap**. No strokes around marks.
- Meters are 8dp high, pill ends, track = `accentTrack` (or `rgba(255,255,255,0.24)` on
  the hero, where the white fill measures 3.47:1 against it). The fill runs from the
  reading start. Pass `accessibilityRole="progressbar"`,
  `accessibilityValue={{ min: 0, max: 100, now }}` and a text percent beside the meter.
- Text never wears the series colour. Values and labels use the text tokens; identity
  comes from the swatch (a 10dp rounded square) beside the text.
- Label selectively. Columns: label only the highest month and the selected month, in a
  readout. Ranked bars: the value at the tip (outside the bar, `small`, tabular).
- Gridlines: 3 horizontal hairlines (0, mid, max), solid `grid`. Tick labels round to
  clean numbers: in full under 10,000 (`0 · 5,000 · 10,000`), compact above
  (`0 · 50K · 100K`, Latin). Ticks sit on the reading-start side.
- **Container height includes the axis band**: plot 160dp + x-axis labels 24dp. No fixed
  height that cuts the labels, and no nested scroll.

### 8.4 Year column chart (`src/components/money/YearColumns.tsx`)

- Twelve slots (Jan to Dec) in a `Row` (`rowDir`), so Urdu runs from right to left.
- Each slot is a Pressable at least 24dp wide (the hit target is the full slot height).
  Inside it, a 20dp-max `context` column (billed) with an `accent` column (collected)
  overlaid from the same baseline.
- Months without data draw nothing; the axis label stays.
- Tapping a column selects it: other columns drop to 0.5 opacity, and a readout row
  above the plot shows "March 2026 · Collected Rs 84,000 of Rs 120,000 · Pending
  Rs 36,000". This replaces a tooltip; on mobile, tap is the hover. Tapping again clears
  the selection. The current or last month is selected by default.
- Legend above the plot: two items (teal rect "Collected", grey rect "Billed").
- Accessibility: each slot has
  `accessibilityLabel="{month}: collected {x} of {y}"` and `accessibilityRole="button"`.
- Table view: the existing month list stays under the chart, titled "Month by month".
  Each row shows the month, collected / billed (tabular) and a small meter.

### 8.5 Stat tile (`ds/StatTile.tsx`) and KPI row

- **Stat tile** contract: `label` (sentence case, no colon) · `value` (Amount, variant
  `title` 22/700, proportional) · optional `sub` (small) · optional status `icon` for
  pending. Card `elevated`, padding 16, `minHeight` 88, `onPress?`.
- **`KpiRow`**: 2 columns with a 12dp gap; 1 column when `fontScale > 1.3`. With an odd
  count, the last tile spans both columns.

---

## 9. Iconography

- Keep **Ionicons** via `@expo/vector-icons` (already installed and in Expo Go). Use
  outline icons by default and filled icons for active or selected state.
- Sizes: 24 standard, 20 in buttons, 18 inline with text and in chips, 22 inside a status
  circle, 36 in empty states.
- `flipForRTL` on direction-bearing icons only: `chevron-*`, `arrow-*`, `send`,
  `trending-up`, `return-*`, `open-outline`. Never flip logos, `call`, checkmarks,
  `time`, `calendar` or the WhatsApp logo.
- Fixed meanings:

  | Meaning | Icon |
  | --- | --- |
  | Record payment | `cash-outline` |
  | Receipt | `receipt-outline` |
  | WhatsApp reminder | `logo-whatsapp` (in our own colours, never WhatsApp green as a button fill) |
  | SMS | `chatbubble-outline` |
  | Call | `call-outline` |
  | Edit | `create-outline` |
  | Delete | `trash-outline` |
  | Area | `location-outline` |
  | Notes | `document-text-outline` |
  | Premium | `star` |
  | Backup | `cloud-upload-outline` |
  | Sync | `sync` |
  | Staff | `people-outline` |
  | Owner | `key-outline` |
  | Methods | cash `cash-outline`, JazzCash `phone-portrait-outline`, Easypaisa `wallet-outline`, Bank `business-outline` |

- No third-party brand logos except the WhatsApp glyph on WhatsApp actions. Never use
  JazzCash or Easypaisa brand colours.

---

## 10. Motion and feedback

- **Press feedback:** `android_ripple` everywhere (`colors.ripple`, 12%). This is the M3
  pressed state.
- **Durations:** `motion.fast 150ms` (state changes), `motion.base 250ms` (sheet, meter
  fill), `motion.slow 350ms` (first reveal of the hero meter).
- **Easing:** standard `Easing.bezier(0.2, 0, 0, 1)`, decelerate `Easing.bezier(0.05, 0.7, 0.1, 1)`.
- **Library:** use RN core `Animated` with `useNativeDriver: true` (transform and
  opacity only). Animate meters with `transform: [{ scaleX }]` and `transformOrigin` set to
  the reading start, not width. Don't add an animation library. Reanimated is present only
  as an expo-router dependency; don't import it.
- **Reduce motion:** read `AccessibilityInfo.isReduceMotionEnabled()` once and skip
  non-essential animation.
- **Haptics are not added in this pass.** The v58 `expo-haptics` page doesn't carry the
  "Included in Expo Go" badge (other module pages do), so it fails the Expo Go rule. If it's
  confirmed later, use only `Haptics.performAndroidHapticsAsync(AndroidHaptics.Confirm)`
  after a saved payment. Per the docs that call needs no VIBRATE permission.
- **Confirmation:** keep `ToastAndroid` for "Payment saved". In-place state changes
  (the row moves to Paid) are the main feedback.

---

## 11. Right-to-left rules (Urdu)

The app mirrors itself (`supportsRTL: false`, `I18nManager` stays LTR). So:

1. Lay out horizontally only with `Row` / `rowDir`. Never use raw `flexDirection: 'row'`
   for content.
2. Don't rely on `start` / `end` / `marginStart` / `paddingStart`: with the native
   direction LTR they mean left. Use explicit `isRTL ? { left } : { right }` (FAB, badges,
   absolute elements).
3. Text alignment comes from `Txt`. Don't set `textAlign: 'left'` in screens.
4. Mirror directional icons with `flipForRTL` (section 9).
5. Numbers, amounts, phones, receipt numbers, dates, invite codes and PINs stay LTR
   (`Amount`, `Field ltr`, `bidiIsolate`). Their alignment follows the reading side.
6. Progress, meters and bars grow from the reading start. Time axes run right to left in
   Urdu.
7. Tab order mirrors through `AppTabBar`. Stack headers stay native (centred titles).
8. Typography follows section 5.3: Nastaliq with line height at least 2.0x, no letter
   spacing, no uppercase, no fixed heights.
9. Never reorder data for RTL with `.reverse()`. Use `rowDir`, so the accessibility order
   stays logical (TalkBack reads the reading-start element first).

---

## 12. Accessibility checklist (every screen, every PR)

- [ ] Every touch target is at least 48x48dp (`minHeight`/`minWidth` 48 or `hitSlop`).
- [ ] Every icon-only button has an `accessibilityLabel` from `t()`. No hard-coded English.
- [ ] Roles and states are set: `button`, `tab` + `selected`, `checkbox` + `checked`,
  `radio` + `checked`, `progressbar` + `accessibilityValue`, `header` on section headers,
  `disabled` where it applies.
- [ ] Text contrast is at least 4.5:1 (tokens in sections 3 and 4 are pre-checked), and
  control boundaries and meaningful icons are at least 3:1.
- [ ] Colour is never the only signal: status = colour + icon + word, charts = swatch +
  label, errors = icon + text.
- [ ] Font scaling works at 1.3 and 2.0: no `height` on text containers, rows wrap, and
  no clipped Urdu.
- [ ] Each due or customer row has a single combined `accessibilityLabel` (for example
  "Ali Khan, unpaid, Rs 2,000 due").
- [ ] Charts: an accessible summary on the container, an accessible label per bar or slot,
  and a table view (list) on the same screen.
- [ ] Sheets set `accessibilityViewIsModal`. Errors use `accessibilityLiveRegion="polite"`.
- [ ] Decorative avatars and illustrations are hidden from TalkBack.
- [ ] Reduce-motion is respected.

---

## 13. Screen-by-screen improvements

The owning team is in brackets. Routes, params, role checks (`can(...)`) and data logic
stay exactly as they are.

### 13.1 Home, `src/app/(tabs)/index.tsx` [core]

1. **Top bar in content.** The tab header is hidden by foundation. Show Avatar(business
   name) + business name (`title`, one line) + the "Using as …" line + the
   switch-business IconButton (existing condition). Pad by the safe-area top inset.
2. **MonthPicker** (restyled pill).
3. **Collection hero card** (`components/core/CollectionHero.tsx`, Card `hero`):
   - Label "Collected · {month}" (`onPrimaryMuted`) and hero Amount (white, 40/48).
   - "of {expected} expected" (`onPrimaryMuted`).
   - Meter on the hero track with "{pct}%" at the end.
   - The carried-forward note as a small line.
4. **KPI row**: "Pending" stat tile (unpaid tone, `alert-circle`) and a "Left to pay" tile
   with the count (unpaid + partial). Under the count, a thin status split bar with a
   legend (icon, word, count). Tapping a tile opens Collection on the matching tab.
5. **Action card** (who hasn't paid):
   - `StatusIcon` + `h2` sentence (existing strings) + a muted count line.
   - Filled lg "Open unpaid list" (same params) and tonal "Send reminders" (WhatsApp icon,
     `can('reminders.send')`).
   - When everyone has paid: success StatusIcon and the text "All paid".
6. **Backup nudge** becomes a warning `Banner` with the action "Back up now" (same
   conditions).
7. **No customers**: `EmptyState` with a 3-step mini guide (add customers → record
   payments → send reminders) and the "Add first customer" button (`can` unchanged).

### 13.2 Collection, `src/app/(tabs)/collection.tsx` [core]

1. The fixed header is compact: MonthPicker, then status `Segmented` with tone, icon and
   count, then SearchBar, then a single ChipRow with the area chips followed by the
   "Paid on" date chip (non-unpaid tabs) and its clear chip.
2. "Send reminders" moves from a chip into a `Fab` (WhatsApp icon, label) on the Unpaid
   and Partial tabs (same conditions). The list gets bottom padding for it.
3. **`DueRow`** (`components/core/DueRow.tsx`, `React.memo`):
   - `StatusIcon`, name (`h2`, one line), subtitle (area · phone · reminded on), and a
     notes line with an icon in warning `onContainer`.
   - End column: Amount (tabular, status `fg`) plus its word ("Due" / "Paid Rs x" / date),
     then a chevron.
   - White card with level1, radius 12, `minHeight` 72, ripple, combined accessibility
     label.
4. Empty states per tab. Unpaid: success icon and "Everyone has paid for {month}". With
   filters: a "Clear filters" text button.
5. Keep FlatList with a stable `renderItem` (`useCallback`) and `keyExtractor`.

### 13.3 Record payment sheet, `src/components/RecordPaymentSheet.tsx` [core]

1. Uses `BottomSheet`. Header: Avatar, customer name (`title`), "Record payment · {month}",
   close IconButton.
2. Summary as a 3-row mini table (Total due, Already paid in paid colour, Remaining in
   unpaid colour and bold, all tabular). The carried / credit note sits beside an
   info icon.
3. Amount `Field size="amount" prefix="Rs"` (pre-filled with what is still due, same as
   today). An assist chip "Full amount {remaining}" resets the value. The overpay note
   becomes an info `Banner`.
4. Method chips with icons (section 9). DateField. Optional note field.
5. Sticky `footer`: filled lg "Save payment" and tonal "Save and share receipt". Same
   save, toast, navigation and disabled logic. The error is announced.

### 13.4 Welcome / setup, `src/app/setup.tsx` [core]

1. A language Segmented (English | اردو) at the top end.
2. Hero: 80dp gradient tile with a white `wallet` icon, the app name `title` and the
   subtitle.
3. Three benefit rows (icon in a tonal circle, then text): add customers once, record a
   payment in 3 taps, remind on WhatsApp. New `core*` strings.
4. Form card (business name, phone with `ltr`), filled lg "Get started", text button
   "Join with invite code" (same condition), and the privacy link as a 48dp text button.

### 13.5 Customers, `src/app/(tabs)/customers.tsx` [customers]

1. Header: SearchBar, then a ChipRow with the area chips and the "Inactive (n)" filter
   chip.
2. The "Add customer" header button becomes a `Fab` (`person-add`, label), shown only with
   `can('customers.edit')`.
3. **`CustomerRow`** (`components/customers/CustomerRow.tsx`, memo):
   - Avatar, name `h2`, area · phone, "Rs x / month".
   - End: Amount due (unpaid tone + "Due"), or "Advance" (paid tone), or nothing.
   - Inactive rows show an inactive `Badge`.
   - `minHeight` 72, ripple, combined accessibility label.
4. Two empty states: no customers yet (with the add action) and no matches (clear filters).

### 13.6 Customer detail, `src/app/customer/[id]/index.tsx` [customers]

1. **Profile card**: Avatar 56, name `title`, inactive Badge.
2. **Quick actions** row of labelled tonal IconButtons: Call, WhatsApp, SMS, Edit (role
   checks unchanged). **Security:** build `tel:` only from a phone that passes
   `isValidPhone`, using `digitsOf` (keep a leading `+`). Otherwise hide Call.
3. **Balance card**: label "Current balance", hero Amount (unpaid "Due", paid "Advance" or
   "Settled" with `checkmark-circle`), filled lg "Record payment" (`can('payments.add')`),
   and the WhatsApp / SMS reminder buttons (tonal).
4. **Info rows**: area, address, since / fee, a notes Banner (warning-lite) and the
   scheduled fee as an info Banner.
5. **Month grid** (`components/customers/MonthGrid.tsx`):
   - 4 columns, cells `minHeight` 56, radius 8, status soft fill, status icon 14 + short
     month + amount or a check. Empty months on `surfaceContainer`.
   - Year label above. Legend with StatusBadges.
   - Each cell's accessibility label reads like "March 2026, unpaid, Rs 2,000 due".
6. **Fee history** timeline: dot and line, "from → to" with the arrow flipped in Urdu,
   note in small text. The "Change fee" text button sits in the SectionHeader action.
7. **Payments list**: tonal receipt icon, Amount paid tone, date · method · month,
   received by. Trailing labelled IconButtons: receipt, and delete when
   `can('payments.delete')` (confirm unchanged).

### 13.7 Add / edit customer, `CustomerForm.tsx`, `customer/new.tsx`, `customer/[id]/edit.tsx` [customers]

1. Sections with SectionHeader: Contact (name, phone), Billing (fee `prefix="Rs"`, or the
   current fee + "Change fee" when editing; start date), Area and notes, Status.
2. Status as a Segmented (Active / Inactive) with the hint below.
3. Save goes in a `BottomActionBar`. Delete is an outlined danger button at the end of the
   scroll (the confirm stays).

### 13.8 Fee change, `customer/[id]/fee.tsx` [customers]

1. A current-fee stat card, then the new fee as `Field size="amount" prefix="Rs"`, then
   "From month" with the MonthPicker.
2. The impact note as a Banner: warning for past months (count of re-priced months and how
   many have payments), info for future or current months.
3. Save in a `BottomActionBar`. History timeline with a labelled undo IconButton (confirm
   unchanged).

### 13.9 Areas, `src/app/areas.tsx` [customers]

Replace the raw `TextInput` with `Field` (or a Field-styled input) in the add row, keeping
the Add button. Area rows: tonal `location-outline` icon, name, "n customers", and rename
and delete IconButtons (48dp, labelled; delete confirm unchanged). Inline rename uses the
same Field. EmptyState when there are no areas.

### 13.10 Reports, `src/app/(tabs)/reports.tsx` [money]

1. Filter row at the top (dataviz: filters above everything they scope): Segmented
   Month / Year, then the MonthPicker or year chips.
2. Month view:
   - KPI row: Expected, Collected (paid), Pending (unpaid).
   - Collection-rate Meter "{pct}% collected".
   - Customer status split (thin bar + legend rows with icon, word and count). This
     replaces `✓ · ½ · ✗`.
3. Year view: KPI row (Fees billed, Collected, Pending now), then **YearColumns**
   (section 8.4), then "Month by month" (table view).
4. By method (`components/money/MethodSplit.tsx`), By area (`MeterList.tsx`), By collector
   (`RankedBars.tsx`). Each sits in a Card under a SectionHeader.
5. Export card: caption on what's included, then outlined "PDF" and "Excel" buttons with
   icons in one row (stacked at large font scale). Busy logic unchanged.
6. `noAccess` empty state unchanged.

### 13.11 Receipt, `src/app/receipt/[id].tsx` + PDF, `src/lib/receipt.ts` [money]

1. **Receipt card** (the view-shot target):
   - Teal band at the top (business name white `title`, phone in `onPrimaryMuted`).
   - Then "Payment receipt · R-XXXX".
   - A PAID badge (paid soft, check icon).
   - Hero Amount in paid colour.
   - Detail rows (muted label / bold value, values LTR-isolated), the payment info block
     and a centred footer.
   - White, radius 16, level1, padding 20.
2. Actions: filled "Share image", tonal "Share PDF", tonal "Send on WhatsApp" (same
   conditions).
3. The PDF HTML mirrors the card. All values still go through `esc()`.

### 13.12 Reminders, `src/app/reminders.tsx` [money]

1. **Choose step**:
   - Message preview card with the chat `bubble` (radius 12 with a 4dp corner on the
     reading-start side as the tail), "Edit message" assist chip (`can` unchanged).
   - "Selected n of m" with "Select all" / "Select none" text buttons.
   - Rows: checkbox icon 24, name, phone · reminded on, Amount due tabular. No-phone rows
     are disabled at 0.5 with the word "No phone".
   - Footer `BottomActionBar` with filled lg "Start sending (n)".
2. **Send step**: "n of total" + Meter, a customer card (Avatar, name, phone, Amount),
   the bubble, then filled lg "Open WhatsApp", tonal "Send SMS" and text "Skip" (same
   logic). Done: success EmptyState with "Done".

### 13.13 Message template, `src/app/messages.tsx` [money]

Multiline Field with a character count in the hint, placeholder assist chips (`+ {name}`),
a live preview bubble, Save in a `BottomActionBar` and "Reset to default" as a text button.

### 13.14 Settings, `src/app/(tabs)/settings.tsx` [settings]

1. **Profile card** at the top: business Avatar 56, name, phone. With premium staff, a
   "Using as {name} · {role}" line and a tonal "Switch user" button (same conditions).
   Tapping it opens Business info when `can('settings.business')`.
2. Sections with SectionHeader: Business, Premium, Language, Backup and restore, About,
   Data. ListItems get tonal leading icons and flipped chevrons.
3. Premium rows show `Badge tone="premium"` (indigo, star) instead of amber.
4. Language: Segmented (English | اردو).
5. Backup card: "Last backup {date}" with a `time-outline` icon, filled "Back up now",
   tonal "Restore".
6. "Delete all data" in an outlined card with a danger ListItem (confirm unchanged).

### 13.15 Premium, `src/app/premium.tsx` + `PremiumGate.tsx` [settings]

1. Hero card (gradient, white star, title, pitch or active text), then a features list
   with `checkmark-circle` in primary.
2. Plan radio cards: radius 12, 1dp outline; selected gets a 2dp primary border and a
   `primarySubtle` fill. Price in `h2`, period, and a trial Badge (info).
3. Filled lg "Subscribe", then the terms text at 13sp minimum, then the "Restore purchases"
   and "Manage subscription" text buttons. Play-required price, period, renewal and cancel
   information stays visible above the button. The dev switch is unchanged (`__DEV__`
   only).
4. PremiumGate: EmptyState with the star in a tertiary tonal circle, a three-line feature
   summary and "See premium" (`can('subscription')`).

### 13.16 Staff, `staff/index.tsx`, `staff/edit.tsx`, `SwitchUserSheet.tsx` [settings]

1. Staff rows: Avatar, name, role Badge (neutral), lock icon when a PIN is set, cloud
   status word, and "Collected in {month}: Rs x".
2. Roles explained as three ListItems with icons (`key-outline`, `briefcase-outline`,
   `wallet-outline`).
3. The edit form uses sections and a role Segmented. **The PIN field gets `secure`**
   (masked). The invite code shows in a large LTR Inter `headline` card with
   "Share invite".
4. SwitchUserSheet uses `BottomSheet`. Rows: Avatar, name, role, lock icon, and a check on
   the current user. **The PIN entry Field gets `secure`.** The error is announced.

### 13.17 Businesses, business info, cloud, join, alerts, payment details, privacy [settings]

- **Businesses:** rows with Avatar, a "Current" Badge and a labelled delete IconButton
  (confirm unchanged). The add form sits in a card.
- **Business info:** form card with Save in a `BottomActionBar`.
- **Cloud:**
  - A sync status card with icon, colour and word: synced `checkmark-circle` paid,
    pending `time-outline` warning, error `close-circle` danger. Plus the last sync time
    and "Sync now".
  - The account section has danger buttons.
  - The account-deletion link is a text button "Open account deletion page" with the URL
    as a caption. Open it only if it parses as `https:`.
- **Join and cloud sign-in:** numbered steps; code field LTR in Inter.
- **Alerts:** each alert is a card with an icon, `h2` title and a trailing Switch. Day
  chips wrap in a grid. A time chip, a premium Badge chip, a tonal "Send test alert" and
  the privacy note.
- **Payment details:** an info Banner explaining where the details appear (reminders,
  receipts). The fields are unchanged and the link is still validated.
- **Privacy:** readable text with a max width of 640, `h2` section headings, the Urdu
  summary card with Urdu line height, and a contact button with a `mail-outline` icon.

### 13.18 PDF and Excel export, `src/lib/exportReport.ts`, `src/lib/html.ts` [money]

1. `htmlPage`:
   - Add `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`.
     No scripts and no remote resources reach the print WebView.
   - Urdu font stack under `html[lang=ur]`: `'Noto Nastaliq Urdu','Noto Naskh Arabic',sans-serif; line-height: 2`.
   - `.num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }`.
   - Keep `esc()` and its tests.
2. Report HTML: a brand header band (business, period, generated date), a KPI card row,
   section headings, zebra rows, end-aligned tabular numbers, status words in status
   colours. The data stays identical.

---

## 14. Security and privacy guardrails for UI work

The owner's requirement is "no security loophole from start to end". Every task follows
these rules:

1. **No dynamic code.** No `eval`, no `new Function`, no `dangerouslySetInnerHTML`, no
   remote scripts.
2. **HTML is escaped.** User text goes into receipt and report HTML only through `esc()`.
   The print page carries a CSP that blocks scripts and remote loads (section 13.18).
3. **URLs are validated before `Linking.openURL`.** Allowed schemes are `https:`, `http:`
   (payment links checked by `isValidLink`), `tel:`, `sms:`, `mailto:` and `wa.me`. Build
   them with the existing helpers (`whatsappUrl`, `smsUrl`). The customer detail
   `tel:`, WhatsApp and SMS links (13.6) are built only from a valid phone number in
   `src/components/customers/links.ts`. The account-deletion page and contact links
   (13.17) pass `safeHttpsUrl` / `mailtoUrl` in `src/components/settings/links.ts`. Both
   files are unit-tested.
4. **No personal data in logs.** Replace `console.warn(e)` and `console.warn('...', e)` in
   touched files with `if (__DEV__) console.warn('<fixed message>')`. Never log names,
   phones, amounts, emails or error objects that may contain them.
5. **Secrets.** Nothing hard-coded. Supabase keys stay in `EXPO_PUBLIC_*` env as they are.
6. **Role checks stay.** Every action keeps its `useApp().can(...)` gate. Hiding a button
   is in addition to the check, never instead of it.
7. **Shared phones.** PIN inputs are masked (`secure`). PINs never show in the UI, toasts
   or logs.
8. **No new permissions, trackers or analytics.** Fonts are local assets. No remote images.
   Sample data in previews ("Ali Khan") is fictional.
9. **SQL** stays parameterised in `src/db/**`. UI work doesn't touch it.
10. **Screenshots and shares:** view-shot captures only the receipt card. Shared files go
    through the system share sheet as today.

---

## 15. Dependencies

| Package | Add? | Why | Expo Go |
| --- | --- | --- | --- |
| `@expo-google-fonts/inter` | **Add** (`npx expo install`) | Latin UI and all numbers; 4 weights | Yes: JS package with TTF assets loaded by `expo-font` `useFonts` at runtime. `expo-font` is "Included in Expo Go" |
| `@expo-google-fonts/noto-nastaliq-urdu` | **Add** | Urdu in Nastaliq; 2 weights | Yes, same mechanism |
| `expo-linear-gradient` | No (fallback only) | RN 0.88 core `backgroundImage: linear-gradient()` covers the hero | v58 page: "Included in Expo Go", ~58.0.4 |
| `react-native-svg` | No | Charts are View-based (RTL, ripple, accessibility for free). Use it only if a line chart is ever needed | v58 page: "Included in Expo Go", 15.16.0 |
| `expo-haptics` | No | The v58 page lacks the "Included in Expo Go" badge | Unconfirmed |
| `expo-image` | No | The app shows no remote or raster images | Included in Expo Go |
| `react-native-reanimated` | No direct import | RN `Animated` is enough. It's present only through expo-router | – |

No new permissions. Both font packages are OFL-1.1 licensed, which allows bundling.

---

## 16. Work order and file ownership

1. **Foundation** (first, alone): `src/theme.ts`, `src/components/ui.tsx`,
   `src/components/pickers.tsx`, new `src/components/ds/*`, `src/app/_layout.tsx`,
   `src/app/(tabs)/_layout.tsx`, `src/i18n/groups/design.ts`, `package.json` (the two font
   packages). Existing exports and props must keep compiling. Only add, alias, and change
   the values called out here.
2. **Area teams** (in parallel, after foundation): core, customers, money and settings own
   the files listed in their brief. Each adds strings only to its own
   `src/i18n/groups/<area>.ts` with an `<area>` key prefix, in English and natural Urdu.
3. **Definition of done per task:**
   - Uses tokens and shared components (no hex in screens, no inline `fontSize` or
     `fontWeight`).
   - The section 12 checklist passes.
   - Both languages are checked.
   - `npx tsc --noEmit` and `npx expo lint` are clean (Node 22 PATH prefix).
   - `npm test` still passes when `src/lib/*` is touched.

---

## 17. QA in Expo Go (owner's phone)

- [ ] Fonts load. The splash hides once fonts are ready, and a font error falls back to
  the system font.
- [ ] Inter 400/600/700 render as distinct weights. Urdu screens render in Nastaliq with
  nothing clipped in buttons, chips, tabs, inputs or list rows.
- [ ] Tab bar: Home is on the right in Urdu; the indicator and labels are correct; the
  bar hides with the keyboard.
- [ ] Home: the hero, the meter direction (from the right in Urdu) and the 3-tap flow to a
  saved payment.
- [ ] Reports: the year columns run right to left in Urdu, the tap readout works, and the
  method colours stay the same when the period changes.
- [ ] Receipt image and PDF share in both languages, and the PDF has no remote requests.
- [ ] Font scale 2.0: nothing overlaps or gets cut, and KPI rows stack.
- [ ] TalkBack: rows read as one sentence, tabs announce selected, and the payment sheet
  traps focus.

---

## 18. Sources

- Expo v58 docs:
  - Font, "Included in Expo Go": https://docs.expo.dev/versions/v58.0.0/sdk/font/
  - Fonts guide (`useFonts` works in Expo Go; config plugin needs a dev build):
    https://docs.expo.dev/develop/user-interface/fonts/
  - react-native-svg, "Included in Expo Go", 15.16.0: https://docs.expo.dev/versions/v58.0.0/sdk/svg/
  - LinearGradient, "Included in Expo Go", ~58.0.4: https://docs.expo.dev/versions/v58.0.0/sdk/linear-gradient/
  - Haptics (no Expo Go badge; VIBRATE added automatically; `performAndroidHapticsAsync`
    needs none): https://docs.expo.dev/versions/v58.0.0/sdk/haptics/
  - Router tabs (options, badges, `href: null`): https://docs.expo.dev/router/advanced/tabs/
  - Native tabs (Android max 5 tabs, no custom bar): https://docs.expo.dev/router/advanced/native-tabs/
- React Native 0.88 View style props (`backgroundImage` gradients; `boxShadow` New Arch,
  Android 9+): https://reactnative.dev/docs/view-style-props
- Material 3 component specs, cross-checked in Material Components for Android (m3.material.io
  renders client-side):
  - Navigation bar (64dp Expressive, 56x32 indicator, secondaryContainer, 24dp icons):
    https://github.com/material-components/material-components-android/blob/master/docs/components/BottomNavigation.md
  - Bottom sheet (extra-large corners, 1dp elevation, 640dp max width, 48dp handle target):
    https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md
  - Chips (32dp, 8dp corners, 48dp touch target, 18dp icons):
    https://github.com/material-components/material-components-android/blob/master/docs/components/Chip.md
  - Type scale: https://github.com/material-components/material-components-android/blob/master/docs/theming/Typography.md
- The `dataviz` skill: form heuristic, mark specs, status rules and palette validator.
  Results are in section 8.2.
- Font metrics were measured from the package TTFs (Noto Nastaliq Urdu: UPM 1000, ascent
  1904, descent 596; Inter: UPM 2048, ascent 1984, descent 494).
- South Asian ledger apps (Khatabook, OkCredit, Udhaar Book): red due and green settled,
  large balance on the customer page, one-tap WhatsApp reminders. Khatabook reported
  users leaving after big one-shot UI changes:
  https://yourstory.com/2021/08/product-roadmap-fintech-startup-khatabook-10-million-msme-users

---

## 19. Components (as built by the foundation pass)

Import shared pieces from `src/components/ui.tsx` and `src/components/ds/*`, tokens from
`src/theme.ts`. Every component already handles Urdu (Nastaliq font, `rowDir`
mirroring, reading-side alignment), 48dp touch targets and TalkBack labels. Don't put
hex colours, `fontSize` or `fontWeight` in screens.

### Tokens (`src/theme.ts`)

- `colors` (all of section 3, old keys kept), `feedbackColors.{error,warning,info,success}`
  (`fg`, `container`, `onContainer`, `border`, `icon`), `statusColors.{paid,partial,unpaid}`
  (`fg`, `bg` = soft, `onSoft`, `icon`), `inactiveColors`, `advanceColors`.
- `chart` (`accent`, `accentTrack`, `context`, `grid`, `axisText`, `heroTrack`, `heroFill`,
  `method.{cash,jazzcash,easypaisa,bank}`).
- `typography` (also exported as `type`): `family`, `latin` and `urdu` scales.
- `space` (`xxs`…`xxxl`), `radius` (`xs`…`xl`, `pill`), `elevation` (boxShadow strings),
  `shadow.level0-3` (style objects), `size`, `gradients.hero` / `heroRTL`, `motion`.

### Text and numbers (`ui.tsx`)

| Component | Use |
| --- | --- |
| `Txt` | `<Txt variant="h2" tone="secondary" weight={600} header>`. Variants `hero headline title h2 bodyLarge body muted small label`. `tone`: `text secondary muted primary onPrimary paid partial unpaid danger`. `ltr` keeps phones/codes in Inter, left-to-right. `align="start\|end\|center"`. Old props (`color`, `bold`, `center`, `numberOfLines`, `style`) still work; a `fontSize` in `style` gets a matching line height. |
| `Amount` | `<Amount value={n} variant="title" tone="unpaid" tabular />`: `money(n)` in Inter, LTR, aligned to the reading side. `tabular` in lists and tables. |
| `bidiIsolate(s)` | Wrap a number or phone inside an Urdu sentence built in code. |
| `useScriptTextStyle(role)` / `scriptTextStyle(role, urdu, loaded)` | Font style for a raw `Text`/`TextInput` when no component fits. |

### Buttons and inputs (`ui.tsx`)

| Component | Use |
| --- | --- |
| `Button` | `variant`: `filled`/`primary`, `tonal`/`secondary`, `outlined`, `text`/`ghost`, `danger`. `size="lg"` (56dp) for the main action. `icon`, `iconFlipForRTL`, `loading` (keeps width), `disabled`, `destructive` (red outlined/text), `compact`. Pill shape, ripple. |
| `IconButton` | `<IconButton name="create-outline" label={t('edit')} variant="tonal" onPress={…} />`. `label` is required. Variants `standard tonal filled outlined`; `disabled`, `flipForRTL`, `iconSize`. |
| `Field` | M3 outlined field. New: `prefix="Rs"`, `size="amount"` (Inter 28 bold, centred, number pad), `onSubmitEditing`, `returnKeyType`, `editable`. Use `secure` for PINs and passwords, `ltr` for phones and codes. Errors are announced. |
| `SearchBar` | Same props as before; pill on `surfaceContainer`, labelled clear button. |
| `Chip` | Filter chip by default (`selected` shows a check on primaryContainer); `variant="assist"` for actions such as "Edit message" (keeps `icon`, no check). `disabled`. |
| `ChipRow` | Horizontal scroller in reading order (starts at the right in Urdu). `bleed` lets it run to the screen edges inside the 16dp screen padding. |
| `Segmented` | Options: `{ key, label, count?, icon?, tone? }`. `tone` (status tabs) fills the selected segment with the status soft colour and shows the status icon; counts show as "· 12". The old `color: statusColors[s].fg` maps to `tone` automatically. |
| `AppSwitch` | RN Switch with the app track colours; `accessibilityLabel` required. |

### Containers, lists, status (`ui.tsx`)

| Component | Use |
| --- | --- |
| `Card` | `variant`: `elevated` (default), `outlined`, `filled`, `tonal`, `hero` (teal gradient; `Txt`, `Amount` and `Meter` inside turn white automatically). `onPress` makes the whole card a button (pass `accessibilityLabel`). |
| `Screen` | Scrolling body as before; `safeTop` pads by the status bar (Home, which has no header now). |
| `SectionHeader` | `<SectionHeader title={t('feeHistory')} action={{ label: t('changeFee'), onPress }} />`. `SectionTitle` still works (now sentence case). |
| `ListItem` | `icon` in a 40dp tonal circle (`iconTone`: `primary danger neutral premium`), or `leading={<Avatar name={…} />}`; `title`, `subtitle`, `right`, `onPress`, `danger`, `accessibilityLabel`, `disabled`. |
| `Divider` | `inset={72}` under rows with leading icons. |
| `Avatar` | `<Avatar name={customer.name} size={56} />`, decorative. |
| `StatusBadge` | `<StatusBadge status="unpaid" />` (icon + word). `style` for `alignSelf`. |
| `Badge` | `<Badge label={t('premium')} tone="premium" />`. Tones: `neutral premium info success warning error paid partial unpaid inactive advance`; optional `icon`. |
| `StatusIcon` | `<StatusIcon status="unpaid" />`: 40dp circle for due rows (also `inactive`, `advance`). Hidden from TalkBack unless `accessibilityLabel` is set. |
| `Banner` | `<Banner tone="warning" title? body action={{ label, onPress }} />`. |
| `EmptyState` | `icon`, `title`, `body`, `action`, `tone` (`primary success premium neutral`). |

### Data display and chrome (`src/components/ds/`)

| File / component | Use |
| --- | --- |
| `Meter.tsx`: `Meter`, `percentOf` | `<Meter value={collected} max={expected} label={t('collected')} />`: 8dp track, fill from the reading start, "{pct}%" at the end, progressbar semantics. White on a hero card. For the caption use `t('designPercentCollected', { percent })`. |
| `SegmentedBar.tsx`: `SegmentedBar` | `<SegmentedBar segments={[{ key: 'paid', value: 12, color: statusColors.paid.fg, label: t('paid') }, …]} size="thin" />` (`tall` = 28dp). Always add a legend with icon, word and count. `gapColor` if it isn't on white. |
| `StatTile.tsx`: `StatTile` | `<StatTile label={t('pending')} value={pending} tone="unpaid" status="unpaid" onPress={…} />`. `format="count"` for numbers that aren't money; `sub`; `children` (e.g. a SegmentedBar). |
| `KpiRow.tsx`: `KpiRow` | Wrap StatTiles: 2 columns, 1 column above font scale 1.3, odd last tile spans. |
| `Sheet.tsx`: `BottomSheet` | `<BottomSheet visible onClose title subtitle? header? footer={<>Buttons</>}>…</BottomSheet>`. Scrim and close button labelled `t('close')`, keyboard-safe, focus trapped. |
| `Fab.tsx`: `Fab`, `FAB_CLEARANCE` | `<Fab icon="person-add" label={t('addCustomer')} onPress={…} />` as the last child of a `flex: 1` screen View; give the list `contentContainerStyle={{ paddingBottom: FAB_CLEARANCE }}`. |
| `BottomActionBar.tsx`: `BottomActionBar` | Put after the ScrollView in a `flex: 1` View: `<BottomActionBar><Button size="lg" … /></BottomActionBar>`. `safeArea={false}` on tab screens. |
| `AppTabBar.tsx`: `AppTabBar` | Already wired in `(tabs)/_layout.tsx`. Tab titles and icons stay in that file. |
| `FormScreen.tsx`: `FormScreen` | Form chrome for stack screens with a header: `<FormScreen footer={<Button size="lg" … />}>…</FormScreen>`. A scrolling body plus an optional sticky `BottomActionBar`, inside a KeyboardAvoidingView offset by the header height, so the focused field and Save stay above the keyboard. Used by the customer form, fee change, areas, business info, payment details, staff, businesses, message template and join screens. |
| `keyboard.ts`: `useKeyboardVisible()` | True while the keyboard is open. The tab bar hides then, and `FormScreen` drops the navigation-bar inset. |
| `fonts.ts` | `useAppFonts()` (root layout only), `useFontsLoaded()`, `fontStyleFor(weight, urdu, loaded)`, `fontFamilyFor(weight, isRTL)`. If Inter weights look the same on the phone, set `PREFER_FONT_FAMILIES = false` there (Android 9 and below already use per-face fonts). |
| `motion.ts` | `useReduceMotion()`, `easing.standard` / `easing.decelerate` for RN `Animated`. |
| `MonthPicker`, `DateField`, `AreaFilter` (`src/components/pickers.tsx`) | Same props as before, restyled. |

Strings for these components are in `src/i18n/groups/design.ts` (`design*` keys). Chart
legends reuse `collected` and `feesBilled` (or `designLegendBilled`), and "Month by month"
reuses `monthlySummary`.

### Area components (built by the screen teams)

Each team kept its screen-specific pieces next to its strings file
(`src/i18n/groups/<area>.ts`):

| Folder | Components |
| --- | --- |
| `src/components/core/` | `HomeTopBar`, `CollectionHero` (hero card), `StatusSplit` (Home tile bar), `DueRow` (Collection row), `GuideSteps`, `IconCircle` |
| `src/components/customers/` | `CustomerRow`, `MonthGrid`, `FeeTimeline`, `PaymentItem`, `QuickAction`, `links.ts` (checked tel/WhatsApp/SMS links), `text.ts` (`useLtr`, `useA11yJoin`) |
| `src/components/money/` | Charts: `YearColumns`, `MeterList`, `MethodSplit`, `RankedBars`, `StatusSplit`; `MessageBubble`, `ContentText` (user text with Urdu detection), `scale.ts` |
| `src/components/settings/` | `ProfileCard`, `PlanCard`, `bits.tsx` (`ListCard`, `Loading`, `StepList`, `PremiumChip`), `rows.tsx` (staff, person and business rows), `links.ts` (checked https/mailto links), `pinThrottle.ts` (wrong-PIN pause), `roles.ts` |

### Implementation notes (values that differ from the sections above)

- The root layout waits for fonts at most 6 seconds, then shows the app with system
  fonts. The fonts swap in when they finish loading.
- Single-line Urdu controls (buttons, chips, segments, tab labels, FAB, banner actions) use
  the font's natural line height (section 5.3 allows this). Badges use 13/26.
- Button labels can wrap at large font scales in English too, so they never truncate.
  Segment labels wrap to at most 2 lines.
- Pressed feedback on the tab indicator and on tonal, filled and outlined IconButtons is a
  12% state layer, not `android_ripple`. A borderless ripple would be drawn behind the
  filled circle. Standard IconButtons use a borderless ripple (radius 22).
- The ListItem leading circle uses `primaryContainer` / `onPrimaryContainer` (tonal).
- Chips are 40dp high, including their 1dp border.
- Elevated cards and the MonthPicker get a hairline border instead of a shadow on
  Android 8 and below, where `boxShadow` isn't drawn.
- Avoid `something.value` inside inline style objects (`style={{ flex: s.value }}`). The
  Reanimated Babel plugin that ships with expo-router injects a dev warning call there.
  Destructure first.

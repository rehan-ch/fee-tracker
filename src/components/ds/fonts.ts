/**
 * App fonts (docs/DESIGN.md 5.1): Inter for Latin text and every number, Noto
 * Nastaliq Urdu for Urdu. They load at runtime with expo-font `useFonts` from
 * the TTF files bundled in the npm packages, so this works in Expo Go, makes no
 * network request and needs no permission. Only the faces used are imported
 * (per-face subpaths), so the other weights are not bundled.
 */
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu/400Regular';
import { NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu/700Bold';
import { useFonts, type FontFamilyDefinition } from 'expo-font';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform, type TextStyle } from 'react-native';

import { typography, type FontWeightValue } from '../../theme';

/**
 * How weights are picked:
 * - 'family': one family per script ('Inter', 'UrduNastaliq'); `fontWeight` picks the face.
 * - 'faces': each face is registered under its own name (for example 'Inter_700Bold');
 *   fontFamilyFor() maps the weight to that name and `fontWeight` stays 'normal'
 *   (no faux bold).
 * Android below API 29 loads only a family's default face, so it always uses 'faces'.
 * If Inter 400/600/700 don't render as distinct weights in Expo Go, set this to false.
 */
const PREFER_FONT_FAMILIES = true;

export const FONT_MODE: 'family' | 'faces' =
  PREFER_FONT_FAMILIES && (Platform.OS !== 'android' || Number(Platform.Version) >= 29)
    ? 'family'
    : 'faces';

/** Show the app with system fonts if loading takes longer than this (fonts swap in when ready). */
const FONT_LOAD_TIMEOUT_MS = 6000;

const LATIN_FACES = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
} as const;
const URDU_FACES = { 400: 'NotoNastaliqUrdu_400Regular', 700: 'NotoNastaliqUrdu_700Bold' } as const;

const FAMILY_DEFINITIONS: FontFamilyDefinition[] = [
  {
    fontFamily: typography.family.latin,
    fontDefinitions: [
      { path: Inter_400Regular, weight: 400 },
      { path: Inter_500Medium, weight: 500 },
      { path: Inter_600SemiBold, weight: 600 },
      { path: Inter_700Bold, weight: 700 },
    ],
  },
  {
    fontFamily: typography.family.urdu,
    fontDefinitions: [
      { path: NotoNastaliqUrdu_400Regular, weight: 400 },
      { path: NotoNastaliqUrdu_700Bold, weight: 700 },
    ],
  },
];

const FACE_MAP: Record<string, number> = {
  [LATIN_FACES[400]]: Inter_400Regular,
  [LATIN_FACES[500]]: Inter_500Medium,
  [LATIN_FACES[600]]: Inter_600SemiBold,
  [LATIN_FACES[700]]: Inter_700Bold,
  [URDU_FACES[400]]: NotoNastaliqUrdu_400Regular,
  [URDU_FACES[700]]: NotoNastaliqUrdu_700Bold,
};

const FONT_SOURCES = FONT_MODE === 'family' ? FAMILY_DEFINITIONS : FACE_MAP;

/** Snap any weight (number, '600', 'bold', 'normal') to a loaded Inter weight. */
export function snapWeight(w: TextStyle['fontWeight'] | number | undefined): FontWeightValue {
  if (w === 'bold') return 700;
  const n = typeof w === 'number' ? w : Number(w);
  if (!Number.isFinite(n) || n < 450) return 400;
  if (n < 550) return 500;
  if (n < 650) return 600;
  return 700;
}

/**
 * Font family for a weight and script. In 'family' mode this is just 'Inter' or
 * 'UrduNastaliq'; in 'faces' mode it is the single-face name for the weight
 * (Urdu has 400 and 700 only).
 */
export function fontFamilyFor(weight: number, isRTL: boolean): string {
  if (FONT_MODE === 'family') return isRTL ? typography.family.urdu : typography.family.latin;
  if (isRTL) return weight >= 600 ? URDU_FACES[700] : URDU_FACES[400];
  return LATIN_FACES[snapWeight(weight)];
}

/**
 * The `fontFamily` + `fontWeight` pair to put in a text style. `urdu` picks
 * Nastaliq. While custom fonts are unavailable (failed or still loading) it
 * returns only the weight, so the system font is used.
 */
export function fontStyleFor(
  weight: number,
  urdu: boolean,
  loaded: boolean,
): { fontFamily?: string; fontWeight: NonNullable<TextStyle['fontWeight']> } {
  const w = snapWeight(weight);
  const asString = String(w) as '400' | '500' | '600' | '700';
  if (!loaded) return { fontWeight: asString };
  if (FONT_MODE === 'family') return { fontFamily: fontFamilyFor(w, urdu), fontWeight: asString };
  return { fontFamily: fontFamilyFor(w, urdu), fontWeight: 'normal' };
}

/** True once the custom fonts are registered. Provided by the root layout. */
export const FontsLoadedContext = createContext(false);

/** Whether Inter / Nastaliq can be used (false means: use the system font). */
export function useFontsLoaded(): boolean {
  return useContext(FontsLoadedContext);
}

/**
 * Loads the app fonts. `fontsSettled` turns true when the fonts loaded, failed,
 * or took too long: the app never blocks on fonts and falls back to system fonts.
 */
export function useAppFonts(): { fontsLoaded: boolean; fontError: Error | null; fontsSettled: boolean } {
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const id = setTimeout(() => setTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Fixed message only: no error object (paths), no personal data.
    if (fontError && __DEV__) console.warn('App fonts failed to load; using the system font.');
  }, [fontError]);

  return { fontsLoaded, fontError, fontsSettled: fontsLoaded || !!fontError || timedOut };
}

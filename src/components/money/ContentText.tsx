/**
 * Text the business wrote itself (reminder templates, payment details). Its
 * language doesn't have to match the app's: an English template in the Urdu
 * app, or the reverse. So the script font and alignment follow the text,
 * not the app language: Nastaliq and right-aligned when it contains Urdu,
 * Inter and left-aligned otherwise. Android lays out each line in the
 * direction of its first letter.
 */
import { Text, type TextStyle } from 'react-native';

import { colors } from '../../theme';
import { useFontsLoaded } from '../ds/fonts';
import { hasUrdu, scriptTextStyle } from '../ui';

/** Same check as ui.tsx (kept here so existing imports keep working). */
export { hasUrdu };

export function ContentText({
  children,
  role = 'body',
  color = colors.text,
  selectable,
}: {
  children: string;
  role?: 'body' | 'small';
  color?: string;
  selectable?: boolean;
}) {
  const loaded = useFontsLoaded();
  const urdu = hasUrdu(children);
  const dir: TextStyle = urdu
    ? { writingDirection: 'rtl', textAlign: 'right' }
    : { writingDirection: 'ltr', textAlign: 'left' };
  return (
    <Text selectable={selectable} style={[scriptTextStyle(role, urdu, loaded), dir, { color }]}>
      {children}
    </Text>
  );
}

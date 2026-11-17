/**
 * Chat-style preview of a reminder message (docs/DESIGN.md 13.12, 13.13):
 * the `bubble` token, 12dp corners with a 4dp "tail" corner at the top of the
 * reading-start side (left in English, right in Urdu). The message itself is
 * set in its own script and direction (see ContentText).
 */
import { StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, radius, space } from '../../theme';
import { ContentText } from './ContentText';

export function MessageBubble({ text }: { text: string }) {
  const { isRTL } = useApp();
  return (
    <View style={[styles.bubble, isRTL ? styles.tailRight : styles.tailLeft]}>
      <ContentText selectable>{text}</ContentText>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: colors.bubble,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + space.xxs,
  },
  // Explicit sides: `start` would mean left in Urdu too (native direction stays LTR).
  tailLeft: { borderTopLeftRadius: radius.xs },
  tailRight: { borderTopRightRadius: radius.xs },
});

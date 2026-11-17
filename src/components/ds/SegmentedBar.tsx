/**
 * Part-to-whole bar (docs/DESIGN.md 8.1, 8.3): segments in reading order
 * (from the right in Urdu) separated by 2dp surface gaps. `thin` is 8dp,
 * `tall` 28dp. Always pair it with a legend (icon or swatch, word, count):
 * colour is never the only signal.
 */
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useApp } from '../../state/app';
import { colors, motion, radius, size, space } from '../../theme';
import { easing, useReduceMotion } from './motion';

export interface BarSegment {
  key: string;
  value: number;
  color: string;
  /** Used to build the accessibility summary ("Paid: 12, Unpaid: 3"). */
  label?: string;
}

/** Status split / method split bar. */
export function SegmentedBar({
  segments,
  size: barSize = 'thin',
  accessibilityLabel,
  gapColor,
  style,
}: {
  segments: BarSegment[];
  size?: 'thin' | 'tall';
  /** Summary read by TalkBack; built from segment labels when omitted. */
  accessibilityLabel?: string;
  /** Colour of the 2dp gaps: the surface behind the bar (default white). */
  gapColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { rowDir, isRTL, t } = useApp();
  const reduceMotion = useReduceMotion();
  const [grow] = useState(() => new Animated.Value(0));
  const visible = segments.filter((s) => s.value > 0);
  const tall = barSize === 'tall';

  useEffect(() => {
    if (reduceMotion) {
      grow.setValue(1);
      return;
    }
    const anim = Animated.timing(grow, {
      toValue: 1,
      duration: motion.base,
      easing: easing.decelerate,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [grow, reduceMotion]);

  const summary =
    accessibilityLabel ??
    (visible.length === 0
      ? t('designNoData')
      : segments
          .filter((s) => s.label)
          .map((s) => `${s.label}: ${s.value}`)
          .join(isRTL ? '، ' : ', '));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={[
        styles.bar,
        {
          height: tall ? size.segBarTall : size.segBarThin,
          borderRadius: tall ? radius.xs : radius.pill,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.inner,
          {
            flexDirection: rowDir,
            // The 2dp gaps show the surface the bar sits on (white card by default).
            backgroundColor: visible.length > 0 ? (gapColor ?? colors.card) : 'transparent',
            transformOrigin: isRTL ? 'right' : 'left',
            transform: [{ scaleX: grow }],
          },
        ]}
      >
        {visible.map(({ key, value: share, color }) => (
          <View key={key} style={{ flex: share, backgroundColor: color }} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  inner: {
    flex: 1,
    gap: space.xxs,
  },
});

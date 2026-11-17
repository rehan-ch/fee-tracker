/**
 * Meter (docs/DESIGN.md 8.3): an 8dp pill track whose fill grows from the
 * reading start (the right in Urdu), with the percent as text beside it and
 * progressbar semantics. On a hero card it switches to the white-on-teal track.
 */
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useApp } from '../../state/app';
import { chart, motion, radius, size, space } from '../../theme';
import { Row, Txt, useOnHero } from '../ui';
import { easing, useReduceMotion } from './motion';

/** Whole percent of done / total, never showing 100 before it is complete. */
export function percentOf(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) return 0;
  const ratio = done / total;
  if (ratio >= 1) return 100;
  return Math.min(99, Math.round(ratio * 100));
}

/** Progress meter: `value` out of `max` (default 1). */
export function Meter({
  value,
  max = 1,
  label,
  showPercent = true,
  color,
  trackColor,
  style,
}: {
  value: number;
  max?: number;
  /** What the meter measures, read by TalkBack (e.g. "Collected"). */
  label?: string;
  /** Show "{pct}%" at the end of the track. */
  showPercent?: boolean;
  /** Fill colour; defaults to the chart accent (white on a hero card). */
  color?: string;
  trackColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { isRTL } = useApp();
  const onHero = useOnHero();
  const reduceMotion = useReduceMotion();
  const pct = percentOf(value, max);
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const [fill] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(ratio);
      return;
    }
    const anim = Animated.timing(fill, {
      toValue: ratio,
      duration: motion.base,
      easing: easing.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [fill, ratio, reduceMotion]);

  return (
    <Row
      gap={space.sm}
      style={style}
    >
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct}%` }}
        style={[
          styles.track,
          { backgroundColor: trackColor ?? (onHero ? chart.heroTrack : chart.accentTrack) },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color ?? (onHero ? chart.heroFill : chart.accent),
              transformOrigin: isRTL ? 'right' : 'left',
              transform: [{ scaleX: fill }],
            },
          ]}
        />
      </View>
      {showPercent ? (
        <Txt variant="label" ltr style={styles.percent}>
          {`${pct}%`}
        </Txt>
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: size.meter,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: radius.pill,
  },
  percent: { minWidth: 40, fontVariant: ['tabular-nums'] },
});

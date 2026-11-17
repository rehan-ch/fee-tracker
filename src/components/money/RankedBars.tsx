/**
 * Ranked horizontal bars (docs/DESIGN.md 8.1, 8.3): one hue (chart.accent),
 * 12dp thick, square at the baseline and 4dp rounded at the data end, largest
 * first. The name sits above each bar and the value at its tip in text
 * tokens. Bars grow from the reading start, so they run right to left in Urdu.
 */
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useApp } from '../../state/app';
import { chart, radius, space } from '../../theme';
import { Row, Txt } from '../ui';

export interface RankedRow {
  key: string;
  label: string;
  /** Small text after the name, e.g. "12 payments". */
  sub?: string;
  value: number;
}

const BAR = 12;
/** Room kept after the longest bar for its value label (scaled with the font). */
const TIP_ROOM = 104;

export function RankedBars({ rows, format }: { rows: RankedRow[]; format: (n: number) => string }) {
  const { isRTL } = useApp();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(0, ...sorted.map((r) => r.value));
  const room = Math.min(width * 0.6, TIP_ROOM * Math.max(1, fontScale));
  const track = Math.max(0, width - room);
  const sep = isRTL ? '، ' : ', ';
  // Square at the baseline (reading start), rounded at the data end.
  const dataEnd = isRTL
    ? { borderTopLeftRadius: radius.xs, borderBottomLeftRadius: radius.xs }
    : { borderTopRightRadius: radius.xs, borderBottomRightRadius: radius.xs };

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {sorted.map((r) => {
        // Drawn once the width is measured, so the first frame has no stub bars.
        const length = track > 0 && max > 0 && r.value > 0 ? Math.max(2, (r.value / max) * track) : 0;
        return (
          <View
            key={r.key}
            accessible
            accessibilityLabel={[r.label, r.sub, format(r.value)].filter(Boolean).join(sep)}
            style={styles.item}
          >
            <Row gap={space.xs} wrap>
              <Txt weight={600}>{r.label}</Txt>
              {r.sub ? <Txt variant="small">{`· ${r.sub}`}</Txt> : null}
            </Row>
            <Row gap={space.sm}>
              {length > 0 ? <View style={[styles.bar, dataEnd, { width: length }]} /> : null}
              <Txt variant="small" tone="secondary" ltr numberOfLines={1} style={styles.value}>
                {format(r.value)}
              </Txt>
            </Row>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  item: { gap: space.xs },
  bar: { height: BAR, backgroundColor: chart.accent },
  value: { fontVariant: ['tabular-nums'], flexShrink: 1 },
});

/**
 * KPI row (docs/DESIGN.md 8.5): stat tiles in 2 columns with a 12dp gap, in
 * reading order; 1 column when the system font scale is above 1.3. With an
 * odd count, the last tile spans both columns.
 */
import { Children, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { space } from '../../theme';
import { Row } from '../ui';

/** Lays out StatTiles (or any cards) as a responsive grid. */
export function KpiRow({ children }: { children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const items = Children.toArray(children);
  if (fontScale > 1.3) return <View style={styles.column}>{items}</View>;

  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={styles.column}>
      {rows.map((pair, r) => (
        <Row key={r} gap={space.md} align="stretch">
          {pair.map((item, c) => (
            <View key={c} style={styles.cell}>
              {item}
            </View>
          ))}
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: space.md },
  cell: { flex: 1 },
});

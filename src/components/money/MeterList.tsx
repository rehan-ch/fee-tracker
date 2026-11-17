/**
 * Meter list (docs/DESIGN.md 8.1, 8.3): one row per named group (e.g. area)
 * with the name, "collected / billed" in tabular figures and an aligned meter
 * (chart.accent on chart.accentTrack) that fills from the reading start, plus
 * the pending amount in the unpaid tone with its word.
 */
import { StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { space } from '../../theme';
import { Meter, percentOf } from '../ds/Meter';
import { bidiIsolate, Divider, Row, Txt } from '../ui';

export interface MeterRow {
  key: string;
  name: string;
  /** Second line under the name, e.g. "12 customers". */
  sub?: string;
  value: number;
  max: number;
  pending: number;
}

export function MeterList({ rows }: { rows: MeterRow[] }) {
  const { t, money, isRTL } = useApp();
  const sep = isRTL ? '، ' : ', ';
  return (
    <View>
      {rows.map((r, i) => {
        const collectedOf = t('moneyCollectedOf', {
          collected: bidiIsolate(money(r.value)),
          billed: bidiIsolate(money(r.max)),
        });
        const pendingText = r.pending > 0 ? t('moneyPendingAmount', { amount: bidiIsolate(money(r.pending)) }) : null;
        const label = [r.name, r.sub, collectedOf, `${percentOf(r.value, r.max)}%`, pendingText]
          .filter(Boolean)
          .join(sep);
        return (
          <View key={r.key}>
            {i > 0 ? <Divider /> : null}
            <View
              accessible
              accessibilityLabel={label}
              style={[styles.row, i === 0 ? styles.first : null, i === rows.length - 1 ? styles.last : null]}
            >
              <Row gap={space.md} align="flex-start">
                <View style={styles.flex}>
                  <Txt weight={600}>{r.name}</Txt>
                  {r.sub ? <Txt variant="small">{r.sub}</Txt> : null}
                </View>
                <Txt variant="small" tone="secondary" ltr align="end" style={styles.figures}>
                  {`${money(r.value)} / ${money(r.max)}`}
                </Txt>
              </Row>
              <Meter value={r.value} max={r.max} label={r.name} />
              {pendingText ? (
                <Txt variant="small" tone="unpaid">
                  {pendingText}
                </Txt>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { gap: space.xs, paddingVertical: space.md },
  first: { paddingTop: 0 },
  last: { paddingBottom: 0 },
  figures: { fontVariant: ['tabular-nums'], flexShrink: 1 },
});

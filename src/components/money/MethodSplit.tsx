/**
 * "By method" part-to-whole (docs/DESIGN.md 8.1, 8.2): a thin SegmentedBar
 * (8dp, 2dp surface gaps, rounded ends) in PAYMENT_METHODS order with the
 * fixed theme.chart.method colours, which follow the method and are never
 * reassigned by rank, plus one row per method: 10dp swatch, name, count,
 * amount and share. The rows double as the legend.
 */
import { StyleSheet, View } from 'react-native';

import { PAYMENT_METHODS, type PaymentMethod } from '../../db/types';
import { useApp } from '../../state/app';
import { chart, radius, space } from '../../theme';
import { SegmentedBar } from '../ds/SegmentedBar';
import { METHOD_LABEL } from '../RecordPaymentSheet';
import { Amount, bidiIsolate, Row, Txt } from '../ui';

export interface MethodTotal {
  method: PaymentMethod;
  total: number;
  count: number;
}

/** Whole-percent share of the total (rounded like the earlier report screen). */
function shareOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function MethodSplit({ rows }: { rows: MethodTotal[] }) {
  const { t, money, isRTL } = useApp();
  const byMethod = new Map(rows.map((r) => [r.method, r]));
  // Fixed entity order, whatever the query's sort (it sorts by amount).
  const present = PAYMENT_METHODS.map((m) => byMethod.get(m)).filter(
    (r): r is MethodTotal => !!r && r.count > 0,
  );
  const whole = present.reduce((s, r) => s + r.total, 0);
  const countText = (n: number) => (n === 1 ? t('moneyPaymentsOne') : t('moneyPaymentsCount', { count: n }));
  const sep = isRTL ? '، ' : ', ';
  const summary = t('moneyMethodSummary', {
    list: present
      .map((r) => `${t(METHOD_LABEL[r.method])} ${bidiIsolate(`${money(r.total)}, ${shareOf(r.total, whole)}%`)}`)
      .join(sep),
  });

  return (
    <View style={styles.wrap}>
      <SegmentedBar
        size="thin"
        accessibilityLabel={summary}
        segments={present.map((r) => ({
          key: r.method,
          value: r.total,
          color: chart.method[r.method],
          label: t(METHOD_LABEL[r.method]),
        }))}
      />
      <View>
        {present.map((r) => {
          const name = t(METHOD_LABEL[r.method]);
          const pct = shareOf(r.total, whole);
          return (
            <View
              key={r.method}
              accessible
              accessibilityLabel={[name, countText(r.count), money(r.total), `${pct}%`].join(sep)}
              style={styles.row}
            >
              <Row gap={space.sm}>
                <View style={[styles.swatch, { backgroundColor: chart.method[r.method] }]} />
                <View style={styles.flex}>
                  <Txt weight={600}>{name}</Txt>
                </View>
                <Amount value={r.total} weight={600} tabular align="end" />
              </Row>
              <Row gap={space.sm} style={styles.subRow}>
                <View style={styles.swatchSpace} />
                <View style={styles.flex}>
                  <Txt variant="small">{countText(r.count)}</Txt>
                </View>
                <Txt variant="small" ltr align="end" style={styles.tabular}>
                  {`${pct}%`}
                </Txt>
              </Row>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const SWATCH = 10;

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  flex: { flex: 1 },
  row: { paddingVertical: space.xs + space.xxs },
  subRow: { marginTop: -space.xxs },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: radius.xs },
  swatchSpace: { width: SWATCH },
  tabular: { fontVariant: ['tabular-nums'] },
});

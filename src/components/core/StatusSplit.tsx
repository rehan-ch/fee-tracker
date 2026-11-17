/**
 * Paid / partial / unpaid customer split (docs/DESIGN.md 8.1): a thin
 * segmented bar above a 3-row legend with the status icon, word and count, so
 * colour is never the only signal. Segments and legend follow reading order.
 */
import { StyleSheet, View } from 'react-native';

import type { DueStatus } from '../../lib/dues';
import { formatAmount } from '../../lib/money';
import { useApp } from '../../state/app';
import { size, space, statusColors } from '../../theme';
import { SegmentedBar } from '../ds/SegmentedBar';
import { Icon, Row, Txt } from '../ui';

const ORDER: DueStatus[] = ['paid', 'partial', 'unpaid'];

export function StatusSplit({ counts }: { counts: Record<DueStatus, number> }) {
  const { t } = useApp();
  return (
    <View style={styles.wrap}>
      <SegmentedBar
        size="thin"
        segments={ORDER.map((s) => ({
          key: s,
          value: counts[s],
          color: statusColors[s].fg,
          label: t(s),
        }))}
      />
      <View style={styles.legend}>
        {ORDER.map((s) => (
          <Row key={s} gap={space.xs}>
            <Icon name={statusColors[s].icon} size={size.iconSm} color={statusColors[s].fg} />
            <View style={styles.word}>
              <Txt variant="small" tone="secondary">
                {t(s)}
              </Txt>
            </View>
            <Txt variant="small" tone="text" weight={600} ltr style={styles.count}>
              {formatAmount(counts[s])}
            </Txt>
          </Row>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.xs },
  legend: { gap: space.xxs },
  word: { flex: 1 },
  count: { fontVariant: ['tabular-nums'] },
});

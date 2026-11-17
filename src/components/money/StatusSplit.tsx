/**
 * Customers by due status (docs/DESIGN.md 8.1): a thin status SegmentedBar
 * above a legend row per status with its icon, word and count, so the split
 * never relies on colour alone.
 */
import { StyleSheet, View } from 'react-native';

import type { DueStatus } from '../../lib/dues';
import { formatAmount } from '../../lib/money';
import { useApp } from '../../state/app';
import { space, statusColors } from '../../theme';
import { SegmentedBar } from '../ds/SegmentedBar';
import { Icon, Row, Txt } from '../ui';

/** Fixed order (good to bad), so a status keeps its place whatever the counts. */
const ORDER: DueStatus[] = ['paid', 'partial', 'unpaid'];

export function StatusSplit({ counts }: { counts: Record<DueStatus, number> }) {
  const { t, isRTL } = useApp();
  const sep = isRTL ? '، ' : ', ';
  const summary = ORDER.map((s) => `${t(s)}: ${counts[s]}`).join(sep);
  return (
    <View style={styles.wrap}>
      <SegmentedBar
        size="thin"
        accessibilityLabel={summary}
        segments={ORDER.map((s) => ({ key: s, value: counts[s], color: statusColors[s].fg, label: t(s) }))}
      />
      <View>
        {ORDER.map((s) => (
          <View key={s} accessible accessibilityLabel={`${t(s)}: ${counts[s]}`} style={styles.legendRow}>
            <Row gap={space.sm}>
              <Icon name={statusColors[s].icon} size={18} color={statusColors[s].fg} />
              <View style={styles.flex}>
                <Txt>{t(s)}</Txt>
              </View>
              <Txt ltr weight={600} style={styles.tabular}>
                {formatAmount(counts[s])}
              </Txt>
            </Row>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  flex: { flex: 1 },
  legendRow: { paddingVertical: space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
});

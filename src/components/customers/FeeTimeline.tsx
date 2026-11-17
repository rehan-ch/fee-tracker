/**
 * Fee history as a timeline (docs/DESIGN.md 13.6.6 and 13.8): a dot and line
 * on the reading-start side, "From March 2026", then "Rs 1,500 → Rs 2,000"
 * (the arrow points left in Urdu, where the old fee is on the right), the note
 * in small text and a "Scheduled" badge for future changes. `trailing` adds an
 * action per entry, such as the undo button on the fee screen.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FeeChange } from '../../db/types';
import { currentMonthKey } from '../../lib/date';
import { useApp } from '../../state/app';
import { colors, radius, space } from '../../theme';
import { Amount, Badge, Icon, Row, Txt } from '../ui';
import { useA11yJoin } from './text';

export function FeeTimeline({
  changes,
  trailing,
}: {
  /** Newest first, as feeHistory() returns them. */
  changes: FeeChange[];
  trailing?: (change: FeeChange) => ReactNode;
}) {
  const { t, money, monthLabel, rowDir } = useApp();
  const join = useA11yJoin();
  const current = currentMonthKey();
  return (
    <View>
      {changes.map((c, i) => {
        const last = i === changes.length - 1;
        const scheduled = c.effective_month > current;
        const month = monthLabel(c.effective_month);
        return (
          <View key={c.id} style={[styles.item, { flexDirection: rowDir }]}>
            <View style={styles.rail}>
              <View style={[styles.dot, i === 0 ? styles.dotLatest : styles.dotOlder]} />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View
              accessible
              accessibilityLabel={join([
                t('customersFeeChangeA11y', { month, from: money(c.old_fee), to: money(c.new_fee) }),
                scheduled && t('customersScheduled'),
                c.note,
              ])}
              style={[styles.body, !last ? styles.bodySpaced : null]}
            >
              <Row gap={space.sm} wrap>
                <Txt variant="label">{t('customersFeeFrom', { month })}</Txt>
                {scheduled ? <Badge label={t('customersScheduled')} tone="info" icon="time-outline" /> : null}
              </Row>
              <Row gap={space.sm} wrap>
                <Amount value={c.old_fee} tone="secondary" tabular />
                <Icon name="arrow-forward" size={18} color={colors.textSecondary} flipForRTL />
                <Amount value={c.new_fee} weight={600} tabular />
              </Row>
              {c.note ? <Txt variant="small">{c.note}</Txt> : null}
            </View>
            {trailing ? trailing(c) : null}
          </View>
        );
      })}
    </View>
  );
}

const DOT = 12;

const styles = StyleSheet.create({
  item: { alignItems: 'stretch', gap: space.md },
  rail: { width: DOT + 4, alignItems: 'center', paddingTop: space.xs },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill },
  dotLatest: { backgroundColor: colors.primary },
  dotOlder: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.outline },
  line: { flex: 1, width: 2, marginTop: space.xs, backgroundColor: colors.outlineVariant },
  body: { flex: 1, gap: space.xxs },
  bodySpaced: { paddingBottom: space.lg },
});

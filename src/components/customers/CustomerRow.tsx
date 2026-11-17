/**
 * One row of the Customers list (docs/DESIGN.md 13.5): Avatar, name, area and
 * phone, monthly fee, and at the end what is owed ("Due", unpaid colour) or
 * held as advance ("Advance", paid colour). Status is always colour + icon +
 * word. The whole row is one button with one combined TalkBack label.
 */
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { CustomerListRow } from '../../db/types';
import { useApp } from '../../state/app';
import { advanceColors, colors, radius, shadow, size, space, statusColors } from '../../theme';
import { Amount, Avatar, Badge, Icon, Row, shadowFallback, Txt } from '../ui';
import { useA11yJoin, useLtr } from './text';

function CustomerRowView({ c }: { c: CustomerListRow }) {
  const { t, money, rowDir, isRTL } = useApp();
  const ltr = useLtr();
  const join = useA11yJoin();

  // balance = latest month's total_due - paid_amount: positive is owed, negative is advance.
  const balance = c.balance ?? 0;
  const due = balance > 0 ? balance : 0;
  const credit = balance < 0 ? -balance : 0;
  const inactive = c.status === 'inactive';
  const sub = [c.area_name, c.phone ? ltr(c.phone) : null].filter(Boolean).join(' · ');
  const fee = t('perMonth', { amount: ltr(money(c.current_fee)) });

  const label = join([
    c.name,
    inactive && t('inactive'),
    c.area_name,
    c.phone,
    fee,
    due > 0 && t('customersDueA11y', { amount: money(due) }),
    credit > 0 && t('customersAdvanceA11y', { amount: money(credit) }),
  ]);

  return (
    <View style={styles.card}>
      <View style={styles.clip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => router.push(`/customer/${c.id}`)}
          android_ripple={{ color: colors.rippleNeutral }}
          style={[styles.row, { flexDirection: rowDir }]}
        >
          <Avatar name={c.name} />
          <View style={styles.middle}>
            <Row gap={space.sm}>
              <View style={styles.shrink}>
                <Txt variant="h2" numberOfLines={1}>
                  {c.name}
                </Txt>
              </View>
              {inactive ? <Badge label={t('inactive')} tone="inactive" /> : null}
            </Row>
            {sub ? (
              <Txt variant="small" numberOfLines={1}>
                {sub}
              </Txt>
            ) : null}
            <Txt variant="small" numberOfLines={1}>
              {fee}
            </Txt>
          </View>
          {due > 0 || credit > 0 ? (
            <View style={[styles.end, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
              <Amount
                value={due > 0 ? due : credit}
                tone={due > 0 ? 'unpaid' : 'paid'}
                weight={600}
                align="end"
                tabular
                numberOfLines={1}
              />
              <Row gap={space.xs}>
                <Icon
                  name={due > 0 ? statusColors.unpaid.icon : advanceColors.icon}
                  size={14}
                  color={due > 0 ? statusColors.unpaid.fg : advanceColors.fg}
                />
                <Txt variant="small" tone={due > 0 ? 'unpaid' : 'paid'} weight={600}>
                  {due > 0 ? t('due') : t('advance')}
                </Txt>
              </Row>
            </View>
          ) : null}
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} flipForRTL />
        </Pressable>
      </View>
    </View>
  );
}

/** Memoised: rows only re-render when their customer row (or the language) changes. */
export const CustomerRow = memo(CustomerRowView);

const styles = StyleSheet.create({
  // Shadow on the outer box; the inner clip keeps the ripple inside the corners.
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    ...shadow.level1,
    ...shadowFallback,
  },
  clip: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    gap: space.md,
    minHeight: 72,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  middle: { flex: 1, gap: space.xxs },
  shrink: { flexShrink: 1 },
  end: { gap: space.xxs, minWidth: size.touch },
});

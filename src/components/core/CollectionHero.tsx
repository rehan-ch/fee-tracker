/**
 * Home's hero card (docs/DESIGN.md 13.1, 8.1): "Collected · {month}", the
 * collected amount as the screen's one hero figure, "of {expected} expected",
 * a meter on the white-on-teal hero track with the percent, and the
 * carried-forward note. Text, Amount and Meter turn white inside Card hero.
 */
import { StyleSheet } from 'react-native';

import type { MonthKey } from '../../lib/date';
import { useApp } from '../../state/app';
import { space } from '../../theme';
import { Meter } from '../ds/Meter';
import { Amount, bidiIsolate, Card, Txt } from '../ui';

export function CollectionHero({
  month,
  collected,
  expected,
  carried,
}: {
  month: MonthKey;
  collected: number;
  expected: number;
  /** Unpaid balance carried in from earlier months (0 when none). */
  carried: number;
}) {
  const { t, money, monthLabel, isRTL } = useApp();
  // Keep "Rs 2,000" left-to-right inside an Urdu sentence.
  const iso = (s: string) => (isRTL ? bidiIsolate(s) : s);
  return (
    <Card variant="hero">
      <Txt variant="label">{t('coreCollectedIn', { month: monthLabel(month) })}</Txt>
      <Amount value={collected} variant="hero" />
      <Txt variant="muted">{t('coreOfExpected', { amount: iso(money(expected)) })}</Txt>
      <Meter value={collected} max={expected} label={t('collected')} style={styles.meter} />
      {carried > 0 ? (
        <Txt variant="small">{t('includesPrevious', { amount: iso(money(carried)) })}</Txt>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  meter: { marginTop: space.xs },
});

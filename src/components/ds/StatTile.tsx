/**
 * Stat tile (docs/DESIGN.md 8.5): sentence-case label, a 22/700 figure in
 * Inter (money by default, or a plain count), optional sub line and status
 * icon, in an elevated card. With `onPress` the tile is one button.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DueStatus } from '../../lib/dues';
import { formatAmount } from '../../lib/money';
import { useApp } from '../../state/app';
import { colors, space, statusColors } from '../../theme';
import { Amount, Card, Icon, joinA11y, Row, Txt, type IconName, type TextTone } from '../ui';

/** One headline number. Place two or more in a KpiRow. */
export function StatTile({
  label,
  value,
  format = 'money',
  tone,
  sub,
  status,
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
}: {
  label: string;
  value: number;
  /** 'money' renders useApp().money(value); 'count' renders the number with digit grouping. */
  format?: 'money' | 'count';
  tone?: TextTone;
  sub?: string;
  /** Shows the status icon in its colour (e.g. unpaid for "Pending"). */
  status?: DueStatus;
  /** Any other end icon (ignored when `status` is set). */
  icon?: IconName;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** What tapping the tile does (read after the label), e.g. "Opens the collection list". */
  accessibilityHint?: string;
  /** Extra content under the figure, e.g. a thin SegmentedBar. */
  children?: ReactNode;
}) {
  const { money, isRTL } = useApp();
  const valueText = format === 'money' ? money(value) : formatAmount(value);
  const endIcon = status ? (
    <Icon name={statusColors[status].icon} size={20} color={statusColors[status].fg} />
  ) : icon ? (
    <Icon name={icon} size={20} color={colors.textSecondary} />
  ) : null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={
        onPress ? (accessibilityLabel ?? joinA11y([label, valueText, sub], isRTL)) : undefined
      }
      accessibilityHint={onPress ? accessibilityHint : undefined}
      style={styles.tile}
    >
      <Row gap={space.sm} align="flex-start">
        <View style={styles.flex}>
          <Txt variant="label">{label}</Txt>
        </View>
        {endIcon}
      </Row>
      {format === 'money' ? (
        <Amount value={value} variant="title" tone={tone} />
      ) : (
        <Txt variant="title" ltr tone={tone} style={styles.figure}>
          {valueText}
        </Txt>
      )}
      {sub ? <Txt variant="small">{sub}</Txt> : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: { minHeight: 88, flexGrow: 1, gap: space.xs },
  figure: { fontVariant: ['proportional-nums'] },
});

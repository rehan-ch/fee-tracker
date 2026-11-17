/**
 * List rows for the settings screens (staff, people on a shared phone,
 * businesses). Each pressable row reads as one sentence in TalkBack, has a
 * 72dp minimum height, ripple feedback, and mirrors in Urdu.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, size, space } from '../../theme';
import { Amount, Avatar, Badge, Icon, IconButton, type IconName, joinA11y, Row, Txt } from '../ui';

function RowPressable({
  label,
  hint,
  selected,
  onPress,
  children,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { rowDir } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      android_ripple={{ color: colors.rippleNeutral }}
      style={[styles.row, { flexDirection: rowDir }]}
    >
      {children}
    </Pressable>
  );
}

/** Small icon + word, e.g. a lock with "PIN". */
function IconWord({ icon, word }: { icon: IconName; word: string }) {
  return (
    <Row gap={space.xs}>
      <Icon name={icon} size={14} color={colors.textSecondary} />
      <Txt variant="small">{word}</Txt>
    </Row>
  );
}

/** Staff list row: Avatar, name, role badge, PIN lock, cloud status, and this month's collection. */
export function StaffRow({
  name,
  role,
  hasPin,
  cloudWord,
  collectedLabel,
  collected,
  onPress,
}: {
  name: string;
  role: string;
  hasPin: boolean;
  cloudWord: string | null;
  /** "Collected in November 2026" */
  collectedLabel: string;
  collected: number;
  onPress: () => void;
}) {
  const { t, money, isRTL } = useApp();
  const label = joinA11y(
    [name, role, hasPin && t('settingsPinSet'), cloudWord, `${collectedLabel}: ${money(collected)}`],
    isRTL,
  );
  return (
    <RowPressable label={label} onPress={onPress}>
      <Avatar name={name} />
      <View style={styles.text}>
        <Txt variant="h2" numberOfLines={2}>
          {name}
        </Txt>
        <Row gap={space.sm} wrap>
          <Badge label={role} tone="neutral" />
          {hasPin ? <IconWord icon="lock-closed" word={t('pinProtected')} /> : null}
          {cloudWord ? <IconWord icon="phone-portrait-outline" word={cloudWord} /> : null}
        </Row>
        <Row gap={space.xs} wrap>
          <Txt variant="small">{`${collectedLabel}:`}</Txt>
          <Amount value={collected} variant="small" weight={600} tone="secondary" tabular />
        </Row>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.textSecondary} flipForRTL />
    </RowPressable>
  );
}

/** A person on a shared phone (switch-user sheet): Avatar, name, role, lock, check on the current one. */
export function PersonRow({
  name,
  role,
  hasPin,
  current,
  onPress,
}: {
  name: string;
  role: string;
  hasPin: boolean;
  current: boolean;
  onPress: () => void;
}) {
  const { t, isRTL } = useApp();
  const label = joinA11y([name, role, hasPin && t('settingsPinSet'), current && t('settingsCurrentUser')], isRTL);
  return (
    <RowPressable label={label} selected={current} onPress={onPress}>
      <Avatar name={name} />
      <View style={styles.text}>
        <Txt weight={600}>{name}</Txt>
        <Row gap={space.sm} wrap>
          <Txt variant="small">{role}</Txt>
          {hasPin ? <IconWord icon="lock-closed" word={t('pinProtected')} /> : null}
        </Row>
      </View>
      {current ? <Icon name="checkmark-circle" size={24} color={colors.primary} /> : null}
    </RowPressable>
  );
}

/** Business row: Avatar, name, phone, a "Current" badge and an optional labelled delete button. */
export function BusinessRow({
  name,
  phone,
  current,
  onPress,
  onDelete,
}: {
  name: string;
  phone: string | null;
  current: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const { t, rowDir, isRTL } = useApp();
  const status = current ? t('settingsCurrent') : t('tapToSwitch');
  return (
    // The delete button sits outside the row's pressable so TalkBack can reach both.
    <View style={[styles.split, { flexDirection: rowDir }]}>
      <View style={styles.flex}>
        <RowPressable label={joinA11y([name, phone, status], isRTL)} selected={current} onPress={onPress}>
          <Avatar name={name} />
          <View style={styles.text}>
            <Txt variant="h2" numberOfLines={2}>
              {name}
            </Txt>
            {phone ? (
              <Txt variant="small" ltr>
                {phone}
              </Txt>
            ) : null}
            {current ? (
              <Row>
                <Badge label={t('settingsCurrent')} tone="success" icon="checkmark-circle" />
              </Row>
            ) : (
              <Txt variant="small">{t('tapToSwitch')}</Txt>
            )}
          </View>
        </RowPressable>
      </View>
      {onDelete ? (
        <View style={styles.trailing}>
          <IconButton
            name="trash-outline"
            label={t('settingsDeleteBusinessNamed', { name })}
            color={colors.danger}
            onPress={onDelete}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    alignItems: 'center',
    gap: space.lg,
    minHeight: 72,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  text: { flex: 1, gap: space.xs },
  split: { alignItems: 'center' },
  trailing: { minWidth: size.touch, paddingHorizontal: space.xs },
});

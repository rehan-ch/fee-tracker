/**
 * Screen 10: Reminders - select unpaid customers, preview the WhatsApp
 * message, and send them one by one (each opens WhatsApp with the message
 * typed in; the owner taps Send there).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomActionBar } from '../components/ds/BottomActionBar';
import { Meter } from '../components/ds/Meter';
import { MessageBubble } from '../components/money/MessageBubble';
import { MonthPicker } from '../components/pickers';
import {
  Amount,
  Avatar,
  bidiIsolate,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  joinA11y,
  Row,
  Screen,
  shadowFallback,
  Txt,
} from '../components/ui';
import { useReminders } from '../components/useReminders';
import { listDuesForMonth } from '../db/repo';
import type { DueListRow, ReminderChannel } from '../db/types';
import { useQuery } from '../db/useQuery';
import { currentMonthKey, isMonthKey, toDayKey, type MonthKey } from '../lib/date';
import { remainingOf } from '../lib/dues';
import { useApp } from '../state/app';
import { colors, radius, shadow, space } from '../theme';

export default function RemindersScreen() {
  const { t, business, can, rowDir } = useApp();
  const { fontScale } = useWindowDimensions();
  const { messageFor, send } = useReminders();
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState<MonthKey>(isMonthKey(params.month) ? params.month : currentMonthKey());
  const bid = business?.id ?? '';
  const { data: all } = useQuery((d) => listDuesForMonth(d, bid, month), [bid, month]);

  const candidates = useMemo(() => (all ?? []).filter((r) => r.status !== 'paid' && remainingOf(r) > 0), [all]);
  // Deselected rows (everyone with a phone starts selected).
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<DueListRow[] | null>(null);
  const [position, setPosition] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  // True while a chat is being opened, so a double tap can't send twice.
  const [sending, setSending] = useState(false);

  const selected = candidates.filter((r) => r.customer_phone && !skipped.has(r.id));
  const selectable = candidates.filter((r) => r.customer_phone).length;
  const toggle = useCallback(
    (id: string) =>
      setSkipped((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const stackButtons = fontScale > 1.3;

  if (!can('reminders.send')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;

  // --- Sending one by one
  if (queue) {
    const current = queue[position];
    const next = async (channel: ReminderChannel | null) => {
      if (sending) return;
      setSending(true);
      try {
        if (channel && current && (await send(current, channel))) setSentCount((n) => n + 1);
        setPosition((p) => p + 1);
      } catch {
        // Fixed message only: errors may include customer details.
        if (__DEV__) console.warn('Reminder failed');
        Alert.alert(t('somethingWrong'));
      } finally {
        setSending(false);
      }
    };

    if (!current) {
      return (
        <Screen>
          <EmptyState
            icon="checkmark-done-circle-outline"
            tone="success"
            title={t('remindersDone', { count: sentCount })}
            body={t('moneyRemindersDoneBody')}
            action={<Button title={t('done')} size="lg" onPress={() => router.back()} />}
          />
        </Screen>
      );
    }

    return (
      <View style={styles.screen}>
        <Screen>
          <View style={styles.progress}>
            <Txt variant="label">{t('sendingProgress', { n: position + 1, total: queue.length })}</Txt>
            <Meter value={position} max={queue.length} label={t('moneySendProgress')} showPercent={false} />
          </View>
          <Card>
            <Row gap={space.md}>
              <Avatar name={current.customer_name} />
              <View style={styles.flex}>
                <Txt variant="h2">{current.customer_name}</Txt>
                {current.customer_phone ? (
                  <Txt variant="small" ltr>
                    {current.customer_phone}
                  </Txt>
                ) : null}
              </View>
              <Amount value={remainingOf(current)} variant="h2" tone={current.status} />
            </Row>
            <MessageBubble text={messageFor(current)} />
          </Card>
          <Txt variant="small" center>
            {t('sendHint')}
          </Txt>
        </Screen>
        <BottomActionBar>
          <Button
            title={t('openWhatsApp')}
            icon="logo-whatsapp"
            size="lg"
            onPress={() => next('whatsapp')}
            disabled={sending}
          />
          <View style={[styles.pair, { flexDirection: stackButtons ? 'column' : rowDir }]}>
            <Button
              title={t('sendSms')}
              icon="chatbubble-outline"
              variant="tonal"
              style={stackButtons ? null : styles.flex}
              onPress={() => next('sms')}
              disabled={sending}
            />
            <Button
              title={t('skip')}
              variant="text"
              style={stackButtons ? null : styles.flex}
              onPress={() => next(null)}
              disabled={sending}
            />
          </View>
        </BottomActionBar>
      </View>
    );
  }

  // --- Choosing who to remind
  return (
    <View style={styles.screen}>
      <FlatList
        data={candidates}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <MonthPicker value={month} onChange={setMonth} />
            {candidates.length > 0 ? (
              <>
                <Card>
                  <Row gap={space.sm} justify="space-between">
                    <View style={styles.flex}>
                      <Txt variant="label" header>
                        {t('messagePreview')}
                      </Txt>
                    </View>
                    {can('settings.business') ? (
                      <Chip
                        variant="assist"
                        icon="create-outline"
                        label={t('editMessage')}
                        onPress={() => router.push('/messages')}
                      />
                    ) : null}
                  </Row>
                  <MessageBubble text={messageFor(selected[0] ?? candidates[0])} />
                </Card>
                <Row gap={space.xs} justify="space-between" wrap>
                  <View style={styles.selectedLabel}>
                    <Txt variant="label">{t('selectedCount', { n: selected.length, total: candidates.length })}</Txt>
                  </View>
                  <Row gap={0}>
                    <Button
                      title={t('moneySelectAll')}
                      variant="text"
                      compact
                      disabled={selected.length === selectable}
                      onPress={() => setSkipped(new Set())}
                    />
                    <Button
                      title={t('moneySelectNone')}
                      variant="text"
                      compact
                      disabled={selected.length === 0}
                      onPress={() => setSkipped(new Set(candidates.map((c) => c.id)))}
                    />
                  </Row>
                </Row>
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ReminderRow item={item} checked={!!item.customer_phone && !skipped.has(item.id)} onToggle={toggle} />
        )}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          all ? (
            <EmptyState icon="checkmark-done-circle-outline" tone="success" title={t('noUnpaid')} />
          ) : (
            <ActivityIndicator
              color={colors.primary}
              size="large"
              accessibilityLabel={t('moneyLoading')}
              style={styles.loading}
            />
          )
        }
      />
      {candidates.length > 0 ? (
        <BottomActionBar>
          <Button
            title={t('moneyStartSending', { count: selected.length })}
            accessibilityLabel={t('startSending', { count: selected.length })}
            icon="send"
            iconFlipForRTL
            size="lg"
            disabled={selected.length === 0}
            onPress={() => {
              setQueue(selected);
              setPosition(0);
              setSentCount(0);
            }}
          />
        </BottomActionBar>
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

/** One selectable customer: checkbox, name, phone · reminded on, amount due. */
const ReminderRow = memo(function ReminderRow({
  item,
  checked,
  onToggle,
}: {
  item: DueListRow;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  const { t, money, dateLabel, rowDir, isRTL } = useApp();
  const hasPhone = !!item.customer_phone;
  const due = remainingOf(item);
  // Same guard as the Collection row: skip a stored time that doesn't parse.
  const remindedAt = item.last_reminded_at ? new Date(item.last_reminded_at) : null;
  const reminded =
    remindedAt && !Number.isNaN(remindedAt.getTime())
      ? t('remindedOn', { date: dateLabel(toDayKey(remindedAt)) })
      : null;
  // Keep the phone number left-to-right inside the Urdu line.
  const phone = item.customer_phone;
  const phoneText = phone ? (isRTL ? bidiIsolate(phone) : phone) : t('noPhone');
  const label = joinA11y([item.customer_name, phoneText, reminded, t('moneyDueAmount', { amount: money(due) })], isRTL);
  return (
    <View style={[styles.rowCard, shadowFallback, hasPhone ? null : styles.disabled]}>
      <View style={styles.rowClip}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked, disabled: !hasPhone }}
          disabled={!hasPhone}
          onPress={() => onToggle(item.id)}
          android_ripple={{ color: colors.rippleNeutral }}
          style={[styles.row, { flexDirection: rowDir }]}
        >
          <Icon
            name={checked ? 'checkbox' : 'square-outline'}
            size={24}
            color={checked ? colors.primary : colors.outline}
          />
          <View style={styles.flex}>
            <Txt weight={600} numberOfLines={1}>
              {item.customer_name}
            </Txt>
            <Txt variant="small" numberOfLines={2}>
              {[phoneText, reminded].filter(Boolean).join(' · ')}
            </Txt>
          </View>
          <Amount value={due} tone={item.status} weight={600} tabular align="end" />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: space.lg, paddingBottom: space.xl, flexGrow: 1 },
  header: { gap: space.md, marginBottom: space.md },
  selectedLabel: { flexGrow: 1, flexShrink: 1 },
  separator: { height: space.sm },
  loading: { marginTop: space.xxl },
  progress: { gap: space.sm },
  pair: { gap: space.sm },
  rowCard: { backgroundColor: colors.card, borderRadius: radius.md, ...shadow.level1 },
  rowClip: { borderRadius: radius.md, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 72,
  },
  disabled: { opacity: 0.5 },
});

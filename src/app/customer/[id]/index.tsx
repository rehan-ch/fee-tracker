/** Screen 7: Customer detail - profile, balance, month grid, fee history, payments (docs/DESIGN.md 13.6). */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Fragment, useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking, StyleSheet, useWindowDimensions, View } from 'react-native';

import { FeeTimeline } from '../../../components/customers/FeeTimeline';
import { telUrl, smsChatUrl, whatsappChatUrl } from '../../../components/customers/links';
import { MonthGrid } from '../../../components/customers/MonthGrid';
import { PaymentItem } from '../../../components/customers/PaymentItem';
import { QuickAction } from '../../../components/customers/QuickAction';
import { useLtr } from '../../../components/customers/text';
import { RecordPaymentSheet, type SheetDue } from '../../../components/RecordPaymentSheet';
import { useReminders } from '../../../components/useReminders';
import {
  Amount,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  type IconName,
  Row,
  Screen,
  SectionHeader,
  Txt,
} from '../../../components/ui';
import {
  customerDues,
  customerPayments,
  deletePayment,
  feeHistory,
  getCustomer,
  type PaymentRow,
} from '../../../db/repo';
import type { MonthlyDue } from '../../../db/types';
import { useQuery } from '../../../db/useQuery';
import type { StringKey } from '../../../i18n/strings';
import { currentMonthKey, monthOfDay } from '../../../lib/date';
import { creditOf, remainingOf } from '../../../lib/dues';
import { useApp } from '../../../state/app';
import { advanceColors, colors, space, statusColors } from '../../../theme';

export default function CustomerDetailScreen() {
  const db = useSQLiteContext();
  const { t, money, monthLabel, dateLabel, can, isRTL, business } = useApp();
  const { send } = useReminders();
  const ltr = useLtr();
  const { fontScale } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: customer, loading } = useQuery((d) => getCustomer(d, id), [id]);
  const { data: dues } = useQuery((d) => customerDues(d, id), [id]);
  const { data: payments } = useQuery((d) => customerPayments(d, id), [id]);
  const { data: fees } = useQuery((d) => feeHistory(d, id), [id]);
  const [sheetDue, setSheetDue] = useState<SheetDue | null>(null);

  const canAddPayment = can('payments.add');
  const canDeletePayment = can('payments.delete');
  const customerName = customer?.name;
  const openSheet = useCallback(
    (d: MonthlyDue) => {
      if (canAddPayment && customerName !== undefined) setSheetDue({ ...d, customer_name: customerName });
    },
    [canAddPayment, customerName],
  );
  const confirmDeletePayment = useCallback(
    (p: PaymentRow) => {
      if (!canDeletePayment) return;
      Alert.alert(t('deletePayment'), t('deletePaymentConfirm', { amount: ltr(money(p.amount)) }), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          // Re-checked here: the role can change while the dialog is open.
          onPress: () => {
            if (can('payments.delete')) deletePayment(db, p.id);
          },
        },
      ]);
    },
    [can, canDeletePayment, db, ltr, money, t],
  );

  if (loading && !customer) return null;
  // Only customers of the open business (a deep link could name any id).
  if (!customer || customer.business_id !== business?.id) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon="alert-circle-outline" tone="neutral" title={t('customerNotFound')} />
      </>
    );
  }

  const latest = dues?.[0];
  const balance = latest ? remainingOf(latest) : 0;
  const credit = latest ? creditOf(latest) : 0;
  // The next fee change still to come (fee history is newest first).
  const scheduled = fees?.filter((f) => f.effective_month > currentMonthKey()).at(-1);
  const canEdit = can('customers.edit');
  const canRemind = can('reminders.send');

  // Contact links are built only from a phone number that passes isValidPhone (see links.ts).
  const tel = telUrl(customer.phone);
  const waChat = canRemind ? whatsappChatUrl(customer.phone) : null;
  const smsChat = canRemind ? smsChatUrl(customer.phone) : null;
  const openLink = async (url: string, failKey: StringKey) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t(failKey));
    }
  };

  const remind = (channel: 'whatsapp' | 'sms') => {
    if (!latest || !canRemind) return;
    send(
      { ...latest, customer_id: customer.id, customer_name: customer.name, customer_phone: customer.phone },
      channel,
    );
  };
  const stackButtons = fontScale > 1.3;

  return (
    <>
      <Stack.Screen options={{ title: customer.name }} />
      <Screen>
        {/* Profile and quick actions */}
        <Card>
          <Row gap={space.lg}>
            <Avatar name={customer.name} size={56} />
            <View style={styles.flex}>
              <Txt variant="title" header>
                {customer.name}
              </Txt>
              {customer.phone ? (
                <Txt variant="muted" ltr accessibilityLabel={`${t('phone')}, ${customer.phone}`} selectable>
                  {customer.phone}
                </Txt>
              ) : null}
              {customer.status === 'inactive' ? (
                <Badge
                  label={t('inactive')}
                  tone="inactive"
                  style={[styles.badge, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}
                />
              ) : null}
            </View>
          </Row>
          {tel || waChat || smsChat || canEdit ? (
            <>
              <Divider />
              <Row justify="space-around" gap={space.xs} align="flex-start" style={styles.quickActions}>
                {tel ? (
                  <QuickAction
                    icon="call-outline"
                    label={t('call')}
                    onPress={() => openLink(tel, 'customersCallFailed')}
                  />
                ) : null}
                {waChat ? (
                  <QuickAction
                    icon="logo-whatsapp"
                    label={t('customersQuickWhatsApp')}
                    a11yLabel={t('customersChatWhatsApp')}
                    onPress={() => openLink(waChat, 'cannotOpenApp')}
                  />
                ) : null}
                {smsChat ? (
                  <QuickAction
                    icon="chatbubble-outline"
                    label={t('sms')}
                    a11yLabel={t('customersChatSms')}
                    onPress={() => openLink(smsChat, 'customersSmsFailed')}
                  />
                ) : null}
                {canEdit ? (
                  <QuickAction
                    icon="create-outline"
                    label={t('edit')}
                    a11yLabel={t('editCustomer')}
                    onPress={() => router.push(`/customer/${customer.id}/edit`)}
                  />
                ) : null}
              </Row>
            </>
          ) : null}
        </Card>

        {/* Balance */}
        <Card style={styles.balanceCard}>
          <Txt variant="label">{t('currentBalance')}</Txt>
          {balance > 0 ? (
            <View>
              <Amount value={balance} variant="hero" tone="unpaid" />
              <StatusWord icon={statusColors.unpaid.icon} color={statusColors.unpaid.fg} tone="unpaid" text={t('due')} />
            </View>
          ) : credit > 0 ? (
            <View>
              <Amount value={credit} variant="hero" tone="paid" />
              <StatusWord icon={advanceColors.icon} color={advanceColors.fg} tone="paid" text={t('advance')} />
            </View>
          ) : (
            <View style={styles.settled}>
              <Row gap={space.sm}>
                <Icon name={statusColors.paid.icon} size={28} color={statusColors.paid.fg} />
                <Txt variant="title" tone="paid">
                  {t('customersSettled')}
                </Txt>
              </Row>
              <Txt variant="small">{t('noBalance')}</Txt>
            </View>
          )}
          {latest && balance > 0 && (canAddPayment || (customer.phone && canRemind)) ? (
            <View style={styles.actions}>
              {canAddPayment ? (
                <Button
                  title={t('recordPayment')}
                  icon="cash-outline"
                  size="lg"
                  onPress={() => openSheet(latest)}
                />
              ) : null}
              {customer.phone && canRemind ? (
                <ButtonPair stacked={stackButtons}>
                  <Button
                    title={t('remindWhatsApp')}
                    icon="logo-whatsapp"
                    variant="tonal"
                    style={stackButtons ? null : styles.flex}
                    onPress={() => remind('whatsapp')}
                  />
                  <Button
                    title={t('sms')}
                    icon="chatbubble-outline"
                    variant="tonal"
                    style={stackButtons ? null : styles.flex}
                    onPress={() => remind('sms')}
                  />
                </ButtonPair>
              ) : null}
            </View>
          ) : null}
        </Card>

        {customer.notes ? <Banner tone="warning" title={t('notes')} body={customer.notes} /> : null}

        {/* Details */}
        <Card>
          {customer.area_name ? (
            <InfoRow icon="location-outline" label={t('area')} text={customer.area_name} />
          ) : null}
          {customer.address ? (
            <InfoRow icon="home-outline" label={t('address')} text={customer.address} />
          ) : null}
          <InfoRow icon="calendar-outline" text={t('since', { date: dateLabel(customer.start_date) })} />
          <InfoRow
            icon="pricetag-outline"
            label={t('monthlyFee')}
            text={t('perMonth', { amount: ltr(money(customer.current_fee)) })}
          />
        </Card>
        {scheduled ? (
          <Banner
            tone="info"
            body={t('feeScheduled', {
              amount: ltr(money(scheduled.new_fee)),
              month: monthLabel(scheduled.effective_month),
            })}
          />
        ) : null}

        {/* Fee history */}
        <SectionHeader
          title={t('feeHistory')}
          action={
            canEdit ? { label: t('changeFee'), onPress: () => router.push(`/customer/${customer.id}/fee`) } : undefined
          }
        />
        <Card>
          {fees && fees.length > 0 ? (
            <FeeTimeline changes={fees} />
          ) : (
            <Txt variant="muted">{t('noFeeChanges', { amount: ltr(money(customer.current_fee)) })}</Txt>
          )}
        </Card>

        {/* Month grid */}
        <SectionHeader title={t('history')} />
        <Card>
          {dues && dues.length > 0 ? (
            <>
              <MonthGrid dues={dues} onPress={canAddPayment ? openSheet : undefined} />
              {canAddPayment ? <Txt variant="small">{t('tapMonthHint')}</Txt> : null}
            </>
          ) : (
            <Txt variant="muted">{t('noHistory', { month: monthLabel(monthOfDay(customer.start_date)) })}</Txt>
          )}
        </Card>

        {/* Payments */}
        <SectionHeader title={t('payments')} />
        <Card style={styles.paymentsCard}>
          {payments && payments.length > 0 ? (
            payments.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 ? <Divider inset={space.xxxl + space.xs} /> : null}
                <PaymentItem payment={p} onDelete={canDeletePayment ? confirmDeletePayment : undefined} />
              </Fragment>
            ))
          ) : (
            <Txt variant="muted" style={styles.noPayments}>
              {t('noPayments')}
            </Txt>
          )}
        </Card>
      </Screen>
      <RecordPaymentSheet due={sheetDue} onClose={() => setSheetDue(null)} />
    </>
  );
}

/** Two buttons side by side in reading order, stacked at large font scales (DESIGN 5.4). */
function ButtonPair({ stacked, children }: { stacked: boolean; children: ReactNode }) {
  if (stacked) return <View style={styles.stack}>{children}</View>;
  return (
    <Row gap={space.sm} align="stretch">
      {children}
    </Row>
  );
}

/** Status shown as icon + word under the hero amount (never colour alone). */
function StatusWord({
  icon,
  color,
  tone,
  text,
}: {
  icon: IconName;
  color: string;
  tone: 'paid' | 'unpaid';
  text: string;
}) {
  return (
    <Row gap={space.xs}>
      <Icon name={icon} size={18} color={color} />
      <Txt tone={tone} weight={600}>
        {text}
      </Txt>
    </Row>
  );
}

/** Icon + text detail line; `label` is read before the text by TalkBack. */
function InfoRow({ icon, text, label }: { icon: IconName; text: string; label?: string }) {
  return (
    <View accessible accessibilityLabel={label ? `${label}, ${text}` : text}>
      <Row gap={space.md} align="flex-start" style={styles.infoRow}>
        <View style={styles.infoIcon}>
          <Icon name={icon} size={20} color={colors.textSecondary} />
        </View>
        <View style={styles.flex}>
          <Txt>{text}</Txt>
        </View>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { marginTop: space.xs },
  quickActions: { paddingTop: space.xs },
  balanceCard: { gap: space.xs },
  settled: { gap: space.xxs, paddingVertical: space.xs },
  actions: { gap: space.sm, marginTop: space.md },
  stack: { gap: space.sm },
  infoRow: { minHeight: 32 },
  infoIcon: { paddingTop: 1 },
  paymentsCard: { gap: 0, paddingVertical: space.xs },
  noPayments: { paddingVertical: space.md },
});

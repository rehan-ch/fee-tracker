/**
 * Screen 11: Receipt preview - a payment receipt shared as an image or PDF
 * (the share sheet offers WhatsApp), or sent as text to the customer's
 * WhatsApp.
 *
 * The receipt card (docs/DESIGN.md 13.11) is exactly what the image captures;
 * the PDF (src/lib/receipt.ts) mirrors it.
 */
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ContentText } from '../../components/money/ContentText';
import { METHOD_LABEL } from '../../components/RecordPaymentSheet';
import {
  Amount,
  Badge,
  bidiIsolate,
  Button,
  EmptyState,
  Row,
  Screen,
  shadowFallback,
  Txt,
} from '../../components/ui';
import { DEFAULT_COUNTRY_CODE } from '../../config';
import { getReceipt } from '../../db/repo';
import { useQuery } from '../../db/useQuery';
import { sharePdf, slug } from '../../lib/exportReport';
import { receiptHtml, receiptNumber } from '../../lib/receipt';
import { paymentBlock, whatsappUrl } from '../../lib/template';
import { useApp } from '../../state/app';
import { colors, radius, shadow, space } from '../../theme';

/** A receipt detail: label, value, and whether the value is a number/phone kept left-to-right. */
type Detail = { label: string; value: string; ltr?: boolean };

export default function ReceiptScreen() {
  const { t, money, monthLabel, dateLabel, business, premium, staffLabel, isRTL } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: r, loading } = useQuery((d) => getReceipt(d, id), [id]);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState<'image' | 'pdf' | null>(null);

  if (loading && !r) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" accessibilityLabel={t('moneyLoading')} />
      </View>
    );
  }
  // Only receipts of the open business: the header shows its name and phone.
  if (!r || !business || r.business_id !== business.id) {
    return <EmptyState icon="alert-circle-outline" tone="neutral" title={t('receiptNotFound')} />;
  }

  const number = receiptNumber(r.id);
  const remaining = Math.max(0, r.total_due - r.paid_amount);
  const payInfo = premium.active ? paymentBlock(business.payment_info, business.payment_link, t('payOnline')) : '';
  const details: Detail[] = [
    { label: t('customerName'), value: r.customer_name },
    ...(r.customer_phone ? [{ label: t('phone'), value: r.customer_phone, ltr: true }] : []),
    { label: t('forMonth'), value: monthLabel(r.month) },
    { label: t('paidOn'), value: dateLabel(r.paid_on) },
    { label: t('method'), value: t(METHOD_LABEL[r.method]) },
    ...(premium.active && r.received_by
      ? [{ label: t('receivedBy'), value: staffLabel({ name: r.received_by_name, role: r.received_by_role }) }]
      : []),
    remaining > 0
      ? { label: t('balanceForMonth'), value: money(remaining), ltr: true }
      : { label: t('balanceForMonth'), value: t('noBalance') },
    ...(r.note ? [{ label: t('note'), value: r.note }] : []),
  ];
  const rows: [string, string][] = details.map((d) => [d.label, d.value]);
  const fileName = `receipt-${slug(r.customer_name)}-${slug(r.paid_on)}`;

  const shareImage = async () => {
    setBusy('image');
    try {
      // The ref points at a native view, which captureRef accepts (its types lag behind).
      const uri = await captureRef(cardRef as Parameters<typeof captureRef>[0], {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('shareReceipt') });
    } catch {
      // Fixed message only: errors may include customer details.
      if (__DEV__) console.warn('Receipt image share failed');
      Alert.alert(t('somethingWrong'));
    } finally {
      setBusy(null);
    }
  };

  const sharePdfReceipt = async () => {
    setBusy('pdf');
    try {
      const html = receiptHtml({
        rtl: isRTL,
        title: t('paymentReceipt'),
        business: business.name,
        businessPhone: business.phone,
        number,
        rows: details.map((d) => [d.label, d.value, !!d.ltr]),
        amountLabel: t('amountReceived'),
        amount: money(r.amount),
        footer: t('receiptFooter'),
        paymentInfo: payInfo || null,
        paidLabel: t('moneyPaidStamp'),
        paymentInfoTitle: t('paymentInfo'),
      });
      await sharePdf(html, fileName, t('shareReceipt'));
    } catch {
      if (__DEV__) console.warn('Receipt PDF share failed');
      Alert.alert(t('somethingWrong'));
    } finally {
      setBusy(null);
    }
  };

  const sendText = async () => {
    const text = [
      `*${business.name}* — ${t('paymentReceipt')} ${number}`,
      `${t('amountReceived')}: ${money(r.amount)}`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      t('receiptFooter'),
    ].join('\n');
    const url = whatsappUrl(r.customer_phone, text, DEFAULT_COUNTRY_CODE);
    // Only ever open a wa.me chat link built from the stored phone number.
    if (!url || !url.startsWith('https://wa.me/')) {
      return Alert.alert(t('noPhoneTitle'), t('noPhoneBody', { name: r.customer_name }));
    }
    Linking.openURL(url).catch(() => Alert.alert(t('cannotOpenApp')));
  };

  return (
    <Screen>
      {/* Everything inside this frame is what the image receipt captures. The
          page-coloured frame keeps the card's rounded corners and shadow
          opaque in the PNG. */}
      <View ref={cardRef} collapsable={false} style={styles.capture}>
        <View style={[styles.receipt, shadowFallback]}>
          <View style={styles.receiptClip}>
            <View style={styles.band}>
              <Txt variant="title" color={colors.onPrimary}>
                {business.name}
              </Txt>
              {business.phone ? (
                <Txt variant="small" ltr color={colors.onPrimaryMuted}>
                  {business.phone}
                </Txt>
              ) : null}
            </View>

            <View style={styles.body}>
              <Row gap={space.sm} justify="space-between">
                <View style={styles.flex}>
                  <Txt variant="label">{`${t('paymentReceipt')} · ${bidiIsolate(number)}`}</Txt>
                </View>
                <Badge label={t('moneyPaidStamp')} tone="paid" />
              </Row>

              <View style={styles.amountBlock}>
                <Txt variant="small" center>
                  {t('amountReceived')}
                </Txt>
                <Amount value={r.amount} variant="hero" tone="paid" align="center" />
              </View>

              <View>
                {details.map((d, i) => (
                  <Row
                    key={d.label}
                    justify="space-between"
                    align="flex-start"
                    gap={space.md}
                    style={[styles.line, i === details.length - 1 ? styles.lastLine : null]}
                  >
                    <Txt variant="muted" tone="muted">
                      {d.label}
                    </Txt>
                    <View style={styles.value}>
                      <Txt weight={700} align="end" ltr={d.ltr} style={d.ltr ? styles.tabular : null}>
                        {d.value}
                      </Txt>
                    </View>
                  </Row>
                ))}
              </View>

              {payInfo ? (
                <View style={styles.payInfo}>
                  <Txt variant="label">{t('paymentInfo')}</Txt>
                  <ContentText role="small" color={colors.textSecondary}>
                    {payInfo}
                  </ContentText>
                </View>
              ) : null}

              <Txt variant="small" center style={styles.footer}>
                {t('receiptFooter')}
              </Txt>
            </View>
          </View>
        </View>
      </View>

      <Button
        title={t('shareImage')}
        icon="image-outline"
        size="lg"
        onPress={shareImage}
        loading={busy === 'image'}
        disabled={!!busy}
      />
      <Button
        title={t('sharePdf')}
        icon="document-text-outline"
        variant="tonal"
        onPress={sharePdfReceipt}
        loading={busy === 'pdf'}
        disabled={!!busy}
      />
      {r.customer_phone ? (
        <Button title={t('sendTextWhatsApp')} icon="logo-whatsapp" variant="tonal" onPress={sendText} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  flex: { flex: 1 },
  // Same colour as the page, so it is invisible on screen but frames the PNG.
  capture: {
    backgroundColor: colors.bg,
    padding: space.sm,
    margin: -space.sm,
  },
  // Shadow on the outer box; the inner box clips the teal band to the corners.
  receipt: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    ...shadow.level1,
  },
  receiptClip: { borderRadius: radius.lg, overflow: 'hidden' },
  band: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: space.lg,
    gap: space.xxs,
  },
  body: { padding: 20, gap: space.md },
  amountBlock: {
    alignItems: 'stretch',
    gap: space.xxs,
    paddingVertical: space.sm,
  },
  line: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastLine: { borderBottomWidth: 0 },
  value: { flexShrink: 1, flexGrow: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  payInfo: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xxs,
  },
  footer: { marginTop: space.xs },
});

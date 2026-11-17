/** Reminder message template: edit the WhatsApp/SMS text with placeholders and a live preview. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { FormScreen } from '../components/ds/FormScreen';
import { MessageBubble } from '../components/money/MessageBubble';
import { Button, Card, Chip, ChipRow, EmptyState, Field, Row, Txt } from '../components/ui';
import { useReminders } from '../components/useReminders';
import { updateBusiness } from '../db/repo';
import { currentMonthKey } from '../lib/date';
import { DEFAULT_TEMPLATES, fillTemplate, paymentBlock, PLACEHOLDERS } from '../lib/template';
import { useApp } from '../state/app';
import { space } from '../theme';
import { showToast } from '../lib/toast';

/** Longest template the field accepts (also enforced when a placeholder chip adds text). */
const MAX_LENGTH = 700;

export default function MessagesScreen() {
  const db = useSQLiteContext();
  const { t, money, monthLabel, business, lang, premium, can } = useApp();
  const { template: current } = useReminders();
  const [text, setText] = useState(current);
  const [saving, setSaving] = useState(false);

  if (!business || !can('settings.business')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }

  // Fictional sample customer (no real data in the preview).
  const preview = fillTemplate(text, {
    name: t('moneySampleName'),
    amount: money(2000),
    month: monthLabel(currentMonthKey()),
    business: business.name,
    phone: business.phone,
    payment: premium.active ? paymentBlock(business.payment_info, business.payment_link, t('payOnline')) : '',
  });

  const insert = (p: string) =>
    setText((s) => {
      const next = `${s}${s.endsWith(' ') || !s ? '' : ' '}${p}`;
      return next.length <= MAX_LENGTH ? next : s;
    });

  const save = async (value: string | null) => {
    // Re-checked here too: hiding the screen is never the only gate.
    if (!can('settings.business') || saving) return;
    setSaving(true);
    try {
      await updateBusiness(db, business.id, { reminder_template: value });
      showToast(t('saved'));
      router.back();
    } catch {
      if (__DEV__) console.warn('Saving the reminder template failed');
      setSaving(false);
      Alert.alert(t('somethingWrong'));
    }
  };

  return (
    <FormScreen
      footer={
        <Button
          title={t('save')}
          icon="checkmark"
          size="lg"
          loading={saving}
          onPress={() => save(text.trim() || null)}
        />
      }
    >
      <Card style={styles.card}>
        <Field
          label={t('reminderMessage')}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_LENGTH}
          hint={t('moneyCharCount', { count: text.length, max: MAX_LENGTH })}
        />
        <View style={styles.placeholders}>
          <Txt variant="small">{t('placeholdersHint')}</Txt>
          <ChipRow>
            {PLACEHOLDERS.map((p) => (
              <Chip
                key={p}
                variant="assist"
                icon="add"
                label={p}
                accessibilityLabel={t('moneyInsertPlaceholder', { placeholder: p })}
                onPress={() => insert(p)}
              />
            ))}
          </ChipRow>
          {!premium.active ? <Txt variant="small">{t('paymentPlaceholderPremium')}</Txt> : null}
        </View>
        <Row justify="flex-end">
          <Button
            title={t('resetToDefault')}
            icon="refresh"
            variant="text"
            compact
            onPress={() => setText(DEFAULT_TEMPLATES[lang])}
          />
        </Row>
      </Card>
      <Card>
        <Txt variant="label" header>
          {t('messagePreview')}
        </Txt>
        <MessageBubble text={preview} />
        <Txt variant="small">{t('moneyPreviewSample')}</Txt>
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  placeholders: { gap: 6 },
});

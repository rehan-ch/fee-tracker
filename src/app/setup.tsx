/** Screen 1: Welcome / setup (first launch only). Layout per docs/DESIGN.md 13.4. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconCircle } from '../components/core/IconCircle';
import { Button, Card, Field, Icon, Row, Screen, Segmented, Txt, type IconName } from '../components/ui';
import { cloudConfigured } from '../config';
import { createBusiness } from '../db/repo';
import type { Language } from '../db/types';
import type { StringKey } from '../i18n/strings';
import { isValidPhone } from '../lib/phone';
import { useApp } from '../state/app';
import { colors, gradients, radius, shadow, size, space } from '../theme';

/** Language names are shown in their own script, whatever the current language. */
const LANGUAGES: { key: Language; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'ur', label: 'اردو' },
];

const POINTS: { icon: IconName; text: StringKey }[] = [
  { icon: 'people-outline', text: 'coreWelcomePoint1' },
  { icon: 'cash-outline', text: 'coreWelcomePoint2' },
  { icon: 'logo-whatsapp', text: 'coreWelcomePoint3' },
];

export default function SetupScreen() {
  const db = useSQLiteContext();
  const { t, lang, setLanguage, isRTL, rowDir } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Blocks a second business from a fast double tap before `saving` re-renders the button.
  const busy = useRef(false);

  const submit = async () => {
    if (busy.current) return;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('nameRequired');
    if (phone.trim() && !isValidPhone(phone)) next.phone = t('phoneInvalid');
    setErrors(next);
    if (Object.keys(next).length) return;
    busy.current = true;
    setSubmitError(null);
    setSaving(true);
    try {
      await createBusiness(db, { name: name.trim(), phone: phone.trim() || null, language: lang });
      // The root layout switches to the main tabs once the business exists.
    } catch {
      // Never log the error object: it can hold what was typed.
      if (__DEV__) console.warn('Creating the business failed');
      setSubmitError(t('somethingWrong'));
      setSaving(false);
      busy.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Screen contentStyle={styles.content}>
          <Row justify="flex-end">
            <Icon name="language-outline" size={size.icon} color={colors.textSecondary} />
            <View style={styles.language}>
              <Segmented
                value={lang}
                onChange={(k) => {
                  setLanguage(k).catch(() => undefined);
                }}
                options={LANGUAGES}
                accessibilityLabel={t('language')}
              />
            </View>
          </Row>

          <View style={styles.hero}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.logo, { backgroundImage: isRTL ? gradients.heroRTL : gradients.hero }]}
            >
              <Icon name="wallet" size={40} color={colors.onPrimary} />
            </View>
            <Txt variant="title" center header>
              {t('coreWelcomeTitle')}
            </Txt>
            <Txt variant="muted" center>
              {t('welcomeSubtitle')}
            </Txt>
          </View>

          <View style={styles.points}>
            {POINTS.map((p) => (
              <Row key={p.text} gap={space.md}>
                <IconCircle icon={p.icon} />
                <View style={styles.flex}>
                  <Txt>{t(p.text)}</Txt>
                </View>
              </Row>
            ))}
          </View>

          <Card style={styles.form}>
            <Txt variant="h2" header>
              {t('coreYourBusiness')}
            </Txt>
            <Field
              label={t('businessName')}
              value={name}
              onChangeText={setName}
              placeholder={t('businessNameHint')}
              error={errors.name}
              maxLength={80}
            />
            <Field
              label={`${t('businessPhone')} (${t('optional')})`}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="03XX-XXXXXXX"
              error={errors.phone}
              maxLength={20}
              ltr
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            {submitError ? (
              <View
                accessible
                accessibilityLiveRegion="polite"
                accessibilityLabel={t('designErrorLabel', { message: submitError })}
                style={[styles.errorRow, { flexDirection: rowDir }]}
              >
                <Icon name="alert-circle" size={size.iconSm} color={colors.danger} />
                <View style={styles.flex}>
                  <Txt variant="small" tone="danger">
                    {submitError}
                  </Txt>
                </View>
              </View>
            ) : null}
            <Button title={t('getStarted')} size="lg" onPress={submit} loading={saving} />
          </Card>

          {cloudConfigured ? (
            <Button
              title={t('joinWithInvite')}
              icon="people-outline"
              variant="text"
              onPress={() => router.push('/join')}
            />
          ) : null}

          <View style={styles.privacy}>
            <Txt variant="small" center>
              {t('coreRecordsStay')}
            </Txt>
            <Button
              title={t('privacyPolicy')}
              icon="shield-checkmark-outline"
              variant="text"
              onPress={() => router.push('/privacy')}
            />
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { gap: space.lg },
  // Fixed width so the two segments share it evenly; labels wrap at large font sizes.
  language: { width: 240, maxWidth: '100%' },
  hero: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  logo: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: gradients.heroFallback,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
    ...shadow.level2,
  },
  points: { gap: space.md, paddingHorizontal: space.xs },
  form: { gap: space.md },
  errorRow: { alignItems: 'flex-start', gap: space.xs },
  privacy: { alignItems: 'center', gap: space.xxs },
});

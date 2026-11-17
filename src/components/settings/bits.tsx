/**
 * Small pieces shared by the settings screens: a tonal icon circle, a loading
 * block, numbered steps and the premium badge chip. Tokens only; mirrors in
 * Urdu through Row / rowDir.
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, radius, size, space } from '../../theme';
import { Badge, Card, Icon, joinA11y, Row, TonalIcon, Txt } from '../ui';

/** Same tones as the shared TonalIcon in ui.tsx. */
export type { TonalTone } from '../ui';

/**
 * Card holding a list of rows (no padding). An inner clip keeps the rows'
 * ripple inside the rounded corners without clipping the card's shadow.
 */
export function ListCard({ children, variant }: { children: ReactNode; variant?: 'elevated' | 'outlined' }) {
  return (
    <Card variant={variant} style={styles.listCard}>
      <View style={styles.listClip}>{children}</View>
    </Card>
  );
}

/** Decorative 40dp tonal circle with a 20dp icon: the shared TonalIcon (ui.tsx). */
export { TonalIcon };

/** Centred spinner with a spoken label, for screens that are still loading. */
export function Loading() {
  const { t } = useApp();
  return (
    <View style={styles.loading} accessible accessibilityLabel={t('settingsLoading')}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

/**
 * Numbered steps (1, 2, 3...). A done step shows a check; the current step is
 * filled with primary. Each row is read as "Step n: label[, Done]".
 */
export function StepList({ steps }: { steps: { label: string; done?: boolean; current?: boolean }[] }) {
  const { t, isRTL } = useApp();
  return (
    <View style={styles.steps}>
      {steps.map((s, i) => {
        const n = i + 1;
        const bg = s.done ? colors.successContainer : s.current ? colors.primary : colors.surfaceContainer;
        const fg = s.done ? colors.success : s.current ? colors.onPrimary : colors.textSecondary;
        return (
          <View
            key={s.label}
            accessible
            accessibilityLabel={joinA11y([`${t('settingsStep', { n })}: ${s.label}`, s.done && t('done')], isRTL)}
          >
            <Row gap={space.md} align="center">
              <View style={[styles.stepCircle, { backgroundColor: bg }]}>
                {s.done ? (
                  <Icon name="checkmark" size={18} color={fg} />
                ) : (
                  <Txt variant="label" ltr center color={fg} maxFontSizeMultiplier={1.3}>
                    {String(n)}
                  </Txt>
                )}
              </View>
              <View style={styles.flex}>
                <Txt tone={s.done ? 'secondary' : 'text'} weight={s.current ? 600 : undefined}>
                  {s.label}
                </Txt>
              </View>
            </Row>
          </View>
        );
      })}
    </View>
  );
}

/** Premium badge (indigo + star), 48dp tall so it lines up with switches. */
export function PremiumChip() {
  const { t } = useApp();
  return (
    <View accessibilityLabel={t('settingsPremiumChipA11y')} style={styles.premiumChip}>
      <Badge label={t('premium')} tone="premium" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listCard: { padding: 0, gap: 0 },
  listClip: { borderRadius: radius.lg, overflow: 'hidden' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  steps: { gap: space.md },
  stepCircle: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  premiumChip: { minHeight: size.touch, minWidth: size.touch, alignItems: 'center', justifyContent: 'center' },
});

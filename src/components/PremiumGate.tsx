/** Shows its children with premium; otherwise a short note on what premium includes. */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useApp } from '../state/app';
import { colors, space } from '../theme';
import { EmptyState, Icon, Row, Screen, Txt } from './ui';

export function PremiumGate({ children }: { children: ReactNode }) {
  const { t, premium } = useApp();
  if (premium.active) return <>{children}</>;
  const lines = [t('settingsGateStaff'), t('featureBusinesses'), t('settingsGatePayment')];
  return (
    <Screen>
      <EmptyState
        icon="star"
        tone="premium"
        title={t('premiumFeature')}
        action={
          <View style={styles.action}>
            <View style={styles.lines}>
              {lines.map((line) => (
                <Row key={line} gap={space.sm} align="flex-start">
                  <View style={styles.check}>
                    <Icon name="checkmark-circle" size={18} color={colors.tertiary} />
                  </View>
                  <View style={styles.flex}>
                    <Txt variant="muted">{line}</Txt>
                  </View>
                </Row>
              ))}
            </View>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  action: { gap: space.lg },
  lines: { gap: space.sm },
  check: { paddingTop: 1 },
});

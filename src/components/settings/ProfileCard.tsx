/**
 * Settings profile card (docs/DESIGN.md 13.14.1): business Avatar 56, name and
 * phone. Pressable (opens Business info) only when `onPress` is given. With
 * premium staff it adds a "Using as {name} · {role}" line and an optional
 * tonal "Switch user" button, kept outside the pressable header so TalkBack
 * can reach both.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, radius, space } from '../../theme';
import { Avatar, Button, Card, Divider, Icon, joinA11y, Row, Txt } from '../ui';

export function ProfileCard({
  name,
  phone,
  onPress,
  usingAs,
  onSwitch,
}: {
  name: string;
  phone: string | null;
  onPress?: () => void;
  /** Already formatted "Using as Ali · Collector" line. */
  usingAs?: string;
  onSwitch?: () => void;
}) {
  const { t, rowDir, isRTL } = useApp();
  const header = (
    <>
      <Avatar name={name} size={56} />
      <View style={styles.text}>
        <Txt variant="title" numberOfLines={2}>
          {name}
        </Txt>
        {phone ? (
          <Txt variant="muted" ltr>
            {phone}
          </Txt>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={20} color={colors.textSecondary} flipForRTL /> : null}
    </>
  );

  return (
    <Card style={styles.card}>
      <View style={styles.clip}>
        {onPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={joinA11y([name, phone], isRTL)}
            accessibilityHint={t('settingsEditBusinessHint')}
            onPress={onPress}
            android_ripple={{ color: colors.rippleNeutral }}
            style={[styles.header, { flexDirection: rowDir }]}
          >
            {header}
          </Pressable>
        ) : (
          <View accessible style={[styles.header, { flexDirection: rowDir }]}>
            {header}
          </View>
        )}
        {usingAs ? (
          <>
            <Divider />
            <View style={styles.staff}>
              <Row gap={space.sm} style={styles.staffLine}>
                <Icon name="person-circle-outline" size={20} color={colors.textSecondary} />
                <View style={styles.text}>
                  <Txt variant="muted">{usingAs}</Txt>
                </View>
              </Row>
              {onSwitch ? (
                <Button
                  title={t('switchUser')}
                  icon="people-outline"
                  variant="tonal"
                  onPress={onSwitch}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0 },
  clip: { borderRadius: radius.lg, overflow: 'hidden' },
  header: { alignItems: 'center', gap: space.lg, padding: space.lg, minHeight: 88 },
  text: { flex: 1, gap: 2 },
  staff: { padding: space.lg, gap: space.md },
  staffLine: { alignItems: 'center' },
});

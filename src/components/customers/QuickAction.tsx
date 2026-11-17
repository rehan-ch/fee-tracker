/**
 * Labelled tonal icon button for the customer profile card (docs/DESIGN.md
 * 13.6.2): a 48dp tonal circle with a 24dp icon and a one-line label under it.
 * The whole column is one button (at least 64x72dp); TalkBack reads `a11yLabel`
 * (or the visible label). Pressed feedback is a 12% state layer on the circle,
 * matching the shared tonal IconButton.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, size, space } from '../../theme';
import { Icon, Txt, type IconName } from '../ui';

export function QuickAction({
  icon,
  label,
  a11yLabel,
  onPress,
}: {
  icon: IconName;
  label: string;
  a11yLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      onPress={onPress}
      style={styles.action}
    >
      {({ pressed }) => (
        <>
          <View style={styles.circle}>
            {pressed ? <View style={[StyleSheet.absoluteFill, styles.pressed]} /> : null}
            <Icon name={icon} size={size.icon} color={colors.onPrimaryContainer} />
          </View>
          <Txt variant="small" tone="secondary" weight={600} center numberOfLines={2}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
    minWidth: 64,
    maxWidth: 96,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.xs,
    paddingVertical: space.xs,
  },
  circle: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryContainer,
  },
  pressed: { backgroundColor: colors.ripple },
});

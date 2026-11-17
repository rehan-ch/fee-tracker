/**
 * Extended FAB (docs/DESIGN.md 7.2): 56dp, radius 16, primaryContainer with
 * level3 shadow, absolutely positioned at the bottom end (right in English,
 * left in Urdu; absolute positions don't mirror because supportsRTL is off).
 * Give the list under it `paddingBottom: FAB_CLEARANCE`.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, radius, shadow, size, space } from '../../theme';
import { Icon, scriptTextStyle, type IconName } from '../ui';
import { useFontsLoaded } from './fonts';

/** Bottom padding a scrolling list needs so its last row isn't hidden by the FAB. */
export const FAB_CLEARANCE = size.fab + space.xxl;

/** Screen-level primary action floating over a list. */
export function Fab({
  icon,
  label,
  onPress,
  iconFlipForRTL,
  bottom = space.lg,
  accessibilityHint,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  iconFlipForRTL?: boolean;
  /** Distance from the bottom of the screen (default 16). */
  bottom?: number;
  accessibilityHint?: string;
}) {
  const { isRTL, rowDir } = useApp();
  const loaded = useFontsLoaded();
  return (
    <View style={[styles.fab, isRTL ? { left: space.lg } : { right: space.lg }, { bottom }]}>
      <View style={styles.clip}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={accessibilityHint}
          onPress={onPress}
          android_ripple={{ color: colors.ripple }}
          style={[styles.inner, { flexDirection: rowDir }]}
        >
          <Icon name={icon} size={size.icon} color={colors.onPrimaryContainer} flipForRTL={iconFlipForRTL} />
          <Text
            numberOfLines={1}
            style={[
              scriptTextStyle('button', isRTL, loaded, { naturalLine: true }),
              styles.label,
            ]}
          >
            {label}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    maxWidth: '85%',
    borderRadius: radius.lg,
    backgroundColor: colors.primaryContainer,
    ...shadow.level3,
  },
  clip: { borderRadius: radius.lg, overflow: 'hidden' },
  inner: {
    minHeight: size.fab,
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  label: { color: colors.onPrimaryContainer, flexShrink: 1 },
});

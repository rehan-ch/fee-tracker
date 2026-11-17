/**
 * Sticky footer for screen-level primary actions (docs/DESIGN.md 7.4), e.g.
 * form Save or "Start sending": white, top hairline, level3 shadow, 16dp
 * padding plus the navigation-bar inset. Children stack with an 8dp gap.
 * Place it after the Screen / ScrollView inside a `flex: 1` container.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow, space } from '../../theme';

/** Bottom bar holding one or more Buttons. */
export function BottomActionBar({
  children,
  safeArea = true,
  style,
}: {
  children: ReactNode;
  /** Add the bottom safe-area inset (turn off on tab screens, where the tab bar handles it). */
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: space.lg + (safeArea ? insets.bottom : 0) }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
    ...shadow.level3,
  },
});

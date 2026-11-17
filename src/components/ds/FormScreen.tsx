/**
 * Form chrome for stack screens with a header (customer form, fee change,
 * areas, business info, payment details, staff, message template, join): a
 * scrolling body with an optional sticky BottomActionBar (docs/DESIGN.md 7.4),
 * inside a KeyboardAvoidingView offset by the stack header so the focused
 * field and the Save button stay above the keyboard. Expo apps are
 * edge-to-edge on Android, so the window doesn't resize on its own, and the
 * view measures itself from below the header.
 */
import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';

import { colors, space } from '../../theme';
import { Screen } from '../ui';
import { BottomActionBar } from './BottomActionBar';
import { useKeyboardVisible } from './keyboard';

export function FormScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const headerHeight = useHeaderHeight();
  const keyboardOpen = useKeyboardVisible();
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.flex}>
      <Screen contentStyle={footer ? styles.content : null}>{children}</Screen>
      {/* While typing, the keyboard covers the navigation bar: no inset needed. */}
      {footer ? <BottomActionBar safeArea={!keyboardOpen}>{footer}</BottomActionBar> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.xl },
});

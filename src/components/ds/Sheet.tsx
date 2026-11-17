/**
 * BottomSheet (docs/DESIGN.md 7.4): RN Modal over a pressable scrim, white
 * sheet with 28dp top corners, a decorative 32x4 handle in a 48dp header zone
 * with the close button at the top end, scrolling content that stays above
 * the keyboard, and an optional sticky footer above the navigation bar.
 * TalkBack focus stays inside (accessibilityViewIsModal).
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../../state/app';
import { colors, radius, shadow, size, space } from '../../theme';
import { IconButton, Txt } from '../ui';

/** Modal bottom sheet. Render it always and toggle `visible`, or mount it when needed. */
export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  header,
  children,
  footer,
  showClose = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Custom header under the handle (replaces title / subtitle), e.g. Avatar + name. */
  header?: ReactNode;
  children: ReactNode;
  /** Sticky actions under the scroll area (Save buttons). */
  footer?: ReactNode;
  showClose?: boolean;
}) {
  const { t, rowDir } = useApp();
  const insets = useSafeAreaInsets();
  const bottomPad = space.lg + insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('close')}
        />
        <KeyboardAvoidingView behavior="padding" style={styles.avoider}>
          <View accessibilityViewIsModal style={[styles.sheet, { marginTop: insets.top + space.lg }]}>
            <View style={[styles.handleZone, { flexDirection: rowDir }]}>
              <View style={styles.handleSide} />
              <View
                style={styles.handleCenter}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.handle} />
              </View>
              <View style={styles.handleSide}>
                {showClose ? (
                  <IconButton
                    name="close"
                    label={t('close')}
                    onPress={onClose}
                    color={colors.textSecondary}
                  />
                ) : null}
              </View>
            </View>
            {header ??
              (title ? (
                <View style={styles.titleBlock}>
                  <Txt variant="title" header>
                    {title}
                  </Txt>
                  {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
                </View>
              ) : null)}
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.content, footer ? null : { paddingBottom: bottomPad }]}
            >
              {children}
            </ScrollView>
            {footer ? <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.scrim,
  },
  avoider: { flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.level3,
  },
  handleZone: { minHeight: size.touch, alignItems: 'center' },
  handleSide: { width: size.touch, alignItems: 'center', justifyContent: 'center' },
  handleCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 32, height: 4, borderRadius: radius.pill, backgroundColor: colors.handle },
  titleBlock: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: 2 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.lg, gap: space.md },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
});

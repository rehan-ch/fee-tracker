/**
 * In-app toast for platforms without a system one (iOS). Android shows the
 * system toast instead, so this renders nothing there.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onToast, type ToastMessage } from '../lib/toast';
import { colors, radius, shadow, space } from '../theme';
import { Txt } from './ui';

const SHORT_MS = 2000;
const LONG_MS = 3500;

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === 'android') return;
    return onToast((m) => {
      setMessage(m);
      AccessibilityInfo.announceForAccessibility(m.text);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(message.long ? LONG_MS : SHORT_MS),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setMessage((cur) => (cur?.id === message.id ? null : cur));
    });
    return () => anim.stop();
  }, [message, opacity]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + space.xxxl + space.xl }]}>
      <Animated.View style={[styles.toast, { opacity }]}>
        <Txt color={colors.white} center>
          {message.text}
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 480,
    ...shadow.level3,
  },
});

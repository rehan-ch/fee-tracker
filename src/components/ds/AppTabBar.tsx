/**
 * M3 navigation bar (docs/DESIGN.md 7.6), passed to the tabs navigator as
 * `tabBar={(p) => <AppTabBar {...p} />}`. Items follow `rowDir`, so Urdu
 * mirrors (Home on the right) even though native RTL is off. Each item has a
 * 56x32 indicator (primaryContainer when selected) with the screen's
 * `tabBarIcon`, and a script-aware label. Hidden while the keyboard is open.
 */
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from 'expo-router/tabs';
import { useContext, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, radius, size, space } from '../../theme';
import { scriptTextStyle } from '../ui';
import { useFontsLoaded } from './fonts';
import { useKeyboardVisible } from './keyboard';

/** Bottom tab bar for src/app/(tabs)/_layout.tsx. */
export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { rowDir, isRTL } = useApp();
  const loaded = useFontsLoaded();
  const keyboardOpen = useKeyboardVisible();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);

  useEffect(() => {
    if (keyboardOpen) onHeightChange?.(0);
  }, [keyboardOpen, onHeightChange]);

  if (keyboardOpen) return null;

  const labelStyle = scriptTextStyle('labelSmall', isRTL, loaded, { naturalLine: true });

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={[
        styles.bar,
        {
          flexDirection: rowDir,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor || descriptor.options.hidden) return null;
        const { options } = descriptor;
        const focused = index === state.index;
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
        const badge = options.tabBarBadge;

        const onPress = () => {
          // Emit first so screens can react to a re-tap (scroll to top) or prevent it.
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        const onLongPress = () => {
          emitter.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={
              options.tabBarAccessibilityLabel ?? (badge != null ? `${label}, ${badge}` : label)
            }
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.item}
          >
            {({ pressed }) => (
              <>
                <View
                  style={[
                    styles.indicator,
                    focused ? { backgroundColor: colors.primaryContainer } : null,
                  ]}
                >
                  {pressed ? <View style={styles.stateLayer} /> : null}
                  {options.tabBarIcon?.({
                    focused,
                    color: focused ? colors.onPrimaryContainer : colors.textSecondary,
                    size: size.icon,
                  })}
                  {badge != null ? (
                    <View style={[styles.badge, isRTL ? { left: 8 } : { right: 8 }]}>
                      <Text
                        maxFontSizeMultiplier={1.3}
                        style={[scriptTextStyle('labelSmall', false, loaded), styles.badgeText]}
                      >
                        {String(badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  style={[
                    labelStyle,
                    styles.label,
                    { color: focused ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  item: {
    flex: 1,
    minHeight: size.navMin,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    paddingBottom: space.sm,
    gap: space.xs,
  },
  indicator: {
    width: 56,
    height: 32,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.ripple,
  },
  badge: {
    position: 'absolute',
    top: 2,
    minWidth: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, lineHeight: 14 },
  label: { textAlign: 'center', paddingHorizontal: 2 },
});

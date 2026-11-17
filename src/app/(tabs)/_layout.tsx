import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';

import { AppTabBar } from '../../components/ds/AppTabBar';
import { fontStyleFor, useFontsLoaded } from '../../components/ds/fonts';
import { useApp } from '../../state/app';
import { colors } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  color: unknown;
  size: number;
  focused: boolean;
}

function TabIcon({ name, focusedName, color, size, focused }: TabIconProps & { name: IconName; focusedName: IconName }) {
  return <Ionicons name={focused ? focusedName : name} size={size} color={color as string} />;
}

function icon(name: IconName, focusedName: IconName) {
  function renderTabIcon(p: TabIconProps) {
    return <TabIcon name={name} focusedName={focusedName} {...p} />;
  }
  return renderTabIcon;
}

export default function TabsLayout() {
  const { t, isRTL } = useApp();
  const fontsLoaded = useFontsLoaded();
  return (
    <Tabs
      // Custom M3 navigation bar: mirrors in Urdu (native RTL is off), hides with the keyboard.
      tabBar={(p) => <AppTabBar {...p} />}
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { ...fontStyleFor(700, isRTL, fontsLoaded), fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        // Home draws its own top bar in the content (docs/DESIGN.md 13.1).
        options={{ title: t('tabHome'), headerShown: false, tabBarIcon: icon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: t('tabCollection'), tabBarIcon: icon('wallet-outline', 'wallet') }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: t('tabCustomers'), tabBarIcon: icon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: t('tabReports'), tabBarIcon: icon('bar-chart-outline', 'bar-chart') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabSettings'), tabBarIcon: icon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}

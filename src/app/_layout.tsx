import { SplashScreen, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FontsLoadedContext, fontStyleFor, useAppFonts, useFontsLoaded } from '../components/ds/fonts';
import { ToastHost } from '../components/ToastHost';
import { DATABASE_NAME, migrateDbIfNeeded } from '../db/schema';
import { AppProvider, useApp } from '../state/app';
import { useBackgroundWork } from '../state/background';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  // Fonts load from bundled package assets (no network). A font error or a
  // slow load never blocks the app: it falls back to the system font.
  const { fontsLoaded, fontsSettled } = useAppFonts();
  return (
    <SafeAreaProvider>
      <FontsLoadedContext value={fontsLoaded}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded}>
          <AppProvider>
            <StatusBar style="dark" />
            <RootStack fontsSettled={fontsSettled} />
            <ToastHost />
          </AppProvider>
        </SQLiteProvider>
      </FontsLoadedContext>
    </SafeAreaProvider>
  );
}

function RootStack({ fontsSettled }: { fontsSettled: boolean }) {
  const { ready, business, t, isRTL } = useApp();
  const fontsLoaded = useFontsLoaded();
  useBackgroundWork();

  const show = ready && fontsSettled;
  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => undefined);
  }, [show]);

  if (!show) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerTitleStyle: { ...fontStyleFor(700, isRTL, fontsLoaded), fontSize: 18 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Until the business is set up, only the setup and privacy screens exist. */}
      <Stack.Protected guard={!!business} redirectTo="/setup">
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="customer/new" options={{ title: t('addCustomer') }} />
        <Stack.Screen name="customer/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="customer/[id]/edit" options={{ title: t('editCustomer') }} />
        <Stack.Screen name="customer/[id]/fee" options={{ title: t('changeFee') }} />
        <Stack.Screen name="areas" options={{ title: t('areasTitle') }} />
        <Stack.Screen name="business" options={{ title: t('businessInfo') }} />
        <Stack.Screen name="reminders" options={{ title: t('sendReminders') }} />
        <Stack.Screen name="messages" options={{ title: t('reminderMessage') }} />
        <Stack.Screen name="receipt/[id]" options={{ title: t('receipt') }} />
        <Stack.Screen name="alerts" options={{ title: t('alertsTitle') }} />
        <Stack.Screen name="payment-details" options={{ title: t('paymentDetails') }} />
        <Stack.Screen name="staff/index" options={{ title: t('staffTitle') }} />
        <Stack.Screen name="staff/edit" options={{ title: t('staffTitle') }} />
        <Stack.Screen name="businesses" options={{ title: t('businessesTitle') }} />
        <Stack.Screen name="cloud" options={{ title: t('cloudSync') }} />
      </Stack.Protected>
      <Stack.Protected guard={!business} redirectTo="/">
        <Stack.Screen name="setup" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="privacy" options={{ title: t('privacyPolicy') }} />
      <Stack.Screen name="join" options={{ title: t('joinBusiness') }} />
    </Stack>
  );
}

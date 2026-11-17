/** Screen 2: Home (dashboard). Layout per docs/DESIGN.md 13.1. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CollectionHero } from '../../components/core/CollectionHero';
import { GuideSteps } from '../../components/core/GuideSteps';
import { HomeTopBar } from '../../components/core/HomeTopBar';
import { IconCircle } from '../../components/core/IconCircle';
import { StatusSplit } from '../../components/core/StatusSplit';
import { KpiRow } from '../../components/ds/KpiRow';
import { StatTile } from '../../components/ds/StatTile';
import { MonthPicker } from '../../components/pickers';
import { Banner, bidiIsolate, Button, Card, EmptyState, Row, Screen, StatusIcon, Txt } from '../../components/ui';
import { countCustomers, getMeta, listBusinesses, META_LAST_BACKUP, monthSummary } from '../../db/repo';
import { useQuery } from '../../db/useQuery';
import { runBackup } from '../../lib/backup';
import { currentMonthKey } from '../../lib/date';
import type { DueStatus } from '../../lib/dues';
import { useApp } from '../../state/app';
import { space } from '../../theme';

const BACKUP_REMINDER_DAYS = 7;

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { t, business, isRTL, can, role, staff, staffLabel, premium, monthLabel } = useApp();
  const bid = business?.id ?? '';
  const [month, setMonth] = useState(currentMonthKey());

  const { data: summary, error: summaryError } = useQuery((d) => monthSummary(d, bid, month), [bid, month]);
  const { data: customerCount, loading: countLoading } = useQuery((d) => countCustomers(d, bid), [bid]);
  const { data: businessCount } = useQuery(async (d) => (await listBusinesses(d)).length, []);
  // Days since the last backup (null = never). Computed in the query, not during render.
  const { data: backupDays, loading: backupLoading } = useQuery(async (d) => {
    const last = await getMeta(d, META_LAST_BACKUP);
    return last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null;
  }, []);

  const iso = (s: string) => (isRTL ? bidiIsolate(s) : s);
  const sep = isRTL ? '، ' : ', ';

  // Same params as before (tab + month + at); `at` makes the jump work when Collection is already open.
  const openCollection = (tab: DueStatus) =>
    router.navigate({ pathname: '/collection', params: { tab, month, at: String(Date.now()) } });

  const topBar = (
    <HomeTopBar
      name={business?.name ?? ''}
      subtitle={premium.active && role !== 'owner' ? t('usingAs', { name: staffLabel(staff) }) : null}
      onSwitchBusiness={
        (businessCount ?? 0) > 1 && can('businesses.manage') ? () => router.push('/businesses') : undefined
      }
    />
  );

  // First load: show only the top bar instead of a flash of zeros or the empty state.
  if (customerCount === undefined && countLoading) {
    return <Screen safeTop>{topBar}</Screen>;
  }

  if (customerCount === 0) {
    const canEdit = can('customers.edit');
    return (
      <Screen safeTop>
        {topBar}
        <EmptyState
          icon="people-outline"
          title={t('noCustomersTitle')}
          body={canEdit ? t('noCustomersBody') : undefined}
          action={
            canEdit ? (
              <View style={styles.emptyAction}>
                <Card>
                  <GuideSteps
                    title={t('coreHowItWorks')}
                    steps={[t('coreStep1'), t('coreStep2'), t('coreStep3')]}
                  />
                </Card>
                <Button
                  title={t('addFirstCustomer')}
                  icon="person-add"
                  size="lg"
                  onPress={() => router.push('/customer/new')}
                />
              </View>
            ) : undefined
          }
        />
      </Screen>
    );
  }

  const showBackupNudge =
    can('backup') &&
    !backupLoading &&
    (customerCount ?? 0) > 0 &&
    (backupDays == null || backupDays >= BACKUP_REMINDER_DAYS);

  const backupBanner = showBackupNudge ? (
    <Banner
      tone="warning"
      body={backupDays == null ? t('backupNever') : t('backupOld', { days: iso(String(backupDays)) })}
      action={{ label: t('backupNow'), onPress: () => runBackup(db, t) }}
    />
  ) : null;

  if (!summary) {
    return (
      <Screen safeTop>
        {topBar}
        <MonthPicker value={month} onChange={setMonth} />
        {summaryError ? <Banner tone="error" body={t('somethingWrong')} /> : null}
        {backupBanner}
      </Screen>
    );
  }

  const { counts } = summary;
  const notPaid = counts.unpaid + counts.partial;
  const totalDues = notPaid + counts.paid;
  // Open the first tab that has someone in it, so the list is never empty by surprise.
  const openTab: DueStatus =
    counts.unpaid > 0 ? 'unpaid' : counts.partial > 0 ? 'partial' : counts.paid > 0 ? 'paid' : 'unpaid';
  const monthName = monthLabel(month);

  const headline =
    totalDues === 0
      ? t('coreNoDuesFor', { month: monthName })
      : notPaid === 0
        ? t('coreAllPaidFor', { month: monthName })
        : notPaid === 1
          ? t('notPaidOne')
          : t('notPaidCount', { count: iso(String(notPaid)) });

  const leftToPayLabel = [
    t('coreLeftToPay'),
    String(notPaid),
    t('coreOfCustomers', { count: totalDues }),
    `${t('paid')}: ${counts.paid}`,
    `${t('partial')}: ${counts.partial}`,
    `${t('unpaid')}: ${counts.unpaid}`,
  ].join(sep);

  return (
    <Screen safeTop>
      {topBar}
      <MonthPicker value={month} onChange={setMonth} />

      <CollectionHero
        month={month}
        collected={summary.collected}
        expected={summary.expected}
        carried={summary.carried}
      />

      <KpiRow>
        <StatTile
          label={t('pending')}
          value={summary.pending}
          tone={summary.pending > 0 ? 'unpaid' : undefined}
          status={summary.pending > 0 ? 'unpaid' : 'paid'}
          onPress={() => openCollection(openTab)}
          accessibilityHint={t('coreOpensCollection')}
        />
        <StatTile
          label={t('coreLeftToPay')}
          value={notPaid}
          format="count"
          sub={t('coreOfCustomers', { count: iso(String(totalDues)) })}
          onPress={() => openCollection(openTab)}
          accessibilityLabel={leftToPayLabel}
          accessibilityHint={t('coreOpensCollection')}
        >
          {/* The tile's label already reads the counts; hide the chart from TalkBack. */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <StatusSplit counts={counts} />
          </View>
        </StatTile>
      </KpiRow>

      <Card>
        <Row gap={space.md}>
          {totalDues === 0 ? (
            <IconCircle icon="calendar-outline" tone="neutral" />
          ) : (
            <StatusIcon status={notPaid === 0 ? 'paid' : counts.unpaid > 0 ? 'unpaid' : 'partial'} />
          )}
          <View style={styles.flex}>
            <Txt variant="h2">{headline}</Txt>
            {notPaid > 0 ? (
              <Txt variant="muted">
                {`${t('unpaidCount', { count: iso(String(counts.unpaid)) })} · ${t('partialCount', {
                  count: iso(String(counts.partial)),
                })}`}
              </Txt>
            ) : totalDues === 0 ? (
              <Txt variant="muted">{t('coreNoDuesBody')}</Txt>
            ) : null}
          </View>
        </Row>
        {notPaid > 0 ? (
          <Button
            title={t('openUnpaidList')}
            icon="list"
            size="lg"
            onPress={() => openCollection(counts.unpaid > 0 ? 'unpaid' : 'partial')}
            style={styles.firstAction}
          />
        ) : null}
        {notPaid > 0 && can('reminders.send') ? (
          <Button
            title={t('sendReminders')}
            icon="logo-whatsapp"
            variant="tonal"
            onPress={() => router.push({ pathname: '/reminders', params: { month } })}
          />
        ) : null}
      </Card>

      {backupBanner}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyAction: { gap: space.lg },
  firstAction: { marginTop: space.xs },
});

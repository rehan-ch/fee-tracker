/** Screen 3: Monthly collection - Unpaid / Partial / Paid for the chosen month. Layout per docs/DESIGN.md 13.2. */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View, type ListRenderItemInfo } from 'react-native';

import { DueRow } from '../../components/core/DueRow';
import { Fab, FAB_CLEARANCE } from '../../components/ds/Fab';
import { MonthPicker, pickDay, useSystemPicker } from '../../components/pickers';
import { RecordPaymentSheet, type SheetDue } from '../../components/RecordPaymentSheet';
import { bidiIsolate, Button, Chip, ChipRow, EmptyState, SearchBar, Segmented } from '../../components/ui';
import { listAreas, listDuesForMonth } from '../../db/repo';
import type { DueListRow } from '../../db/types';
import { useQuery } from '../../db/useQuery';
import { currentMonthKey, isMonthKey, todayKey, type DayKey, type MonthKey } from '../../lib/date';
import type { DueStatus } from '../../lib/dues';
import { matchesSearch } from '../../lib/phone';
import { useApp } from '../../state/app';
import { colors, space } from '../../theme';

const TABS: DueStatus[] = ['unpaid', 'partial', 'paid'];

export default function CollectionScreen() {
  const { t, dateLabel, monthLabel, business, can, isRTL } = useApp();
  const { fontScale } = useWindowDimensions();
  const bid = business?.id ?? '';
  const params = useLocalSearchParams<{ tab?: string; month?: string; at?: string }>();
  const [month, setMonth] = useState<MonthKey>(
    isMonthKey(params.month) ? params.month : currentMonthKey(),
  );
  const paramTab = (TABS as string[]).includes(params.tab ?? '') ? (params.tab as DueStatus) : null;
  const [tab, setTab] = useState<DueStatus>(paramTab ?? 'unpaid');
  const [search, setSearch] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState<DayKey | null>(null);
  const [sheetDue, setSheetDue] = useState<SheetDue | null>(null);
  const datePicker = useSystemPicker();

  // Home's "Open unpaid list" passes ?tab=unpaid&month=YYYY-MM&at=<time>.
  // `at` changes on every tap so the jump also works when this tab is already
  // open. Adjusting state during render (not in an effect) avoids an extra pass.
  const paramKey = `${params.tab}|${params.month}|${params.at}`;
  const [seenParamKey, setSeenParamKey] = useState(paramKey);
  if (paramKey !== seenParamKey) {
    setSeenParamKey(paramKey);
    if (paramTab) setTab(paramTab);
    if (isMonthKey(params.month)) setMonth(params.month);
  }

  const { data: areas } = useQuery((d) => listAreas(d, bid), [bid]);
  const { data: all, error: allError } = useQuery(
    (d) => listDuesForMonth(d, bid, month, { areaId }),
    [bid, month, areaId],
  );
  const usePaidOn = tab !== 'unpaid' && paidOn !== null;
  const { data: byDate } = useQuery(
    (d) => (usePaidOn ? listDuesForMonth(d, bid, month, { areaId, paidOn }) : Promise.resolve(null)),
    [bid, month, areaId, paidOn, usePaidOn],
  );

  const counts = useMemo(() => {
    const c: Record<DueStatus, number> = { unpaid: 0, partial: 0, paid: 0 };
    all?.forEach((r) => (c[r.status] += 1));
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const source = (usePaidOn ? byDate : all) ?? [];
    return source.filter(
      (r) => r.status === tab && matchesSearch(search, r.customer_name, r.customer_phone),
    );
  }, [all, byDate, usePaidOn, tab, search]);

  const filtered = search.trim() !== '' || areaId !== null || usePaidOn;
  const clearFilters = () => {
    setSearch('');
    setAreaId(null);
    setPaidOn(null);
  };

  const onRowPress = useCallback(
    (r: DueListRow) => {
      if (r.status === 'paid' || !can('payments.add')) router.push(`/customer/${r.customer_id}`);
      else setSheetDue(r);
    },
    [can],
  );
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<DueListRow>) => <DueRow row={item} onPress={onRowPress} />,
    [onRowPress],
  );

  const showReminders = tab !== 'paid' && counts.unpaid + counts.partial > 0 && can('reminders.send');
  const areaList = areas ?? [];
  const showChips = areaList.length > 0 || tab !== 'unpaid';
  const monthName = monthLabel(month);

  let empty: ReactElement | undefined;
  if (!all) {
    // Still loading (local database, a blink) or failed.
    empty = allError ? (
      <EmptyState icon="alert-circle-outline" tone="neutral" title={t('somethingWrong')} />
    ) : undefined;
  } else if (filtered) {
    empty = (
      <EmptyState
        icon="search"
        tone="neutral"
        title={t('coreNoMatches')}
        body={t('coreNoMatchesBody')}
        action={<Button title={t('coreClearFilters')} icon="close" variant="text" onPress={clearFilters} />}
      />
    );
  } else if (all.length === 0) {
    empty = (
      <EmptyState
        icon="calendar-outline"
        tone="neutral"
        title={t('coreNoDuesFor', { month: monthName })}
        body={t('coreNoDuesBody')}
      />
    );
  } else if (tab === 'unpaid') {
    // Nobody is fully unpaid. If some paid only part, say so instead of "everyone has paid".
    empty =
      counts.partial > 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          tone="neutral"
          title={t('noUnpaid')}
          body={t('partialCount', { count: isRTL ? bidiIsolate(String(counts.partial)) : counts.partial })}
          action={<Button title={t('coreShowPartial')} variant="tonal" onPress={() => setTab('partial')} />}
        />
      ) : (
        <EmptyState
          icon="checkmark-done-circle-outline"
          tone="success"
          title={t('coreAllPaidFor', { month: monthName })}
        />
      );
  } else if (tab === 'partial') {
    empty = <EmptyState icon="contrast-outline" tone="neutral" title={t('noPartial')} />;
  } else {
    empty = <EmptyState icon="receipt-outline" tone="neutral" title={t('noPaid')} />;
  }

  // At large font sizes the filters get tall (Urdu more so): let them scroll
  // away with the list instead of leaving room for only a row or two.
  const scrollHeader = fontScale > 1.3;
  const header = (
    <View style={[styles.header, scrollHeader ? styles.headerInList : styles.headerFixed]}>
      <MonthPicker value={month} onChange={setMonth} />
      <Segmented
        value={tab}
        onChange={setTab}
        options={TABS.map((s) => ({ key: s, label: t(s), count: counts[s], tone: s }))}
        accessibilityLabel={t('status')}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder={t('searchPlaceholder')} />
      {showChips ? (
        <ChipRow bleed>
          {areaList.length > 0 ? (
            <>
              <Chip label={t('allAreas')} selected={areaId === null} onPress={() => setAreaId(null)} />
              {areaList.map((a) => (
                <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => setAreaId(a.id)} />
              ))}
              <Chip label={t('noArea')} selected={areaId === 'none'} onPress={() => setAreaId('none')} />
            </>
          ) : null}
          {tab !== 'unpaid' ? (
            <Chip
              icon="calendar-outline"
              label={`${t('paidOn')}: ${paidOn ? dateLabel(paidOn) : t('anyDate')}`}
              selected={paidOn !== null}
              onPress={() =>
                pickDay(datePicker.open, paidOn ?? todayKey(), setPaidOn, { maximumDate: new Date(), title: t('paidOn') })
              }
            />
          ) : null}
          {tab !== 'unpaid' && paidOn ? (
            <Chip variant="assist" icon="close" label={t('anyDate')} onPress={() => setPaidOn(null)} />
          ) : null}
        </ChipRow>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      {scrollHeader ? null : header}

      <FlatList
        data={rows}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={scrollHeader ? header : undefined}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[styles.list, { paddingBottom: showReminders ? FAB_CLEARANCE : space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={empty}
      />

      {showReminders ? (
        <Fab
          icon="logo-whatsapp"
          label={t('sendReminders')}
          onPress={() => router.push({ pathname: '/reminders', params: { month } })}
        />
      ) : null}

      <RecordPaymentSheet due={sheetDue} onClose={() => setSheetDue(null)} />
      {datePicker.picker}
    </View>
  );
}

function keyOf(r: DueListRow): string {
  return r.id;
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { gap: space.sm },
  // Same 16dp top as the Customers and Reports tabs.
  headerFixed: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  // Inside the list, which already has the side padding.
  headerInList: { paddingTop: space.md, paddingBottom: space.md },
  list: { paddingHorizontal: space.lg, paddingTop: space.xs, flexGrow: 1 },
  separator: { height: space.sm },
});

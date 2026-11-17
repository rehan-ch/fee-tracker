/**
 * Screen 12: Reports - monthly and yearly collection totals by area, payment
 * method and collector, exported to PDF or Excel.
 *
 * Layout (docs/DESIGN.md 13.10): the period filters sit above everything they
 * scope, then KPI tiles, the charts (each in a card under a section header,
 * with its own table-style rows) and the export card.
 */
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, useWindowDimensions, View } from 'react-native';

import { KpiRow } from '../../components/ds/KpiRow';
import { Meter, percentOf } from '../../components/ds/Meter';
import { StatTile } from '../../components/ds/StatTile';
import { MeterList } from '../../components/money/MeterList';
import { MethodSplit } from '../../components/money/MethodSplit';
import { RankedBars } from '../../components/money/RankedBars';
import { StatusSplit } from '../../components/money/StatusSplit';
import { YearColumns } from '../../components/money/YearColumns';
import { MonthPicker } from '../../components/pickers';
import { METHOD_LABEL } from '../../components/RecordPaymentSheet';
import {
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Screen,
  SectionHeader,
  Segmented,
  Txt,
} from '../../components/ui';
import {
  listStaff,
  monthSummary,
  reportByArea,
  reportByCollector,
  reportByMethod,
  reportYears,
  yearByMonth,
  type Period,
} from '../../db/repo';
import { useQuery } from '../../db/useQuery';
import type { StringKey } from '../../i18n/strings';
import { currentMonthKey, type MonthKey } from '../../lib/date';
import { buildReport, reportHtml, reportSheets, sharePdf, shareXlsx, slug } from '../../lib/exportReport';
import { useApp } from '../../state/app';
import { colors, space } from '../../theme';

type Mode = 'month' | 'year';

export default function ReportsScreen() {
  const db = useSQLiteContext();
  const app = useApp();
  const { t, money, monthLabel, business, can, premium, staffLabel, rowDir } = app;
  const { fontScale } = useWindowDimensions();
  const bid = business?.id ?? '';
  const thisYear = new Date().getFullYear();
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState<MonthKey>(currentMonthKey());
  const [year, setYear] = useState(thisYear);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const period: Period = mode === 'month' ? month : year;

  const { data: years } = useQuery((d) => reportYears(d, bid), [bid]);
  const { data: months, error: monthsError } = useQuery((d) => yearByMonth(d, bid, year), [bid, year]);
  const { data: summary, error: summaryError } = useQuery((d) => monthSummary(d, bid, month), [bid, month]);
  const { data: methods, error: methodsError } = useQuery((d) => reportByMethod(d, bid, period), [bid, period]);
  const { data: areas, error: areasError } = useQuery((d) => reportByArea(d, bid, period), [bid, period]);
  const { data: staffCount } = useQuery(async (d) => (await listStaff(d, bid)).length, [bid]);
  const showCollectors = premium.active && (staffCount ?? 0) > 1;
  const { data: collectors } = useQuery(
    (d) => (showCollectors ? reportByCollector(d, bid, period) : Promise.resolve([])),
    [bid, period, showCollectors],
  );

  if (!can('reports.view')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;

  const yearOptions = Array.from(new Set([thisYear, ...(years ?? [])])).sort((a, b) => b - a);
  const billed = months?.reduce((s, m) => s + m.billed, 0) ?? 0;
  const collected = months?.reduce((s, m) => s + m.collected, 0) ?? 0;
  // Same "still owed" figure as the exported year report: the last month's balance.
  const pendingNow = months?.length ? months[months.length - 1].pending : 0;
  const empty = mode === 'year' ? months?.length === 0 : summary !== undefined && summary.expected === 0 && summary.collected === 0;
  const loadingMain = mode === 'year' ? months === undefined : summary === undefined;
  const loadError = (mode === 'year' ? monthsError : summaryError) ?? methodsError ?? areasError;
  const periodName = mode === 'month' ? monthLabel(month) : String(year);
  const stackButtons = fontScale > 1.3;

  const monthName = (k: MonthKey) => t(`m${Number(k.slice(5, 7))}` as StringKey);
  const customersText = (n: number) => (n === 1 ? t('moneyCustomersOne') : t('customersCount', { count: n }));
  const paymentsText = (n: number) => (n === 1 ? t('moneyPaymentsOne') : t('moneyPaymentsCount', { count: n }));
  // "No area" always last, whatever the query order.
  const areaRows = areas ? [...areas.filter((a) => a.area_id), ...areas.filter((a) => !a.area_id)] : [];

  const exportAs = async (kind: 'pdf' | 'xlsx') => {
    if (!business) return;
    setBusy(kind);
    try {
      const format = {
        t,
        rtl: app.isRTL,
        money,
        monthLabel: app.monthLabel,
        dateLabel: app.dateLabel,
        methodLabel: (m: keyof typeof METHOD_LABEL) => t(METHOD_LABEL[m]),
        staffLabel: (name: string | null, role: string | null) => staffLabel({ name, role }),
      };
      const report = await buildReport(db, business, period, format, showCollectors);
      const name = `${slug(business.name)}-report-${period}`;
      if (kind === 'pdf') await sharePdf(reportHtml(report, format), name, t('exportReport'));
      else await shareXlsx(reportSheets(report, format), name, t('exportReport'));
    } catch {
      // Fixed message only: the error may carry customer data.
      if (__DEV__) console.warn('Export failed');
      Alert.alert(t('somethingWrong'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      {/* Filters first: they scope everything below. */}
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { key: 'month', label: t('monthly') },
          { key: 'year', label: t('yearly') },
        ]}
        accessibilityLabel={t('moneyReportPeriod')}
      />
      {mode === 'month' ? (
        <MonthPicker value={month} onChange={setMonth} />
      ) : yearOptions.length > 1 ? (
        <ChipRow bleed>
          {yearOptions.map((y) => (
            <Chip key={y} label={String(y)} selected={y === year} onPress={() => setYear(y)} />
          ))}
        </ChipRow>
      ) : null}

      {loadError ? <Banner tone="error" body={t('somethingWrong')} /> : null}

      {loadingMain && !loadError ? (
        <ActivityIndicator
          color={colors.primary}
          size="large"
          accessibilityLabel={t('moneyLoading')}
          style={styles.loading}
        />
      ) : empty ? (
        <EmptyState
          icon="bar-chart-outline"
          tone="neutral"
          title={mode === 'month' ? t('moneyNoMonthData', { month: periodName }) : t('moneyNoYearData', { year })}
          body={t('moneyNoDataBody')}
        />
      ) : loadingMain ? null : (
        <>
          {mode === 'month' && summary ? (
            <>
              <KpiRow>
                <StatTile label={t('expected')} value={summary.expected} />
                <StatTile label={t('collected')} value={summary.collected} tone="paid">
                  <CollectionRate collected={summary.collected} expected={summary.expected} />
                </StatTile>
                <StatTile label={t('pending')} value={summary.pending} tone="unpaid" status="unpaid" />
              </KpiRow>
              <SectionHeader title={t('moneyCustomerStatus')} />
              <Card>
                <StatusSplit counts={summary.counts} />
              </Card>
            </>
          ) : null}

          {mode === 'year' && months ? (
            <>
              <SectionHeader title={`${t('yearTotal')} · ${year}`} />
              <KpiRow>
                <StatTile label={t('feesBilled')} value={billed} />
                <StatTile label={t('collected')} value={collected} tone="paid">
                  <CollectionRate collected={collected} expected={billed} />
                </StatTile>
                <StatTile label={t('pendingNow')} value={pendingNow} tone="unpaid" status="unpaid" />
              </KpiRow>
              <SectionHeader title={t('moneyCollectionChart')} />
              <Card style={styles.chartCard}>
                <YearColumns key={year} year={year} months={months} />
              </Card>
              <SectionHeader title={t('monthlySummary')} />
              <Card>
                <MeterList
                  rows={months.map((m) => ({
                    key: m.month,
                    name: monthName(m.month),
                    value: m.collected,
                    max: m.billed,
                    pending: m.pending,
                  }))}
                />
                <Txt variant="small">{t('reportsHint')}</Txt>
              </Card>
            </>
          ) : null}

          {methods && methods.length > 0 ? (
            <>
              <SectionHeader title={t('byMethod')} />
              <Card>
                <MethodSplit rows={methods} />
              </Card>
            </>
          ) : null}

          {areas && (areas.length > 1 || areas[0]?.area_id) ? (
            <>
              <SectionHeader title={t('moneyByArea')} />
              <Card>
                <MeterList
                  rows={areaRows.map((a) => ({
                    key: a.area_id ?? 'none',
                    name: a.area_name ?? t('noArea'),
                    sub: customersText(a.customers),
                    value: a.collected,
                    max: a.billed,
                    pending: a.pending,
                  }))}
                />
              </Card>
            </>
          ) : null}

          {showCollectors && collectors && collectors.length > 0 ? (
            <>
              <SectionHeader title={t('byCollector')} />
              <Card>
                <RankedBars
                  format={money}
                  rows={collectors.map((c) => ({
                    key: c.staff_id ?? 'none',
                    label: staffLabel({ name: c.staff_name, role: c.role }),
                    sub: paymentsText(c.count),
                    value: c.total,
                  }))}
                />
              </Card>
            </>
          ) : null}

          <SectionHeader title={t('exportReport')} />
          <Card style={styles.exportCard}>
            <Txt variant="muted">
              {mode === 'month'
                ? t('moneyExportCaptionMonth', { period: periodName })
                : t('moneyExportCaptionYear', { period: periodName })}
            </Txt>
            <View style={[styles.exportButtons, { flexDirection: stackButtons ? 'column' : rowDir }]}>
              <Button
                title={t('moneyPdf')}
                accessibilityLabel={t('moneyExportPdfA11y')}
                icon="document-text-outline"
                variant="outlined"
                style={stackButtons ? null : styles.flex}
                onPress={() => exportAs('pdf')}
                loading={busy === 'pdf'}
                disabled={!!busy}
              />
              <Button
                title={t('moneyExcel')}
                accessibilityLabel={t('moneyExportExcelA11y')}
                icon="grid-outline"
                variant="outlined"
                style={stackButtons ? null : styles.flex}
                onPress={() => exportAs('xlsx')}
                loading={busy === 'xlsx'}
                disabled={!!busy}
              />
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

/** Collection-rate meter with its "{pct}% collected" caption, inside the Collected tile. */
function CollectionRate({ collected, expected }: { collected: number; expected: number }) {
  const { t } = useApp();
  return (
    <View style={styles.rate}>
      <Meter value={collected} max={expected} label={t('moneyCollectionRate')} showPercent={false} />
      <Txt variant="small">{t('designPercentCollected', { percent: percentOf(collected, expected) })}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: space.xxl },
  rate: { gap: space.xs, marginTop: space.xs },
  // Narrower side padding gives the 12 month slots more room on 360dp phones.
  chartCard: { paddingHorizontal: space.md },
  exportCard: { gap: space.md },
  exportButtons: { gap: space.sm },
});

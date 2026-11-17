/**
 * Year column chart (docs/DESIGN.md 8.4): twelve month slots laid out with
 * `rowDir` (January at the right in Urdu). Each slot draws the billed amount
 * as a grey context column with the collected amount overlaid in the accent
 * colour from the same baseline. Three solid hairline gridlines and compact
 * ticks sit on the reading-start side; the plot is 160dp plus a 24dp axis
 * band. Tapping a column selects it (tap again to clear) and the readout row
 * above the plot shows its figures; with nothing selected it shows the
 * highest month. The "Month by month" list on the Reports screen is the
 * table view of the same data.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MonthReportRow } from '../../db/repo';
import { currentMonthKey, type MonthKey } from '../../lib/date';
import { useApp } from '../../state/app';
import { chart, colors, radius, space, typography } from '../../theme';
import { bidiIsolate, Row, Txt } from '../ui';
import { niceMax, tickLabel } from './scale';

const PLOT = 160;
const AXIS = 24;
const COLUMN_MAX = 20;

/** Readout height for its three lines (month, collected, pending), so the plot never jumps. */
function readoutHeight(urdu: boolean): number {
  const scale = urdu ? typography.urdu : typography.latin;
  return (scale.body.lineHeight ?? 0) + 2 * (scale.small.lineHeight ?? 0) + 2 * space.xxs;
}

function monthKeys(year: number): MonthKey[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function heightOf(v: number, top: number): number {
  if (!(v > 0) || !(top > 0)) return 0;
  return Math.max(2, Math.round((Math.min(v, top) / top) * PLOT));
}

/** Pass `key={year}` so the selection resets when the year changes. */
export function YearColumns({ year, months }: { year: number; months: MonthReportRow[] }) {
  const { t, money, monthLabel, shortMonthLabel, isRTL, rowDir } = useApp();
  const byKey = new Map(months.map((m) => [m.month, m]));
  const keys = monthKeys(year);
  const top = niceMax(Math.max(0, ...months.map((m) => Math.max(m.billed, m.collected))));
  const ticks = [top, top / 2, 0];

  const now = currentMonthKey();
  const fallback = byKey.has(now) ? now : (months[months.length - 1]?.month ?? null);
  // undefined: nothing tapped yet, so the current (or last) month is selected.
  const [picked, setPicked] = useState<MonthKey | null | undefined>(undefined);
  const selected = picked === undefined ? fallback : picked;
  const highest = months.reduce<MonthReportRow | null>(
    (best, m) => (!best || m.collected > best.collected ? m : best),
    null,
  );
  const shown = (selected ? byKey.get(selected) : undefined) ?? highest;

  const collectedOf = (m: MonthReportRow) =>
    t('moneyCollectedOf', {
      collected: bidiIsolate(money(m.collected)),
      billed: bidiIsolate(money(m.billed)),
    });
  const pendingOf = (m: MonthReportRow) =>
    m.pending > 0 ? t('moneyPendingAmount', { amount: bidiIsolate(money(m.pending)) }) : null;
  const sep = isRTL ? '، ' : ', ';

  // Square at the baseline, 4dp rounded at the data end (top).
  const dataEnd = { borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs };

  return (
    <View style={styles.wrap}>
      {/* Legend; also carries the chart's spoken summary. */}
      <View accessible accessibilityLabel={t('moneyChartSummary', { year })}>
        <Row gap={space.lg} wrap>
          <Row gap={space.xs + space.xxs}>
            <View style={[styles.swatch, { backgroundColor: chart.accent }]} />
            <Txt variant="small" tone="secondary">
              {t('collected')}
            </Txt>
          </Row>
          <Row gap={space.xs + space.xxs}>
            <View style={[styles.swatch, { backgroundColor: chart.context }]} />
            <Txt variant="small" tone="secondary">
              {t('designLegendBilled')}
            </Txt>
          </Row>
        </Row>
      </View>

      {/* Readout: replaces a tooltip (tap is the hover on a phone). */}
      <View
        accessible
        accessibilityLiveRegion="polite"
        style={[styles.readout, { minHeight: readoutHeight(isRTL) }]}
      >
        {shown ? (
          <>
            <Txt weight={600}>
              {selected && byKey.has(selected)
                ? monthLabel(shown.month)
                : t('moneyHighestMonth', { month: monthLabel(shown.month) })}
            </Txt>
            <Txt variant="small" tone="secondary">
              {collectedOf(shown)}
            </Txt>
            {pendingOf(shown) ? (
              <Txt variant="small" tone="unpaid">
                {pendingOf(shown)}
              </Txt>
            ) : null}
          </>
        ) : null}
      </View>

      <Row gap={space.xs} align="flex-start">
        {/* Ticks on the reading-start side, top to bottom: max, half, 0. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.ticks}
        >
          {ticks.map((v) => (
            <Txt key={v} variant="small" ltr align="end" color={chart.axisText} style={styles.tabular}>
              {tickLabel(v, top)}
            </Txt>
          ))}
        </View>

        <View style={styles.flex}>
          <View pointerEvents="none" style={styles.grid}>
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
            <View style={styles.gridLine} />
          </View>
          <View style={[styles.slots, { flexDirection: rowDir }]}>
            {keys.map((k) => {
              const m = byKey.get(k);
              const isSelected = selected === k;
              const dim = selected != null && !isSelected;
              const label = m
                ? `${monthLabel(k)}: ${[collectedOf(m), pendingOf(m)].filter(Boolean).join(sep)}`
                : t('moneySlotEmpty', { month: monthLabel(k) });
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected, disabled: !m }}
                  disabled={!m}
                  onPress={() => setPicked(isSelected ? null : k)}
                  style={styles.slot}
                >
                  <View style={[styles.plotCell, dim ? styles.dim : null]}>
                    {m ? (
                      <View style={styles.columnBox}>
                        <View style={[dataEnd, { height: heightOf(m.billed, top), backgroundColor: chart.context }]} />
                        <View
                          style={[
                            styles.overlay,
                            dataEnd,
                            { height: heightOf(m.collected, top), backgroundColor: chart.accent },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.axisCell}>
                    <Txt
                      variant="small"
                      ltr
                      center
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      weight={isSelected ? 700 : 400}
                      color={isSelected ? colors.text : chart.axisText}
                    >
                      {/* Urdu month names don't fit 12 across: use the month number (Latin digits). */}
                      {isRTL ? String(Number(k.slice(5, 7))) : shortMonthLabel(k)}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Row>
      <Txt variant="small">{t('moneyTapColumn')}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  flex: { flex: 1 },
  swatch: { width: 10, height: 10, borderRadius: radius.xs },
  readout: { gap: space.xxs },
  ticks: { height: PLOT, justifyContent: 'space-between' },
  tabular: { fontVariant: ['tabular-nums'] },
  grid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PLOT,
    justifyContent: 'space-between',
  },
  gridLine: { height: 1, backgroundColor: chart.grid },
  slots: { alignItems: 'stretch' },
  slot: { flex: 1, minWidth: 0 },
  plotCell: { height: PLOT, alignItems: 'center', justifyContent: 'flex-end' },
  dim: { opacity: 0.5 },
  // Billed (context) and collected (accent) share one box, so they align exactly.
  columnBox: { width: '70%', maxWidth: COLUMN_MAX, height: PLOT, justifyContent: 'flex-end' },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  axisCell: { minHeight: AXIS, justifyContent: 'center', paddingHorizontal: 1 },
});

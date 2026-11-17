/** Screen 5: Customers list with search, area and inactive filters (docs/DESIGN.md 13.5). */
import { router } from 'expo-router';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItem } from 'react-native';

import { CustomerRow } from '../../components/customers/CustomerRow';
import { Fab, FAB_CLEARANCE } from '../../components/ds/Fab';
import { Button, Chip, ChipRow, EmptyState, SearchBar } from '../../components/ui';
import { listAreas, listCustomers } from '../../db/repo';
import type { CustomerListRow } from '../../db/types';
import { useQuery } from '../../db/useQuery';
import { matchesSearch } from '../../lib/phone';
import { useApp } from '../../state/app';
import { colors, space } from '../../theme';

const keyExtractor = (c: CustomerListRow) => c.id;
const renderItem: ListRenderItem<CustomerListRow> = ({ item }) => <CustomerRow c={item} />;

function Separator() {
  return <View style={styles.separator} />;
}

export default function CustomersScreen() {
  const { t, business, can } = useApp();
  const bid = business?.id ?? '';
  const canEdit = can('customers.edit');
  const [search, setSearch] = useState('');
  const [pickedArea, setAreaId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: customers, error } = useQuery((d) => listCustomers(d, bid), [bid]);
  const { data: areas } = useQuery((d) => listAreas(d, bid), [bid]);
  const areaList = areas ?? [];

  // An area deleted while it was selected no longer has a chip: stop filtering by it.
  const areaId =
    pickedArea && pickedArea !== 'none' && areas && !areas.some((a) => a.id === pickedArea)
      ? null
      : pickedArea;

  const inactiveCount = customers?.filter((c) => c.status === 'inactive').length ?? 0;
  const rows = useMemo(
    () =>
      (customers ?? []).filter(
        (c) =>
          (showInactive ? c.status === 'inactive' : c.status === 'active') &&
          (areaId === null || (areaId === 'none' ? !c.area_id : c.area_id === areaId)) &&
          matchesSearch(search, c.name, c.phone),
      ),
    [customers, showInactive, areaId, search],
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setAreaId(null);
    setShowInactive(false);
  }, []);
  const addCustomer = useCallback(() => router.push('/customer/new'), []);

  const showAreaChips = areaList.length > 0;
  const showInactiveChip = inactiveCount > 0 || showInactive;

  let empty: ReactElement | undefined;
  if (!customers) {
    empty = error ? <EmptyState icon="alert-circle-outline" tone="neutral" title={t('somethingWrong')} /> : undefined;
  } else if (customers.length === 0) {
    empty = (
      <EmptyState
        icon="people-outline"
        title={t('noCustomersTitle')}
        body={canEdit ? t('noCustomersBody') : undefined}
        action={
          canEdit ? (
            <Button title={t('addFirstCustomer')} icon="person-add" size="lg" onPress={addCustomer} />
          ) : undefined
        }
      />
    );
  } else {
    empty = (
      <EmptyState
        icon="search"
        tone="neutral"
        title={t('noCustomersMatch')}
        body={t('customersNoMatchBody')}
        action={<Button title={t('customersClearFilters')} icon="close" variant="text" onPress={clearFilters} />}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('searchPlaceholder')} />
        {showAreaChips || showInactiveChip ? (
          <ChipRow bleed>
            {showAreaChips ? (
              <>
                <Chip label={t('allAreas')} selected={areaId === null} onPress={() => setAreaId(null)} />
                {areaList.map((a) => (
                  <Chip key={a.id} label={a.name} selected={areaId === a.id} onPress={() => setAreaId(a.id)} />
                ))}
                <Chip label={t('noArea')} selected={areaId === 'none'} onPress={() => setAreaId('none')} />
              </>
            ) : null}
            {showAreaChips && showInactiveChip ? <View style={styles.chipDivider} /> : null}
            {showInactiveChip ? (
              <Chip
                icon="pause-circle-outline"
                label={t('customersInactiveFilter', { count: inactiveCount })}
                selected={showInactive}
                onPress={() => setShowInactive((v) => !v)}
              />
            ) : null}
          </ChipRow>
        ) : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[styles.list, { paddingBottom: canEdit ? FAB_CLEARANCE : space.xxxl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={empty}
      />
      {canEdit ? <Fab icon="person-add" label={t('addCustomer')} onPress={addCustomer} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: space.sm },
  list: { paddingHorizontal: space.lg, paddingTop: space.xs, flexGrow: 1 },
  separator: { height: space.sm },
  chipDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: space.sm,
    backgroundColor: colors.outline,
  },
});

/** Screen 8: Areas / groups - add, rename, delete (docs/DESIGN.md 13.9). */
import { useSQLiteContext } from 'expo-sqlite';
import { Fragment, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { FormScreen } from '../components/ds/FormScreen';
import { useA11yJoin } from '../components/customers/text';
import { Button, Card, Divider, EmptyState, Field, IconButton, Row, TonalIcon, Txt } from '../components/ui';
import { createArea, deleteArea, listAreas, renameArea, type AreaWithCount } from '../db/repo';
import { useQuery } from '../db/useQuery';
import { useApp } from '../state/app';
import { colors, size, space } from '../theme';

export default function AreasScreen() {
  const db = useSQLiteContext();
  const { t, business, can } = useApp();
  const join = useA11yJoin();
  const bid = business?.id ?? '';
  const { data: areas, error: loadError } = useQuery((d) => listAreas(d, bid), [bid]);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // Settings only links here with this permission; the route checks too (deep links).
  if (!can('customers.edit')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }

  const nameTaken = (name: string, exceptId?: string) => {
    const key = name.toLocaleLowerCase();
    return (areas ?? []).some((a) => a.id !== exceptId && a.name.trim().toLocaleLowerCase() === key);
  };

  const add = async () => {
    const name = newName.trim();
    if (!name || !business || adding) return;
    if (nameTaken(name)) {
      setAddError(t('customersAreaExists'));
      return;
    }
    setAdding(true);
    try {
      await createArea(db, business.id, name);
      setNewName('');
    } catch {
      if (__DEV__) console.warn('Areas: adding an area failed');
      setAddError(t('somethingWrong'));
    } finally {
      setAdding(false);
    }
  };

  const startRename = (a: AreaWithCount) => {
    setEditingId(a.id);
    setEditName(a.name);
    setRenameError(null);
  };

  const saveRename = async () => {
    const name = editName.trim();
    if (!editingId) return;
    // An empty name keeps the old one (same as before).
    if (!name) {
      setEditingId(null);
      return;
    }
    if (nameTaken(name, editingId)) {
      setRenameError(t('customersAreaExists'));
      return;
    }
    try {
      await renameArea(db, editingId, name);
      setEditingId(null);
    } catch {
      if (__DEV__) console.warn('Areas: renaming an area failed');
      setRenameError(t('somethingWrong'));
    }
  };

  const confirmDelete = (id: string, name: string) =>
    Alert.alert(t('delete'), t('deleteAreaConfirm', { name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        // Re-checked here: the role can change while the dialog is open.
        onPress: () => {
          if (can('customers.edit')) deleteArea(db, id);
        },
      },
    ]);

  const countLabel = (n: number) => (n === 1 ? t('customersOneCustomer') : t('customersCount', { count: n }));

  return (
    <FormScreen>
      <Txt variant="muted">{t('areasHint')}</Txt>
      <Card style={styles.addCard}>
        <Field
          label={t('areaName')}
          value={newName}
          onChangeText={(v) => {
            setNewName(v);
            setAddError(null);
          }}
          onSubmitEditing={add}
          returnKeyType="done"
          maxLength={60}
          error={addError}
        />
        <Button
          title={t('addArea')}
          icon="add"
          onPress={add}
          disabled={!newName.trim()}
          loading={adding}
        />
      </Card>

      {!areas ? (
        loadError ? (
          <EmptyState icon="alert-circle-outline" tone="neutral" title={t('somethingWrong')} />
        ) : null
      ) : areas.length === 0 ? (
        <EmptyState icon="location-outline" title={t('noAreas')} body={t('customersNoAreasBody')} />
      ) : (
        <Card style={styles.list}>
          {areas.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 ? <Divider inset={size.avatar + space.md} /> : null}
              {editingId === a.id ? (
                <View style={styles.editRow}>
                  <Field
                    label={t('areaName')}
                    value={editName}
                    onChangeText={(v) => {
                      setEditName(v);
                      setRenameError(null);
                    }}
                    autoFocus
                    onSubmitEditing={saveRename}
                    returnKeyType="done"
                    maxLength={60}
                    error={renameError}
                  />
                  <Row justify="flex-end" gap={space.sm} wrap>
                    <Button title={t('cancel')} variant="text" onPress={() => setEditingId(null)} />
                    <Button title={t('save')} icon="checkmark" variant="tonal" onPress={saveRename} />
                  </Row>
                </View>
              ) : (
                <Row gap={space.md} style={styles.row}>
                  <TonalIcon name="location-outline" />
                  <View accessible accessibilityLabel={join([a.name, countLabel(a.customer_count)])} style={styles.text}>
                    <Txt>{a.name}</Txt>
                    <Txt variant="small">{countLabel(a.customer_count)}</Txt>
                  </View>
                  <IconButton
                    name="create-outline"
                    label={t('customersRenameArea', { name: a.name })}
                    onPress={() => startRename(a)}
                  />
                  <IconButton
                    name="trash-outline"
                    label={t('customersDeleteArea', { name: a.name })}
                    color={colors.danger}
                    onPress={() => confirmDelete(a.id, a.name)}
                  />
                </Row>
              )}
            </Fragment>
          ))}
        </Card>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  addCard: { gap: space.md },
  list: { gap: 0, paddingVertical: space.xs },
  row: { minHeight: 64, paddingVertical: space.xs },
  editRow: { gap: space.sm, paddingVertical: space.md },
  text: { flex: 1, gap: space.xxs },
});

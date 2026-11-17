/** Edit customer (docs/DESIGN.md 13.7). Owners and managers only, like the Edit button that opens it. */
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { CustomerForm } from '../../../components/CustomerForm';
import { EmptyState } from '../../../components/ui';
import { deleteCustomer, getCustomer, updateCustomer } from '../../../db/repo';
import { useQuery } from '../../../db/useQuery';
import { useApp } from '../../../state/app';

export default function EditCustomerScreen() {
  const db = useSQLiteContext();
  const { t, can, business } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: customer, loading } = useQuery((d) => getCustomer(d, id), [id]);

  // The Edit button is hidden without this permission; the route checks too (deep links).
  if (!can('customers.edit')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }
  if (loading && !customer) return null;
  // Only customers of the open business (a deep link could name any id).
  if (!customer || customer.business_id !== business?.id) {
    return <EmptyState icon="alert-circle-outline" tone="neutral" title={t('customerNotFound')} />;
  }

  const confirmDelete = () =>
    Alert.alert(t('deleteCustomer'), t('deleteCustomerConfirm', { name: customer.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          // Re-checked here: the role can change while the dialog is open.
          if (!can('customers.edit')) return;
          await deleteCustomer(db, customer.id);
          router.dismissAll();
        },
      },
    ]);

  return (
    <CustomerForm
      key={customer.id}
      initial={customer}
      onSubmit={async (input) => {
        // The fee isn't edited here; it changes on the fee screen.
        await updateCustomer(db, customer.id, input);
        router.back();
      }}
      onDelete={confirmDelete}
    />
  );
}

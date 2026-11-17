/** Add customer (docs/DESIGN.md 13.7). Owners and managers only, like every entry point to it. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { CustomerForm } from '../../components/CustomerForm';
import { EmptyState } from '../../components/ui';
import { createCustomer } from '../../db/repo';
import { useApp } from '../../state/app';

export default function NewCustomerScreen() {
  const db = useSQLiteContext();
  const { business, can, t } = useApp();

  // The add buttons are hidden without this permission; the route checks too (deep links).
  if (!can('customers.edit')) {
    return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  }

  return (
    <CustomerForm
      onSubmit={async (input) => {
        // Throwing shows the form's "Something went wrong" banner instead of a stuck spinner.
        if (!business) throw new Error('No active business');
        const id = await createCustomer(db, business.id, input);
        router.replace(`/customer/${id}`);
      }}
    />
  );
}

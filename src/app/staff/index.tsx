/** Screen 14: Staff management - add staff, set roles, see who collected how much. */
import { router } from 'expo-router';
import { View } from 'react-native';

import { PremiumGate } from '../../components/PremiumGate';
import { ListCard, Loading } from '../../components/settings/bits';
import { roleKey } from '../../components/settings/roles';
import { StaffRow } from '../../components/settings/rows';
import { Button, Divider, EmptyState, ListItem, Screen, SectionHeader, Txt } from '../../components/ui';
import { listStaff, reportByCollector } from '../../db/repo';
import { useQuery } from '../../db/useQuery';
import { currentMonthKey } from '../../lib/date';
import { useApp } from '../../state/app';

export default function StaffScreen() {
  const { t, business, can, monthLabel, staffLabel } = useApp();
  const bid = business?.id ?? '';
  const month = currentMonthKey();
  const { data: staff } = useQuery((d) => listStaff(d, bid), [bid]);
  const { data: collected } = useQuery((d) => reportByCollector(d, bid, month), [bid, month]);

  if (!can('staff.manage')) return <EmptyState icon="lock-closed-outline" tone="neutral" title={t('noAccess')} />;
  const collectedLabel = t('settingsCollectedInMonth', { month: monthLabel(month) });

  return (
    <PremiumGate>
      <Screen>
        <Txt variant="muted">{t('staffIntro')}</Txt>
        {staff === undefined ? (
          <Loading />
        ) : (
          <ListCard>
            {staff.map((s, i) => (
              <View key={s.id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <StaffRow
                  name={staffLabel(s)}
                  role={t(roleKey(s.role))}
                  hasPin={!!s.has_pin}
                  cloudWord={s.user_id ? t('cloudLinked') : s.invite_code ? t('invitePending') : null}
                  collectedLabel={collectedLabel}
                  collected={collected?.find((c) => c.staff_id === s.id)?.total ?? 0}
                  onPress={() => router.push({ pathname: '/staff/edit', params: { id: s.id } })}
                />
              </View>
            ))}
          </ListCard>
        )}
        <Button title={t('addStaff')} icon="person-add" variant="filled" onPress={() => router.push('/staff/edit')} />

        <SectionHeader title={t('rolesTitle')} />
        <ListCard>
          <ListItem icon="key-outline" title={t('roleOwner')} subtitle={t('roleOwnerDesc')} />
          <Divider inset={72} />
          <ListItem icon="briefcase-outline" title={t('roleManager')} subtitle={t('roleManagerDesc')} />
          <Divider inset={72} />
          <ListItem icon="wallet-outline" title={t('roleCollector')} subtitle={t('roleCollectorDesc')} />
        </ListCard>
      </Screen>
    </PremiumGate>
  );
}

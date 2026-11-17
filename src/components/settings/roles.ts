/** Staff role names for the settings screens. */
import type { StringKey } from '../../i18n/strings';

/** String key of a staff role's display name. */
export function roleKey(role: string | null | undefined): StringKey {
  return role === 'owner' ? 'roleOwner' : role === 'manager' ? 'roleManager' : 'roleCollector';
}

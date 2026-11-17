/**
 * What each staff role may do. Staff accounts are a premium feature; without
 * premium the phone's user is always the owner.
 */
import type { StaffRole } from '../db/types';

export type Action =
  | 'customers.edit' // add, edit and delete customers, areas and fees
  | 'payments.add'
  | 'payments.delete'
  | 'reminders.send'
  | 'reports.view'
  | 'backup' // make a backup file
  | 'backup.restore' // replace all data from a backup file (also replaces staff and removes PINs)
  | 'settings.business' // business info, templates, payment details, notifications
  | 'staff.manage'
  | 'businesses.manage' // add, switch and delete businesses
  | 'data.delete'
  | 'cloud.manage'
  | 'subscription';

const MANAGER: Action[] = [
  'customers.edit',
  'payments.add',
  'payments.delete',
  'reminders.send',
  'reports.view',
  'backup',
];
const COLLECTOR: Action[] = ['payments.add', 'reminders.send'];

export function can(role: StaffRole, action: Action): boolean {
  if (role === 'owner') return true;
  if (role === 'manager') return MANAGER.includes(action);
  return COLLECTOR.includes(action);
}

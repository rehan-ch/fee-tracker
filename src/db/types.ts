import type { DayKey, MonthKey } from '../lib/date';
import type { ChainDue, DueStatus } from '../lib/dues';

export type Language = 'en' | 'ur';
export type CustomerStatus = 'active' | 'inactive';
export type PaymentMethod = 'cash' | 'jazzcash' | 'easypaisa' | 'bank';
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'jazzcash', 'easypaisa', 'bank'];
export type StaffRole = 'owner' | 'manager' | 'collector';
export const STAFF_ROLES: StaffRole[] = ['owner', 'manager', 'collector'];
export type ReminderChannel = 'whatsapp' | 'sms';

interface Timestamps {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Business extends Timestamps {
  id: string;
  name: string;
  phone: string | null;
  currency: string;
  language: Language;
  reminder_template: string | null;
  /** Free text such as "JazzCash 0300-1234567 (Ali)". Premium. */
  payment_info: string | null;
  /** A payment page URL from the business's JazzCash/Easypaisa/bank merchant account. Premium. */
  payment_link: string | null;
}

export interface Area extends Timestamps {
  id: string;
  business_id: string;
  name: string;
}

export interface Customer extends Timestamps {
  id: string;
  business_id: string;
  area_id: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  monthly_fee: number;
  start_date: DayKey;
  status: CustomerStatus;
  notes: string | null;
}

export interface MonthlyDue extends ChainDue, Timestamps {
  customer_id: string;
  business_id: string;
}

export interface Payment extends Timestamps {
  id: string;
  monthly_due_id: string;
  customer_id: string;
  amount: number;
  paid_on: DayKey;
  method: PaymentMethod;
  received_by: string | null;
  note: string | null;
  business_id: string;
}

export interface FeeChange extends Timestamps {
  id: string;
  customer_id: string;
  business_id: string;
  old_fee: number;
  new_fee: number;
  effective_month: MonthKey;
  note: string | null;
}

export interface Staff extends Timestamps {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  role: StaffRole;
  user_id: string | null;
  invite_code: string | null;
}

export interface ReminderLog extends Timestamps {
  id: string;
  business_id: string;
  customer_id: string;
  monthly_due_id: string | null;
  channel: ReminderChannel;
  sent_at: string;
  sent_by: string | null;
}

/** A due row joined with the customer fields the lists need. */
export interface DueListRow extends MonthlyDue {
  customer_name: string;
  customer_phone: string | null;
  customer_notes: string | null;
  area_name: string | null;
  last_paid_on: DayKey | null;
  last_reminded_at: string | null;
}

export interface CustomerListRow extends Customer {
  area_name: string | null;
  balance: number | null;
  /** Fee for the current month (monthly_fee can be a scheduled future fee). */
  current_fee: number;
}

export interface MonthSummary {
  expected: number;
  carried: number;
  collected: number;
  pending: number;
  counts: Record<DueStatus, number>;
}

export interface CustomerInput {
  name: string;
  phone: string | null;
  address: string | null;
  area_id: string | null;
  monthly_fee: number;
  start_date: DayKey;
  status: CustomerStatus;
  notes: string | null;
}

export interface PaymentInput {
  monthly_due_id: string;
  amount: number;
  paid_on: DayKey;
  method: PaymentMethod;
  note: string | null;
  received_by?: string | null;
}

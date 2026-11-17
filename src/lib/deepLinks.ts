/**
 * Which screens may be opened from outside the app, and with what.
 *
 * - Links to the app's scheme (feetracker://...) can come from any other app
 *   or web page. Only the main tabs and the privacy policy open that way,
 *   with checked parameters; everything else opens Home. (Every screen also
 *   checks the user's role itself, so this is a second fence.)
 * - Tapping an owner alert opens the list it is about. The target is rebuilt
 *   from checked parts, never taken from the notification as it is.
 *
 * Pure functions (no React Native imports) so they are unit-tested.
 */
import { isMonthKey } from './date';
import { isSafeId } from './rowSchema';

const TABS = ['unpaid', 'partial', 'paid'];

type Query = Map<string, string>;

/** First value of each query parameter; malformed escapes make the value unusable, never an error. */
function parseQuery(query: string): Query {
  const out: Query = new Map();
  for (const pair of query.split('&')) {
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    if (!key || out.has(key)) continue;
    let value = eq >= 0 ? pair.slice(eq + 1) : '';
    try {
      value = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      value = '';
    }
    out.set(key, value);
  }
  return out;
}

/** Screens a link from outside may open, and the query parameters each keeps. */
const EXTERNAL: Record<string, (q: Query) => string> = {
  '': () => '',
  collection: (q) => collectionQuery(q.get('tab') ?? null, q.get('month') ?? null),
  customers: () => '',
  reports: () => '',
  settings: () => '',
  privacy: () => '',
};

function collectionQuery(tab: string | null, month: string | null): string {
  const parts: string[] = [];
  if (tab && TABS.includes(tab)) parts.push(`tab=${tab}`);
  if (isMonthKey(month)) parts.push(`month=${month}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Path and query of an incoming URL: feetracker://x/y?z, exp://host/--/x/y?z (Expo Go) or /x/y?z. */
function pathAndQuery(raw: string): string {
  const expoGo = /^exps?:\/\/[^/]*\/--\/(.*)$/i.exec(raw);
  if (expoGo) return expoGo[1];
  if (/^exps?:\/\//i.test(raw)) return '';
  const app = /^feetracker:(?:\/\/)?(.*)$/i.exec(raw);
  if (app) return app[1];
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '';
}

/**
 * The in-app path to open for a link from outside: one of the allowed
 * screens with checked parameters, or "/" (Home) for anything else.
 */
export function safeIncomingPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 2048) return '/';
  try {
    const rest = pathAndQuery(raw.trim());
    const q = rest.indexOf('?');
    const hash = rest.indexOf('#');
    const pathEnd = [q, hash].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), rest.length);
    const path = decodeURIComponent(rest.slice(0, pathEnd)).replace(/^\/+|\/+$/g, '');
    const query = q >= 0 ? rest.slice(q + 1, hash > q ? hash : undefined) : '';
    const build = Object.prototype.hasOwnProperty.call(EXTERNAL, path) ? EXTERNAL[path] : null;
    if (!build) return '/';
    return `/${path}${build(parseQuery(query))}`;
  } catch {
    return '/';
  }
}

export interface NotificationTarget {
  /** In-app path rebuilt from checked parts. */
  url: string;
  /** Business the alert is about, if it named a valid id. */
  businessId: string | null;
}

/**
 * Where an owner-alert tap may go: the unpaid list or the reminders screen
 * for a month (see lib/notify.ts). Anything else is ignored.
 */
export function notificationTarget(data: unknown): NotificationTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.url !== 'string' || d.url.length > 300) return null;
  const businessId = isSafeId(d.businessId) ? d.businessId : null;
  const [path, query = ''] = d.url.split('?', 2);
  const q = parseQuery(query);
  const month = q.get('month') ?? null;
  if (path === '/collection') {
    return { url: `/collection${collectionQuery(q.get('tab') ?? null, month)}`, businessId };
  }
  if (path === '/reminders') {
    return { url: isMonthKey(month) ? `/reminders?month=${month}` : '/reminders', businessId };
  }
  return null;
}

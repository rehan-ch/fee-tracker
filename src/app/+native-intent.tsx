/**
 * Expo Router hook for links that open the app from outside (the
 * feetracker:// scheme). Only a few screens may be opened that way; the
 * rules live in src/lib/deepLinks.ts.
 */
import { safeIncomingPath } from '../lib/deepLinks';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return safeIncomingPath(path);
}

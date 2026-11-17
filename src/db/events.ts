/**
 * Tiny change-notification store. Every database write bumps the version,
 * and screens that read data re-run their queries.
 */
import { useSyncExternalStore } from 'react';

let version = 0;
const listeners = new Set<() => void>();

export function notifyDataChanged(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

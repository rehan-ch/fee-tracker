import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { useDataVersion } from './events';

/**
 * Run an async database read and re-run it whenever data changes or `deps`
 * change. Keeps showing the previous result while a refresh is in flight,
 * so lists don't flicker.
 */
export function useQuery<T>(
  fn: (db: SQLiteDatabase) => Promise<T>,
  deps: readonly unknown[],
): { data: T | undefined; error: unknown; loading: boolean } {
  const db = useSQLiteContext();
  const version = useDataVersion();
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    // `fn` is captured from the render that scheduled this effect; it only
    // needs to re-run when the database, data version or `deps` change.
    fn(db).then(
      (data) => {
        if (!cancelled) setState({ data, error: undefined, loading: false });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ data: s.data, error, loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return state;
}

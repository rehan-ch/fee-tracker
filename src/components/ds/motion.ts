/**
 * Motion helpers (docs/DESIGN.md 10): RN core Animated only, transform and
 * opacity with the native driver, and no non-essential animation when the
 * system "remove animations" setting is on.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

import { motion } from '../../theme';

/** M3 standard and decelerate curves. */
export const easing = {
  standard: Easing.bezier(...motion.easing.standard),
  decelerate: Easing.bezier(...motion.easing.decelerate),
};

let cachedReduceMotion: boolean | null = null;
let pendingRead: Promise<boolean> | null = null;

function readReduceMotion(): Promise<boolean> {
  if (!pendingRead) {
    pendingRead = AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => (cachedReduceMotion = v))
      .catch(() => (cachedReduceMotion = false));
  }
  return pendingRead;
}

/** True when the user asked the system to reduce motion. Read once, then kept in sync. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(cachedReduceMotion ?? false);
  useEffect(() => {
    let alive = true;
    if (cachedReduceMotion === null) {
      readReduceMotion().then((v) => {
        if (alive) setReduce(v);
      });
    }
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      cachedReduceMotion = v;
      if (alive) setReduce(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

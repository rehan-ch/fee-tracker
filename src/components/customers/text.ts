/**
 * Small text helpers for the customers screens (docs/DESIGN.md 7.1, 11).
 */
import { useCallback } from 'react';

import { useApp } from '../../state/app';
import { bidiIsolate, joinA11y } from '../ui';

/**
 * Returns a function that wraps numbers, amounts and phone numbers in a
 * left-to-right isolate when Urdu is on, so "Rs 2,000" or "0300-1234567"
 * keep their order inside an Urdu sentence. English text is left unchanged.
 */
export function useLtr(): (s: string) => string {
  const { isRTL } = useApp();
  return useCallback((s: string) => (isRTL ? bidiIsolate(s) : s), [isRTL]);
}

/** Joins the parts of a combined accessibility label with the script's comma. */
export function useA11yJoin(): (parts: (string | null | undefined | false)[]) => string {
  const { isRTL } = useApp();
  return useCallback((parts: (string | null | undefined | false)[]) => joinA11y(parts, isRTL), [isRTL]);
}

/**
 * Whether the on-screen keyboard is open. The tab bar hides while it is, and
 * form screens drop the navigation-bar inset under their bottom action bar,
 * so the Save button sits right above the keyboard without a gap.
 */
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

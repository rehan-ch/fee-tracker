/**
 * Short "Saved" style messages. Android uses the system toast; other
 * platforms have none, so `ToastHost` (mounted once in the root layout)
 * shows the message in the app.
 */
import { Platform, ToastAndroid } from 'react-native';

export interface ToastMessage {
  id: number;
  text: string;
  long: boolean;
}

type Listener = (message: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Show a short message; `long` keeps it on screen a little longer. */
export function showToast(text: string, long = false): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(text, long ? ToastAndroid.LONG : ToastAndroid.SHORT);
    return;
  }
  const message = { id: nextId++, text, long };
  listeners.forEach((l) => l(message));
}

/** Used by ToastHost. Returns an unsubscribe function. */
export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

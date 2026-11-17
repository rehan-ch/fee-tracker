/**
 * Decorative 40dp tonal circle holding an icon (docs/DESIGN.md 7.5, 13.4):
 * welcome benefit rows and non-status notes. Hidden from TalkBack; the text
 * beside it carries the meaning. Same look as the shared TonalIcon (ui.tsx).
 */
import { TonalIcon, type IconName } from '../ui';

export function IconCircle({ icon, tone = 'primary' }: { icon: IconName; tone?: 'primary' | 'neutral' }) {
  return <TonalIcon name={icon} tone={tone} />;
}

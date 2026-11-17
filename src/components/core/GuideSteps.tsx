/**
 * Numbered mini guide (docs/DESIGN.md 13.1, no-customers state): a tonal
 * number circle and one line of text per step, in reading order. Each step is
 * read by TalkBack as one sentence ("Step 1: ...").
 */
import { StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { colors, radius, size, space } from '../../theme';
import { Txt } from '../ui';

export function GuideSteps({ title, steps }: { title?: string; steps: string[] }) {
  const { t, rowDir } = useApp();
  return (
    <View style={styles.list}>
      {title ? (
        <Txt variant="label" header>
          {title}
        </Txt>
      ) : null}
      {steps.map((text, i) => (
        <View
          key={text}
          accessible
          accessibilityLabel={t('coreStepLabel', { n: i + 1, text })}
          style={[styles.row, { flexDirection: rowDir }]}
        >
          <View style={styles.number}>
            <Txt variant="label" ltr center color={colors.onPrimaryContainer}>
              {String(i + 1)}
            </Txt>
          </View>
          <View style={styles.text}>
            <Txt>{text}</Txt>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  row: { alignItems: 'center', gap: space.md },
  // minWidth / minHeight (not a fixed size) so large font scales never clip the digit.
  number: {
    minWidth: size.avatar,
    minHeight: size.avatar,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
});

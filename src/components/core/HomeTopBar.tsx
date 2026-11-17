/**
 * Home's in-content top bar (docs/DESIGN.md 13.1): business Avatar, business
 * name on one line, an optional "Using as ..." line and the switch-business
 * button. Home has no tab header, so the screen pads this by the status bar.
 */
import { StyleSheet, View } from 'react-native';

import { useApp } from '../../state/app';
import { size, space } from '../../theme';
import { Avatar, IconButton, Row, Txt } from '../ui';

export function HomeTopBar({
  name,
  subtitle,
  onSwitchBusiness,
}: {
  name: string;
  /** Small second line, e.g. "Using as Ali". */
  subtitle?: string | null;
  /** Shown only when given (the caller keeps the role check). */
  onSwitchBusiness?: () => void;
}) {
  const { t } = useApp();
  return (
    <Row gap={space.md} style={styles.bar}>
      <Avatar name={name} />
      <View style={styles.text}>
        <Txt variant="title" numberOfLines={1} header>
          {name}
        </Txt>
        {subtitle ? (
          <Txt variant="small" numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {onSwitchBusiness ? (
        <IconButton
          name="swap-horizontal"
          label={t('switchBusiness')}
          variant="tonal"
          onPress={onSwitchBusiness}
        />
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: size.appBar },
  text: { flex: 1 },
});

/**
 * Full-screen view of a payment proof screenshot, with close and (when
 * allowed) remove. Dark backdrop so the picture reads as a photo, not a page.
 */
import { Image, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../../state/app';
import { space } from '../../theme';
import { IconButton, Row, Txt } from '../ui';

export function ProofViewer({
  uri,
  title,
  onClose,
  onRemove,
}: {
  uri: string | null;
  title: string;
  onClose: () => void;
  /** Shown only when the user may change payments; the caller asks for confirmation. */
  onRemove?: () => void;
}) {
  const { t } = useApp();
  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.backdrop} edges={['top', 'bottom']}>
        <Row gap={space.sm} justify="space-between" style={styles.bar}>
          <IconButton name="close" label={t('close')} color="#FFFFFF" onPress={onClose} />
          <View style={styles.flex}>
            <Txt variant="label" numberOfLines={1} center style={styles.title}>
              {title}
            </Txt>
          </View>
          {onRemove ? (
            <IconButton name="trash-outline" label={t('customersProofRemove')} color="#FFFFFF" onPress={onRemove} />
          ) : (
            <View style={styles.spacer} />
          )}
        </Row>
        {uri ? (
          <Image
            source={{ uri }}
            resizeMode="contain"
            accessibilityLabel={t('customersProofLabel')}
            style={styles.image}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000' },
  bar: { paddingHorizontal: space.xs, paddingVertical: space.xs },
  flex: { flex: 1 },
  title: { color: '#FFFFFF' },
  spacer: { width: 48 },
  image: { flex: 1, width: '100%' },
});

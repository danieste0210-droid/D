import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, FAB, HelperText, Modal, Portal, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';
import { useCancelSaleBatch, useMySaleBatches } from '@/features/sales/hooks';
import { getErrorMessage } from '@/api/client';
import type { SaleBatchSummary } from '@/api/sales';

const STATUS_LABEL: Record<SaleBatchSummary['status'], string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
};

function BatchRow({ batch, onOpen, onCancel }: { batch: SaleBatchSummary; onOpen: () => void; onCancel: () => void }) {
  return (
    <TouchableRipple onPress={onOpen}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium">#{batch.ticketCode}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {batch.lotteryNames.join(', ') || '(sin loterías)'}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {new Date(batch.createdAt).toLocaleString('es-PA')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="titleMedium">${batch.total.toFixed(2)}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {STATUS_LABEL[batch.status]}
          </Text>
          {batch.status === 'active' && (
            <Button compact onPress={onCancel} textColor={colors.danger} style={{ marginTop: 4 }}>
              Cancelar
            </Button>
          )}
        </View>
      </View>
    </TouchableRipple>
  );
}

// "Ventas": una sola fila por venta agrupada (batchId) -- una venta puede jugar varias loterías
// x tipos de apuesta a la vez, pero para el vendedor sigue siendo UN solo recibo/código/ID.
export default function SalesListScreen() {
  const { data: batches, isLoading, isRefetching, refetch } = useMySaleBatches();
  const cancelBatch = useCancelSaleBatch();

  const [batchToCancel, setBatchToCancel] = useState<SaleBatchSummary | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => {
    setBatchToCancel(null);
    setReason('');
    setError(null);
  };

  const handleConfirmCancel = async () => {
    if (!batchToCancel || reason.trim().length < 3) return;
    try {
      await cancelBatch.mutateAsync({ batchId: batchToCancel.batchId, reason: reason.trim() });
      closeModal();
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cancelar (¿alguna lotería ya cerró?)'));
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.brand} />
      ) : (
        <FlatList
          data={batches ?? []}
          keyExtractor={(item) => item.batchId}
          renderItem={({ item }) => (
            <BatchRow
              batch={item}
              onOpen={() => router.push({ pathname: '/(app)/sales/receipt', params: { batchId: item.batchId } })}
              onCancel={() => setBatchToCancel(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={batches?.length ? undefined : styles.emptyContainer}
          ListEmptyComponent={<Text style={styles.muted}>Todavía no hay ventas registradas</Text>}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} colors={[colors.brand]} />}
        />
      )}
      <FAB
        icon="plus"
        style={styles.fab}
        color="white"
        customSize={56}
        onPress={() => router.push('/(app)/sales/new')}
      />

      <Portal>
        <Modal visible={!!batchToCancel} onDismiss={closeModal} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>
            Cancelar venta #{batchToCancel?.ticketCode}
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
            Cancela TODAS las loterías de esta venta a la vez. Esta acción queda registrada en el log de auditoría.
          </Text>
          <TextInput label="Motivo" value={reason} onChangeText={setReason} multiline style={styles.field} />
          {error && <HelperText type="error">{error}</HelperText>}
          <Button
            mode="contained"
            onPress={handleConfirmCancel}
            loading={cancelBatch.isPending}
            disabled={reason.trim().length < 3}
            buttonColor={colors.danger}
          >
            Confirmar cancelación
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  row: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.brand },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12 },
  field: { marginBottom: 12 },
});

import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, FAB, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';
import { useCancelSale, useMySales } from '@/features/sales/hooks';
import type { Sale } from '@/api/sales';

const STATUS_LABEL: Record<Sale['status'], string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  paid: 'Pagada',
};

function SaleRow({ sale, onCancel }: { sale: Sale; onCancel: (sale: Sale) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">#{sale.numberPlayed}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {new Date(sale.createdAt).toLocaleString('es-PA')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="titleMedium">${Number(sale.amount).toFixed(2)}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {STATUS_LABEL[sale.status]}
        </Text>
        {sale.status === 'active' && (
          <Button compact onPress={() => onCancel(sale)} textColor={colors.danger} style={{ marginTop: 4 }}>
            Cancelar
          </Button>
        )}
      </View>
    </View>
  );
}

// TODO(sales/index): pull del historial completo con paginación cuando crezca.
export default function SalesListScreen() {
  const { data: sales, isLoading, isRefetching, refetch } = useMySales();
  const cancelSale = useCancelSale();

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => {
    setSaleToCancel(null);
    setReason('');
    setError(null);
  };

  const handleConfirmCancel = async () => {
    if (!saleToCancel || reason.trim().length < 3) return;
    try {
      await cancelSale.mutateAsync({ id: saleToCancel.id, reason: reason.trim() });
      closeModal();
    } catch {
      // El servidor rechaza la cancelación si la lotería ya cerró -- ver sales.service.cancelBySeller.
      setError('No se pudo cancelar (¿la lotería ya cerró?)');
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.brand} />
      ) : (
        <FlatList
          data={sales ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SaleRow sale={item} onCancel={setSaleToCancel} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={sales?.length ? undefined : styles.emptyContainer}
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
        <Modal visible={!!saleToCancel} onDismiss={closeModal} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>
            Cancelar venta #{saleToCancel?.numberPlayed}
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
            Esta acción queda registrada en el log de auditoría.
          </Text>
          <TextInput label="Motivo" value={reason} onChangeText={setReason} multiline style={styles.field} />
          {error && <HelperText type="error">{error}</HelperText>}
          <Button
            mode="contained"
            onPress={handleConfirmCancel}
            loading={cancelSale.isPending}
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

import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Modal, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useAllSales, useAdminCancelSale } from '@/features/sales/hooks';
import type { Sale } from '@/api/sales';

function SaleRow({ sale, onCancel }: { sale: Sale; onCancel: (sale: Sale) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">
          #{sale.numberPlayed} · ${Number(sale.amount).toFixed(2)}
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {sale.ticketCode} · {new Date(sale.createdAt).toLocaleString('es-PA')} · {sale.status}
        </Text>
      </View>
      {sale.status === 'active' && (
        <Button compact onPress={() => onCancel(sale)} textColor={colors.danger}>
          Eliminar
        </Button>
      )}
    </View>
  );
}

// "Eliminar Ventas": cancelación administrativa, sin restricción de cierre (a diferencia de la
// cancelación propia del vendedor), siempre auditada con motivo.
export default function DeleteSalesScreen() {
  const { data: sales, isLoading } = useAllSales();
  const adminCancelSale = useAdminCancelSale();

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const closeModal = () => {
    setSaleToCancel(null);
    setReason('');
  };

  const handleConfirm = async () => {
    if (!saleToCancel || reason.trim().length < 3) return;
    try {
      await adminCancelSale.mutateAsync({ id: saleToCancel.id, reason: reason.trim() });
      setSnackbar(`Venta #${saleToCancel.numberPlayed} eliminada`);
    } catch {
      setSnackbar('No se pudo eliminar la venta');
    } finally {
      closeModal();
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
          ListEmptyComponent={<Text style={[styles.muted, { padding: 20 }]}>No hay ventas registradas</Text>}
        />
      )}

      <Portal>
        <Modal visible={!!saleToCancel} onDismiss={closeModal} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 16 }}>
            Eliminar venta #{saleToCancel?.numberPlayed}
          </Text>
          <TextInput label="Motivo" value={reason} onChangeText={setReason} multiline style={styles.field} />
          <Button
            mode="contained"
            onPress={handleConfirm}
            loading={adminCancelSale.isPending}
            disabled={reason.trim().length < 3}
            buttonColor={colors.danger}
          >
            Confirmar eliminación
          </Button>
        </Modal>
      </Portal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12 },
  field: { marginBottom: 12 },
});

import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, Text } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useLastSale } from '@/features/sales/hooks';

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  paid: 'Pagada',
};

// "Última Venta": para que el vendedor confirme rápido qué fue lo último que vendió
// (ej. si el cliente reclama un ticket o hay dudas tras un corte de conexión).
export default function LastSaleScreen() {
  const { data: sale, isLoading } = useLastSale();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.container}>
        <Text style={[styles.muted, { padding: 24 }]}>Todavía no has registrado ninguna venta.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text variant="headlineMedium">#{sale.numberPlayed}</Text>
        <Text variant="titleLarge" style={{ marginTop: 4 }}>
          ${Number(sale.amount).toFixed(2)}
        </Text>
        <Chip compact style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          {STATUS_LABELS[sale.status] ?? sale.status}
        </Chip>
        <Text variant="bodyMedium" style={[styles.muted, { marginTop: 16 }]}>
          Ticket: {sale.ticketCode}
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {new Date(sale.createdAt).toLocaleString('es-PA')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: 20, padding: 24, backgroundColor: colors.surface, borderRadius: 12 },
  muted: { color: colors.textMuted },
});

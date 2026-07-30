import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useLastSale } from '@/features/sales/hooks';

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  cancelled: 'Cancelada',
  paid: 'Pagada',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// "Última Venta": para que el vendedor confirme rápido qué fue lo último que vendió en un día
// dado (ej. si el cliente reclama un ticket o hay dudas tras un corte de conexión).
export default function LastSaleScreen() {
  const [date, setDate] = useState(todayISO());
  const { data: sale, isLoading, refetch } = useLastSale(date);

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <View style={styles.dateRow}>
          <TextInput label="Fecha (YYYY-MM-DD)" value={date} onChangeText={setDate} style={{ flex: 1 }} />
          <Button mode="outlined" onPress={() => refetch()} textColor={colors.brandDark}>
            Buscar
          </Button>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 24 }} />
      ) : !sale ? (
        <Text style={[styles.muted, { padding: 24 }]}>No existen ventas para esta fecha.</Text>
      ) : (
        <View style={styles.card}>
          <Text variant="headlineMedium">#{sale.numberPlayed}</Text>
          <Text variant="titleLarge" style={{ marginTop: 4 }}>
            ${Number(sale.amount).toFixed(2)}
          </Text>
          <Chip compact style={{ marginTop: 12, alignSelf: 'flex-start' }}>
            {STATUS_LABELS[sale.status] ?? sale.status}
          </Chip>
          {(sale.customerName || sale.customerPhone) && (
            <Text variant="bodyMedium" style={[styles.muted, { marginTop: 12 }]}>
              {sale.customerName} {sale.customerPhone ? `· ${sale.customerPhone}` : ''}
            </Text>
          )}
          <Text variant="bodyMedium" style={[styles.muted, { marginTop: 12 }]}>
            Ticket: {sale.ticketCode}
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            {new Date(sale.createdAt).toLocaleString('es-PA')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20, backgroundColor: colors.surface },
  dateRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  card: { margin: 20, padding: 24, backgroundColor: colors.surface, borderRadius: 12 },
  muted: { color: colors.textMuted },
});

import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/theme/colors';
import { getGlobalSales } from '@/api/reports';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function GlobalSalesScreen() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['global-sales', from, to],
    queryFn: () => getGlobalSales(from, to),
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
          Ventas globales
        </Text>

        <View style={styles.dateRow}>
          <TextInput label="Desde (YYYY-MM-DD)" value={from} onChangeText={setFrom} style={[styles.field, { flex: 1 }]} />
          <TextInput label="Hasta (YYYY-MM-DD)" value={to} onChangeText={setTo} style={[styles.field, { flex: 1 }]} />
        </View>
        <Button mode="outlined" onPress={() => refetch()} style={{ marginBottom: 16 }} textColor={colors.brandDark}>
          Actualizar
        </Button>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCell}>
              <Text variant="bodySmall" style={styles.muted}>
                Ventas
              </Text>
              <Text variant="titleLarge">${(data?.totalSales ?? 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryCell}>
              <Text variant="bodySmall" style={styles.muted}>
                Premios
              </Text>
              <Text variant="titleLarge" style={{ color: colors.danger }}>
                ${(data?.totalPrizes ?? 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text variant="bodySmall" style={styles.muted}>
                Neto
              </Text>
              <Text variant="titleLarge" style={{ color: colors.success }}>
                ${(data?.netAmount ?? 0).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Desglose por número
      </Text>
      <FlatList
        data={data?.numbersBreakdown ?? []}
        keyExtractor={(item) => item.number}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text variant="titleMedium">#{item.number}</Text>
            <Text variant="bodySmall" style={styles.muted}>
              {item.count} venta(s)
            </Text>
            <Text variant="titleMedium" style={{ marginLeft: 'auto' }}>
              ${item.amount.toFixed(2)}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={[styles.muted, { padding: 20 }]}>Sin datos en el rango seleccionado</Text>}
        scrollEnabled={false}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20, backgroundColor: colors.surface },
  dateRow: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 12 },
  muted: { color: colors.textMuted },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryCell: { alignItems: 'center', flex: 1 },
  sectionTitle: { marginTop: 20, marginBottom: 8, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
});

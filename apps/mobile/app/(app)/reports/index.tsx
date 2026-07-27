import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import * as Sharing from 'expo-sharing';
import { colors } from '@/theme/colors';
import { downloadSalesReport, getSalesSummary, type SalesSummaryRow } from '@/api/reports';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// TODO(reports): gráficas del dashboard (ventas del día, comisiones, premios pagados) --
// hoy solo el resumen agregado y la descarga de Excel/PDF.
export default function ReportsScreen() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [downloading, setDownloading] = useState<'excel' | 'pdf' | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['reports-sales', from, to],
    queryFn: () => getSalesSummary(from, to),
  });

  const totalAmount = (summary ?? []).reduce((sum: number, row: SalesSummaryRow) => sum + Number(row._sum.amount ?? 0), 0);
  const totalSales = (summary ?? []).reduce((sum: number, row: SalesSummaryRow) => sum + row._count, 0);

  const handleDownload = async (format: 'excel' | 'pdf') => {
    setDownloading(format);
    try {
      const uri = await downloadSalesReport(format, from, to);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        setSnackbar(`Archivo guardado: ${uri}`);
      }
    } catch {
      setSnackbar('No se pudo generar el reporte');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
          Resumen de ventas
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
          <>
            <Text variant="bodyMedium" style={styles.muted}>
              {totalSales} venta(s) en {(summary ?? []).length} agrupación(es) vendedor/lotería
            </Text>
            <Text variant="titleLarge" style={{ marginTop: 4 }}>
              Total: ${totalAmount.toFixed(2)}
            </Text>
          </>
        )}

        <View style={styles.downloadRow}>
          <Button
            mode="contained"
            onPress={() => handleDownload('excel')}
            loading={downloading === 'excel'}
            disabled={!!downloading}
            buttonColor={colors.brand}
            style={{ flex: 1 }}
          >
            Excel
          </Button>
          <Button
            mode="contained"
            onPress={() => handleDownload('pdf')}
            loading={downloading === 'pdf'}
            disabled={!!downloading}
            buttonColor={colors.brandDark}
            style={{ flex: 1 }}
          >
            PDF
          </Button>
        </View>
      </View>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20, backgroundColor: colors.surface },
  dateRow: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 12 },
  muted: { color: colors.textMuted },
  downloadRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
});

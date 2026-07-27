import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, List, Snackbar, Text } from 'react-native-paper';
import type { Device } from 'react-native-ble-plx';
import { colors } from '@/theme/colors';
import { usePrinterStore } from '@/printing/printerStore';
import { printTicket, requestBluetoothPermissions, scanForPrinters } from '@/printing/blePrinter';
import { buildSaleTicket } from '@/printing/escpos';

// Pantalla de emparejamiento -- NO alcanzable desde Expo Go: react-native-ble-plx es un módulo
// nativo, requiere un development build de EAS. No se pudo probar contra hardware real en este
// entorno (ver NEXT_STEPS.md).
export default function PrinterSettingsScreen() {
  const { deviceId, deviceName, setPrinter, hydrate, clear } = usePrinterStore();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [testing, setTesting] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const handleScan = async () => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      setSnackbar('Se necesitan permisos de Bluetooth para buscar impresoras');
      return;
    }

    setDevices([]);
    setScanning(true);
    const stopScan = scanForPrinters((device) => {
      setDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device]));
    }, 8000);

    setTimeout(() => {
      stopScan();
      setScanning(false);
    }, 8000);
  };

  const handlePair = async (device: Device) => {
    await setPrinter(device.id, device.name ?? device.id);
    setSnackbar(`Impresora "${device.name}" emparejada`);
  };

  const handleTestPrint = async () => {
    if (!deviceId) return;
    setTesting(true);
    try {
      const ticket = buildSaleTicket({
        lotteryName: 'Impresora de prueba',
        numberPlayed: '00',
        amount: 0,
        ticketCode: 'TEST-PRINT',
        sellerName: 'CloverApp',
        createdAt: new Date().toISOString(),
      });
      await printTicket(deviceId, ticket);
      setSnackbar('Ticket de prueba enviado');
    } catch (err) {
      setSnackbar(`No se pudo imprimir: ${err instanceof Error ? err.message : 'error desconocido'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
          Impresora emparejada
        </Text>
        {deviceId ? (
          <View style={styles.pairedRow}>
            <Chip icon="printer">{deviceName}</Chip>
            <Button onPress={() => clear()} textColor={colors.danger}>
              Olvidar
            </Button>
          </View>
        ) : (
          <Text style={styles.muted}>Ninguna impresora emparejada todavía</Text>
        )}

        {deviceId && (
          <Button mode="outlined" onPress={handleTestPrint} loading={testing} style={{ marginTop: 12 }} textColor={colors.brandDark}>
            Imprimir ticket de prueba
          </Button>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
          Buscar impresoras Bluetooth
        </Text>
        <Button mode="contained" onPress={handleScan} loading={scanning} buttonColor={colors.brand}>
          {scanning ? 'Buscando…' : 'Buscar'}
        </Button>
      </View>

      {scanning && <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />}

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.name ?? item.id}
            description={item.id}
            left={(props) => <List.Icon {...props} icon="bluetooth" />}
            onPress={() => handlePair(item)}
          />
        )}
        ListEmptyComponent={
          !scanning ? <Text style={[styles.muted, { padding: 20 }]}>Sin resultados. Presiona "Buscar".</Text> : null
        }
      />

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: { padding: 20, backgroundColor: colors.surface, marginBottom: 8 },
  pairedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.textMuted },
});

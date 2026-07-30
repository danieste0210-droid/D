import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, HelperText, IconButton, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { useLotteriesForDay } from '@/features/lotteries/hooks';
import { useCreateBatchSale } from '@/features/sales/hooks';
import { getErrorMessage } from '@/api/client';
import type { BatchSaleItem, BetType, Sale } from '@/api/sales';
import type { LotteryForDay } from '@/api/lotteries';
import { usePrinterStore } from '@/printing/printerStore';
import { printTicket } from '@/printing/blePrinter';
import { buildSaleTicket } from '@/printing/escpos';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type AmountUnit = 'plata' | 'viles';
// 1 vil = $0.25 (4 viles = $1) -- unidad menor en la que algunos vendedores prefieren apostar.
const VILE_VALUE = 0.25;

interface CartEntry {
  id: string;
  numberPlayed: string;
  betType: BetType;
  amount: number;
}

function effectiveCloseLabel(lottery: LotteryForDay): string {
  const closure = lottery.closures[0];
  if (!closure) return '';
  return closure.openTime ? `${closure.openTime} - ${closure.closeTime}` : closure.closeTime;
}

function parseAmount(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const value = parseFloat(raw.replace(',', '.'));
  return Number.isNaN(value) || value <= 0 ? undefined : value;
}

// El carrito y el backend siempre trabajan en dólares -- en modo "viles" el vendedor escribe
// la cantidad de viles y aquí se convierte a su equivalente en dólares antes de usarse.
function toDollars(raw: string, unit: AmountUnit): number | undefined {
  const value = parseAmount(raw);
  if (value == null) return undefined;
  return unit === 'viles' ? value * VILE_VALUE : value;
}

// "Números y Valores": asistente de 2 pasos. Paso 1 elige una o varias loterías abiertas hoy
// (los mismos números se juegan en TODAS las seleccionadas). Paso 2 arma un carrito: cada número
// puede jugarse recto, combinado y/o palet a la vez -- cada monto presente genera su propia venta.
export default function NewSaleScreen() {
  const todayDayOfWeek = new Date().getDay();
  const { data: lotteries, isLoading: loadingLotteries } = useLotteriesForDay(todayDayOfWeek);
  const createBatchSale = useCreateBatchSale();
  const sellerName = useAuthStore((s) => s.user?.name) ?? '';
  const printerDeviceId = usePrinterStore((s) => s.deviceId);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLotteryIds, setSelectedLotteryIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [numberPlayed, setNumberPlayed] = useState('');
  const [unit, setUnit] = useState<AmountUnit>('plata');
  const [rectoValue, setRectoValue] = useState('');
  const [combinadoValue, setCombinadoValue] = useState('');
  const [paletValue, setPaletValue] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const selectedLotteries = (lotteries ?? []).filter((l: LotteryForDay) => selectedLotteryIds.includes(l.id));
  const pendingTotal = (toDollars(rectoValue, unit) ?? 0) + (toDollars(combinadoValue, unit) ?? 0) + (toDollars(paletValue, unit) ?? 0);
  // El carrito se juega en TODAS las loterías seleccionadas -- el total a cobrar es el del
  // carrito multiplicado por la cantidad de loterías marcadas, no solo la suma del carrito.
  const cartTotal = cart.reduce((sum, item) => sum + item.amount, 0) * Math.max(selectedLotteryIds.length, 1);

  const toggleLottery = (id: string) => {
    setSelectedLotteryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSumar = () => {
    if (!numberPlayed.trim()) return;
    const rectoAmount = toDollars(rectoValue, unit);
    const combinadoAmount = toDollars(combinadoValue, unit);
    const paletAmount = toDollars(paletValue, unit);
    if (rectoAmount == null && combinadoAmount == null && paletAmount == null) return;

    const newEntries: CartEntry[] = [];
    if (rectoAmount != null) newEntries.push({ id: `${Date.now()}-recto`, numberPlayed: numberPlayed.trim(), betType: 'recto', amount: rectoAmount });
    if (combinadoAmount != null) newEntries.push({ id: `${Date.now()}-combinado`, numberPlayed: numberPlayed.trim(), betType: 'combinado', amount: combinadoAmount });
    if (paletAmount != null) newEntries.push({ id: `${Date.now()}-palet`, numberPlayed: numberPlayed.trim(), betType: 'palet', amount: paletAmount });

    setCart((prev) => [...prev, ...newEntries]);
    setNumberPlayed('');
    setRectoValue('');
    setCombinadoValue('');
    setPaletValue('');
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Best-effort: la impresión nunca debe bloquear ni fallar el flujo de venta.
  const tryPrintAll = (sales: Sale[]) => {
    if (!printerDeviceId) return;
    for (const sale of sales) {
      const lottery = selectedLotteries.find((l: LotteryForDay) => l.id === sale.lotteryId);
      const ticket = buildSaleTicket({
        lotteryName: lottery?.name ?? '',
        numberPlayed: sale.numberPlayed,
        amount: Number(sale.amount),
        ticketCode: sale.ticketCode,
        sellerName,
        createdAt: sale.createdAt,
      });
      printTicket(printerDeviceId, ticket).catch(() => {
        // TODO(printing): avisar al vendedor qué ticket no se imprimió.
      });
    }
  };

  const handleProcesar = async () => {
    if (cart.length === 0 || selectedLotteryIds.length === 0) return;
    setError(null);

    const items: BatchSaleItem[] = [];
    for (const entry of cart) {
      let item = items.find((i) => i.numberPlayed === entry.numberPlayed);
      if (!item) {
        item = { numberPlayed: entry.numberPlayed };
        items.push(item);
      }
      if (entry.betType === 'recto') item.rectoAmount = entry.amount;
      if (entry.betType === 'combinado') item.combinadoAmount = entry.amount;
      if (entry.betType === 'palet') item.paletAmount = entry.amount;
    }

    try {
      const sales = await createBatchSale.mutateAsync({
        lotteryIds: selectedLotteryIds,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items,
      });
      tryPrintAll(sales);
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo procesar el carrito (revisa conexión y horarios de cierre)'));
    }
  };

  if (step === 1) {
    return (
      <View style={styles.container}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Loterías
        </Text>
        <Text variant="bodySmall" style={[styles.muted, { paddingHorizontal: 20 }]}>
          Hoy — {DAY_LABELS[todayDayOfWeek]}
        </Text>

        <FlatList
          data={lotteries ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Checkbox
                status={selectedLotteryIds.includes(item.id) ? 'checked' : 'unchecked'}
                onPress={() => toggleLottery(item.id)}
                color={colors.brand}
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">{item.name}</Text>
                <Text variant="bodySmall" style={styles.muted}>
                  {effectiveCloseLabel(item)}
                </Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={[styles.muted, { padding: 20 }]}>
              {loadingLotteries ? 'Cargando...' : 'No hay loterías abiertas hoy'}
            </Text>
          }
        />

        <Button
          mode="contained"
          onPress={() => setStep(2)}
          disabled={selectedLotteryIds.length === 0}
          buttonColor={colors.brand}
          style={styles.nextButton}
        >
          Siguiente
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Button mode="text" onPress={() => setStep(1)} textColor={colors.brandDark} compact style={{ alignSelf: 'flex-start' }}>
          ← Cambiar loterías
        </Button>

        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
          Números y Valores
        </Text>
        <View style={styles.chipsRow}>
          {selectedLotteries.map((l: LotteryForDay) => (
            <View key={l.id} style={styles.chip}>
              <Text style={{ color: colors.brandDark }}>{l.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.fieldsRow}>
          <TextInput label="Nombre" value={customerName} onChangeText={setCustomerName} style={[styles.field, { flex: 1 }]} />
          <TextInput label="Teléfono" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" style={[styles.field, { flex: 1 }]} />
        </View>

        <SegmentedButtons
          value={unit}
          onValueChange={(v) => setUnit(v as AmountUnit)}
          style={{ marginBottom: 12 }}
          buttons={[
            { value: 'plata', label: 'Plata' },
            { value: 'viles', label: 'Viles (1 = $0.25)' },
          ]}
        />

        <View style={styles.fieldsRow}>
          <TextInput label="Número" value={numberPlayed} onChangeText={setNumberPlayed} keyboardType="number-pad" style={[styles.field, { flex: 1 }]} />
          <TextInput
            label={unit === 'viles' ? 'Valor (viles)' : '$Valor'}
            value={rectoValue}
            onChangeText={setRectoValue}
            keyboardType="decimal-pad"
            style={[styles.field, { flex: 1 }]}
          />
        </View>
        <View style={styles.fieldsRow}>
          <TextInput
            label={unit === 'viles' ? 'Combinado (viles)' : '$Combinado'}
            value={combinadoValue}
            onChangeText={setCombinadoValue}
            keyboardType="decimal-pad"
            style={[styles.field, { flex: 1 }]}
          />
          <TextInput
            label={unit === 'viles' ? 'Palet (viles)' : '$Palet'}
            value={paletValue}
            onChangeText={setPaletValue}
            keyboardType="decimal-pad"
            style={[styles.field, { flex: 1 }]}
          />
        </View>

        <Button mode="contained" onPress={handleSumar} disabled={!numberPlayed.trim() || pendingTotal <= 0} buttonColor={colors.brand} style={{ marginBottom: 16 }}>
          Sumar — ${pendingTotal.toFixed(2)}
        </Button>

        <FlatList
          data={cart}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cartRow}>
              <Text style={styles.cartCell}>{item.numberPlayed}</Text>
              <Text style={styles.cartCell}>{item.betType === 'recto' ? `$${item.amount.toFixed(2)}` : '-'}</Text>
              <Text style={styles.cartCell}>{item.betType === 'combinado' ? `$${item.amount.toFixed(2)}` : '-'}</Text>
              <Text style={styles.cartCell}>{item.betType === 'palet' ? `$${item.amount.toFixed(2)}` : '-'}</Text>
              <IconButton icon="delete-outline" iconColor={colors.danger} size={18} onPress={() => removeFromCart(item.id)} />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={[styles.muted, { paddingVertical: 12 }]}>El carrito está vacío</Text>}
          scrollEnabled={false}
        />

        {error && <HelperText type="error">{error}</HelperText>}

        <Button
          mode="contained"
          onPress={handleProcesar}
          loading={createBatchSale.isPending}
          disabled={cart.length === 0 || createBatchSale.isPending}
          buttonColor={colors.brand}
          style={{ marginTop: 16 }}
        >
          Procesar ${cartTotal.toFixed(2)}
        </Button>
      </View>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20 },
  sectionTitle: { marginTop: 16, marginBottom: 4, paddingHorizontal: 20 },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  nextButton: { margin: 20 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { backgroundColor: colors.brandLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  fieldsRow: { flexDirection: 'row', gap: 12 },
  field: { marginBottom: 12 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  cartCell: { flex: 1, fontSize: 13 },
});

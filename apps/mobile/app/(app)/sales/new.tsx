import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Snackbar, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { useLotteries } from '@/features/lotteries/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Lottery } from '@/api/lotteries';
import { useCreateSale } from '@/features/sales/hooks';
import { ApiError, type Sale } from '@/api/sales';
import { enqueueSale } from '@/offline/queue';
import { usePrinterStore } from '@/printing/printerStore';
import { printTicket } from '@/printing/blePrinter';
import { buildSaleTicket } from '@/printing/escpos';

export default function NewSaleScreen() {
  const { data: lotteries } = useLotteries();
  const createSale = useCreateSale();
  const sellerName = useAuthStore((s) => s.user?.name) ?? '';
  const printerDeviceId = usePrinterStore((s) => s.deviceId);

  const [lotteryId, setLotteryId] = useState<string | null>(null);
  const [numberPlayed, setNumberPlayed] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const selectedLottery = lotteries?.find((l: Lottery) => l.id === lotteryId);
  const amountValue = parseFloat(amount.replace(',', '.'));
  const isValid = !!lotteryId && numberPlayed.trim().length > 0 && amountValue > 0;

  // Best-effort: la impresión nunca debe bloquear ni fallar el flujo de venta. Se dispara sin
  // esperar (fire-and-forget) para que una impresora lenta/desconectada no trabe la navegación.
  const tryPrint = (sale: Sale) => {
    if (!printerDeviceId || !selectedLottery) return;
    const ticket = buildSaleTicket({
      lotteryName: selectedLottery.name,
      numberPlayed: sale.numberPlayed,
      amount: Number(sale.amount),
      ticketCode: sale.ticketCode,
      sellerName,
      createdAt: sale.createdAt,
    });
    printTicket(printerDeviceId, ticket).catch(() => {
      // TODO(printing): avisar al vendedor que el ticket no se imprimió (snackbar aparece
      // después de router.back(), así que hoy se pierde silenciosamente).
    });
  };

  const handleSubmit = async () => {
    if (!isValid || !lotteryId) return;
    setError(null);

    const payload = { lotteryId, numberPlayed: numberPlayed.trim(), amount: amountValue };

    try {
      const sale = await createSale.mutateAsync(payload);
      tryPrint(sale);
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        const message = typeof err.body === 'object' && err.body && 'message' in err.body ? String((err.body as any).message) : 'No se pudo registrar la venta';
        setError(message);
        return;
      }
      // No hay conexión: se encola para sincronizar después (ver src/offline/queue.ts).
      // No se imprime ticket para ventas encoladas -- no hay número de ticket confirmado por el
      // servidor todavía (se genera recién cuando sales.service.create() la procesa).
      await enqueueSale({ id: randomUUID(), ...payload, createdAt: new Date().toISOString() });
      setSnackbar('Sin conexión: la venta quedó guardada y se enviará automáticamente');
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <PlatformPicker
        options={(lotteries ?? []).map((l: Lottery) => ({ value: l.id, label: l.name }))}
        value={lotteryId}
        onChange={setLotteryId}
        placeholder="Seleccionar lotería"
        textColor={colors.brandDark}
        style={styles.field}
      />

      <TextInput
        label="Número jugado"
        value={numberPlayed}
        onChangeText={setNumberPlayed}
        keyboardType="number-pad"
        style={styles.field}
      />
      <TextInput label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.field} />

      {error && <HelperText type="error">{error}</HelperText>}

      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={createSale.isPending}
        disabled={!isValid || createSale.isPending}
        buttonColor={colors.brand}
        style={styles.submit}
      >
        Registrar venta
      </Button>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  field: { marginBottom: 16 },
  submit: { marginTop: 8 },
});

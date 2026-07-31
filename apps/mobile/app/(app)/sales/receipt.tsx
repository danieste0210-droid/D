import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Checkbox, HelperText, IconButton, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@/theme/colors';
import { QrCode } from '@/components/QrCode';
import {
  useAddLotteryToBatch,
  useCancelSaleBatch,
  useRemoveLotteryFromBatch,
  useSaleBatch,
} from '@/features/sales/hooks';
import { useLotteriesForDay } from '@/features/lotteries/hooks';
import { getErrorMessage } from '@/api/client';
import type { SaleBatchLottery } from '@/api/sales';
import type { LotteryForDay } from '@/api/lotteries';
import { usePrinterStore } from '@/printing/printerStore';
import { printTicket } from '@/printing/blePrinter';
import { buildSaleTicket } from '@/printing/escpos';

const BET_TYPE_LABEL: Record<string, string> = { recto: 'Recto', combinado: 'Combinado', palet: 'Palet' };

function buildQrPayload(batch: { batchId: string; ticketCode: string; lotteries: SaleBatchLottery[] }): string {
  return JSON.stringify({
    ticketCode: batch.ticketCode,
    loterias: batch.lotteries.map((l) => ({
      loteria: l.lotteryName,
      jugadas: l.lines.map((line) => ({ numero: line.numberPlayed, tipo: line.betType, monto: line.amount })),
    })),
  });
}

function multiplierLine(lottery: SaleBatchLottery): string {
  const [p1, p2, p3] = lottery.multipliers.rectoDosCifras;
  const [mayor, menor] = lottery.multipliers.paletTiers;
  return `2 CIFRAS: ${p1}x1 | ${p2}x1 | ${p3}x1\nCHANCE 3 CIFRAS: ${lottery.multipliers.chance3Multiplier}x1\nPALE: ${mayor}x1 | ${menor}x1`;
}

// "Resumen de venta": el recibo/visor único de una venta agrupada (un batchId, un código, todas
// sus loterías y jugadas juntas) -- se abre tanto justo después de "Procesar" como al tocar una
// venta desde la lista de "Ventas". Permite cancelar la venta completa o agregar/quitar loterías
// sin tener que rehacer todo el carrito.
export default function SaleReceiptScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const { data: batch, isLoading } = useSaleBatch(batchId);
  const todayDayOfWeek = new Date().getDay();
  const { data: lotteriesToday } = useLotteriesForDay(todayDayOfWeek);
  const printerDeviceId = usePrinterStore((s) => s.deviceId);

  const cancelBatch = useCancelSaleBatch();
  const addLottery = useAddLotteryToBatch();
  const removeLottery = useRemoveLotteryFromBatch();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !batch) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const usedLotteryIds = new Set(batch.lotteries.map((l: SaleBatchLottery) => l.lotteryId));
  const availableToAdd = (lotteriesToday ?? []).filter((l: LotteryForDay) => !usedLotteryIds.has(l.id));

  const handleCancelBatch = async () => {
    if (reason.trim().length < 3) return;
    setError(null);
    try {
      await cancelBatch.mutateAsync({ batchId: batch.batchId, reason: reason.trim() });
      setShowCancelModal(false);
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo cancelar la venta (¿alguna lotería ya cerró?)'));
    }
  };

  const handleRemoveLottery = async (lotteryId: string) => {
    try {
      await removeLottery.mutateAsync({ batchId: batch.batchId, lotteryId });
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo quitar la lotería (¿ya cerró, o es la única de la venta?)'));
    }
  };

  const handleAddLottery = async (lotteryId: string) => {
    try {
      await addLottery.mutateAsync({ batchId: batch.batchId, lotteryId });
      setShowAddModal(false);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo agregar la lotería'));
    }
  };

  const handlePrint = () => {
    if (!printerDeviceId) return;
    for (const lottery of batch.lotteries) {
      for (const line of lottery.lines) {
        const ticket = buildSaleTicket({
          lotteryName: lottery.lotteryName,
          numberPlayed: line.numberPlayed,
          amount: line.amount,
          ticketCode: batch.ticketCode,
          sellerName: batch.sellerName,
          createdAt: batch.createdAt,
        });
        printTicket(printerDeviceId, ticket).catch(() => {
          // TODO(printing): avisar al vendedor qué ticket no se imprimió.
        });
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text variant="titleLarge" style={styles.title}>
          RESUMEN DE VENTA
        </Text>

        <Text variant="titleMedium" style={{ marginTop: 12 }}>
          Código: {batch.ticketCode}
        </Text>
        <Text style={styles.muted}>Fecha: {new Date(batch.createdAt).toLocaleString('es-PA')}</Text>
        <Text style={styles.muted}>Vendedor: {batch.sellerName}</Text>
        <Text style={styles.muted}>Cliente: {batch.customerName ?? ''}</Text>
        <Text style={styles.muted}>Teléfono: {batch.customerPhone ?? ''}</Text>

        {batch.status === 'cancelled' && (
          <Text variant="titleMedium" style={{ color: colors.danger, marginTop: 12 }}>
            VENTA CANCELADA
          </Text>
        )}

        {batch.lotteries.length > 0 && (
          <Text variant="titleMedium" style={styles.sectionTitle}>
            LOTERÍAS
          </Text>
        )}

        {batch.lotteries.map((lottery: SaleBatchLottery) => (
          <View key={lottery.lotteryId} style={styles.lotteryBlock}>
            <View style={styles.lotteryHeader}>
              <Text variant="titleMedium">{lottery.lotteryName}</Text>
              {batch.status === 'active' && batch.lotteries.length > 1 && (
                <IconButton
                  icon="close-circle-outline"
                  size={18}
                  iconColor={colors.danger}
                  onPress={() => handleRemoveLottery(lottery.lotteryId)}
                  disabled={removeLottery.isPending}
                />
              )}
            </View>

            <View style={styles.tableHeaderRow}>
              <Text style={[styles.cell, styles.muted]}>Jugada</Text>
              <Text style={[styles.cell, styles.muted, { textAlign: 'right' }]}>Monto</Text>
            </View>
            {lottery.lines.map((line: SaleBatchLottery['lines'][number]) => (
              <View key={line.id} style={styles.tableRow}>
                <Text style={styles.cell}>
                  {line.numberPlayed}
                  {line.betType !== 'recto' ? ` · ${BET_TYPE_LABEL[line.betType]}` : ''}
                </Text>
                <Text style={[styles.cell, { textAlign: 'right' }]}>${line.amount.toFixed(2)}</Text>
              </View>
            ))}

            <Text style={styles.multiplierFooter}>{multiplierLine(lottery)}</Text>
          </View>
        ))}

        <View style={styles.totalBar}>
          <Text variant="titleLarge" style={{ color: 'white', fontWeight: '700' }}>
            TOTAL: ${batch.total.toFixed(2)}
          </Text>
        </View>

        {batch.status === 'active' && (
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <QrCode value={buildQrPayload(batch)} size={200} />
            <Text style={{ marginTop: 8 }}>{batch.ticketCode}</Text>
          </View>
        )}

        <Text style={styles.disclaimer}>Sin ticket no se paga premio</Text>

        {error && <HelperText type="error">{error}</HelperText>}

        {batch.status === 'active' && (
          <View style={styles.actionsRow}>
            <Button mode="outlined" onPress={() => setShowAddModal(true)} textColor={colors.brandDark} style={{ flex: 1 }}>
              Agregar lotería
            </Button>
            <Button mode="outlined" onPress={handlePrint} textColor={colors.brandDark} style={{ flex: 1 }} disabled={!printerDeviceId}>
              Imprimir
            </Button>
          </View>
        )}

        {batch.status === 'active' && (
          <Button mode="contained" onPress={() => setShowCancelModal(true)} buttonColor={colors.danger} style={{ marginTop: 12 }}>
            Cancelar venta
          </Button>
        )}
      </View>

      <Portal>
        <Modal visible={showCancelModal} onDismiss={() => setShowCancelModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>
            Cancelar venta #{batch.ticketCode}
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
            Cancela TODAS las loterías de esta venta a la vez. Esta acción queda registrada en el log de auditoría.
          </Text>
          <TextInput label="Motivo" value={reason} onChangeText={setReason} multiline style={{ marginBottom: 12 }} />
          <Button
            mode="contained"
            onPress={handleCancelBatch}
            loading={cancelBatch.isPending}
            disabled={reason.trim().length < 3}
            buttonColor={colors.danger}
          >
            Confirmar cancelación
          </Button>
        </Modal>

        <Modal visible={showAddModal} onDismiss={() => setShowAddModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 12 }}>
            Agregar lotería
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 12 }]}>
            Se jugarán los mismos números de esta venta en la lotería que elijas.
          </Text>
          <FlatList
            data={availableToAdd}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.addRow}>
                <Text style={{ flex: 1 }}>{item.name}</Text>
                <Checkbox status="unchecked" onPress={() => handleAddLottery(item.id)} color={colors.brand} />
              </View>
            )}
            ListEmptyComponent={<Text style={styles.muted}>No hay más loterías abiertas hoy para agregar</Text>}
          />
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { margin: 16, padding: 20, backgroundColor: colors.surface, borderRadius: 16 },
  title: { textAlign: 'center', fontWeight: '700' },
  muted: { color: colors.textMuted },
  sectionTitle: { marginTop: 20, marginBottom: 8, textAlign: 'center' },
  lotteryBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ECECEC' },
  lotteryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tableHeaderRow: { flexDirection: 'row', marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#ECECEC', paddingBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4 },
  cell: { flex: 1 },
  multiplierFooter: { marginTop: 8, fontSize: 11, color: colors.textMuted },
  totalBar: { marginTop: 20, backgroundColor: colors.brand, borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  disclaimer: { marginTop: 20, textAlign: 'center', color: colors.danger, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12, maxHeight: '70%' },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
});

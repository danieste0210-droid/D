import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Modal, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { useLotteries, useLotteryResults, useProcessAwards } from '@/features/lotteries/hooks';
import { useApproveAward, usePayAward, usePendingAwards, useReverseResult } from '@/features/results/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Award, PaymentMethod, Result } from '@/api/results';
import type { Lottery } from '@/api/lotteries';

const AWARD_STATUS_LABEL: Record<Award['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  paid: 'Pagado',
  reversed: 'Anulado',
};

function AwardRow({
  award,
  onApprove,
  onPay,
  approving,
  paying,
}: {
  award: Award;
  onApprove: (award: Award) => void;
  onPay: (award: Award) => void;
  approving: boolean;
  paying: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">#{award.sale?.numberPlayed ?? '—'}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          Posición {award.position} · Vendedor: {award.sale?.sellerId ?? '—'} · {AWARD_STATUS_LABEL[award.status]}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="titleMedium">${Number(award.amount).toFixed(2)}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {award.status === 'pending' && (
            <Button compact onPress={() => onApprove(award)} loading={approving} textColor={colors.brandDark}>
              Aprobar
            </Button>
          )}
          <Button compact onPress={() => onPay(award)} loading={paying} textColor={colors.brand}>
            Pagar
          </Button>
        </View>
      </View>
    </View>
  );
}

function ResultRow({ result, canReverse, onReverse }: { result: Result; canReverse: boolean; onReverse: (r: Result) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">
          1ra: #{result.firstNumber}
          {result.secondNumber != null ? ` · 2da: #${result.secondNumber}` : ''}
          {result.thirdNumber != null ? ` · 3ra: #${result.thirdNumber}` : ''}
        </Text>
        <Text variant="bodySmall" style={styles.muted}>
          {new Date(result.drawDate).toLocaleDateString('es-PA')}
          {result.reversedAt ? ' · Revertido' : ''}
        </Text>
      </View>
      {canReverse && !result.reversedAt && (
        <Button compact onPress={() => onReverse(result)} textColor={colors.danger}>
          Revertir
        </Button>
      )}
    </View>
  );
}

// TODO(results): notificación push/WhatsApp al publicar un resultado.
export default function ResultsScreen() {
  const role = useAuthStore((s) => s.user?.role);
  // El endpoint reverse/:id lo restringe el backend solo a "super" (crear resultado sí lo puede admin).
  const canReverse = role === 'super';

  const { data: lotteries } = useLotteries();
  const { data: awards, isLoading: loadingAwards } = usePendingAwards();
  const processAwards = useProcessAwards();
  const reverseResult = useReverseResult();
  const approveAward = useApproveAward();
  const payAward = usePayAward();

  const [lotteryId, setLotteryId] = useState<string | null>(null);
  const [firstNumber, setFirstNumber] = useState('');
  const [secondNumber, setSecondNumber] = useState('');
  const [thirdNumber, setThirdNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [resultToReverse, setResultToReverse] = useState<Result | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [awardToPay, setAwardToPay] = useState<Award | null>(null);

  const { data: results, isLoading: loadingResults } = useLotteryResults(lotteryId);
  const selectedLottery = lotteries?.find((l: Lottery) => l.id === lotteryId);
  // Loterías de un solo resultado (ej. El Salvador) no piden 2do/3er premio.
  const singleResult = selectedLottery?.resultPositions === 1;
  const numberPattern = /^\d{1,4}$/;
  const isValid =
    !!lotteryId &&
    numberPattern.test(firstNumber.trim()) &&
    (singleResult || (numberPattern.test(secondNumber.trim()) && numberPattern.test(thirdNumber.trim())));

  const handlePublish = async () => {
    if (!isValid || !lotteryId) return;
    setError(null);
    try {
      const drawDate = new Date().toISOString().slice(0, 10);
      const { awardsCreated } = await processAwards.mutateAsync({
        lotteryId,
        drawDate,
        firstNumber: firstNumber.trim(),
        secondNumber: singleResult ? undefined : secondNumber.trim(),
        thirdNumber: singleResult ? undefined : thirdNumber.trim(),
      });
      setSnackbar(`Resultado publicado — ${awardsCreated} premio(s) generado(s)`);
      setFirstNumber('');
      setSecondNumber('');
      setThirdNumber('');
    } catch {
      setError('No se pudo publicar el resultado (¿ya existe uno para esta lotería hoy?)');
    }
  };

  const closeReverseModal = () => {
    setResultToReverse(null);
    setReverseReason('');
  };

  const handleConfirmReverse = async () => {
    if (!resultToReverse || reverseReason.trim().length < 3) return;
    const { awardsRequiringManualReview } = await reverseResult.mutateAsync({
      id: resultToReverse.id,
      reason: reverseReason.trim(),
    });
    closeReverseModal();
    setSnackbar(
      awardsRequiringManualReview.length > 0
        ? `Revertido. ${awardsRequiringManualReview.length} premio(s) ya pagado(s) requieren revisión manual`
        : 'Resultado revertido',
    );
  };

  const handleApprove = async (award: Award) => {
    setApprovingId(award.id);
    try {
      await approveAward.mutateAsync(award.id);
    } catch {
      setSnackbar('No se pudo aprobar el premio');
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmPay = async (paymentMethod: PaymentMethod) => {
    if (!awardToPay) return;
    try {
      await payAward.mutateAsync({ id: awardToPay.id, paymentMethod });
      setSnackbar(`Premio pagado con ${paymentMethod === 'yappy' ? 'Yappy' : 'efectivo'}`);
      setAwardToPay(null);
    } catch {
      setSnackbar('No se pudo registrar el pago');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.form}>
        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
          Publicar resultado
        </Text>

        <PlatformPicker
          options={(lotteries ?? []).map((l: Lottery) => ({ value: l.id, label: l.name }))}
          value={lotteryId}
          onChange={setLotteryId}
          placeholder="Seleccionar lotería"
          textColor={colors.brandDark}
          style={styles.field}
        />

        <View style={styles.numbersRow}>
          <TextInput
            label="1ra"
            value={firstNumber}
            onChangeText={setFirstNumber}
            keyboardType="number-pad"
            style={[styles.field, { flex: 1 }]}
          />
          {!singleResult && (
            <>
              <TextInput
                label="2da"
                value={secondNumber}
                onChangeText={setSecondNumber}
                keyboardType="number-pad"
                style={[styles.field, { flex: 1 }]}
              />
              <TextInput
                label="3ra"
                value={thirdNumber}
                onChangeText={setThirdNumber}
                keyboardType="number-pad"
                style={[styles.field, { flex: 1 }]}
              />
            </>
          )}
        </View>
        {singleResult && (
          <Text variant="bodySmall" style={[styles.muted, { marginTop: -8, marginBottom: 12 }]}>
            {selectedLottery?.name} es una lotería de un solo resultado.
          </Text>
        )}

        {error && <HelperText type="error">{error}</HelperText>}

        <Button
          mode="contained"
          onPress={handlePublish}
          loading={processAwards.isPending}
          disabled={!isValid}
          buttonColor={colors.brand}
        >
          Publicar y calcular premios
        </Button>
      </View>

      {lotteryId && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Resultados recientes — {selectedLottery?.name}
          </Text>
          {loadingResults ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
          ) : (
            <FlatList
              data={results ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ResultRow result={item} canReverse={canReverse} onReverse={setResultToReverse} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={[styles.muted, { paddingHorizontal: 20 }]}>Sin resultados todavía</Text>}
              scrollEnabled={false}
            />
          )}
        </>
      )}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Premios pendientes de pago
      </Text>
      {loadingAwards ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={awards ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AwardRow
              award={item}
              onApprove={handleApprove}
              onPay={setAwardToPay}
              approving={approvingId === item.id}
              paying={payAward.isPending && awardToPay?.id === item.id}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={[styles.muted, { paddingHorizontal: 20 }]}>No hay premios pendientes</Text>}
          scrollEnabled={false}
        />
      )}

      <Portal>
        <Modal visible={!!resultToReverse} onDismiss={closeReverseModal} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>
            Revertir resultado #{resultToReverse?.firstNumber}/{resultToReverse?.secondNumber}/{resultToReverse?.thirdNumber}
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
            Los premios pendientes de este resultado se anulan. Los ya pagados requieren revisión manual.
          </Text>
          <TextInput label="Motivo" value={reverseReason} onChangeText={setReverseReason} multiline style={styles.field} />
          <Button
            mode="contained"
            onPress={handleConfirmReverse}
            loading={reverseResult.isPending}
            disabled={reverseReason.trim().length < 3}
            buttonColor={colors.danger}
          >
            Confirmar reversión
          </Button>
        </Modal>

        <Modal visible={!!awardToPay} onDismiss={() => setAwardToPay(null)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>
            Pagar premio #{awardToPay?.sale?.numberPlayed ?? '—'}
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
            Monto: ${awardToPay ? Number(awardToPay.amount).toFixed(2) : '0.00'} · Elige el método de pago.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              mode="contained"
              onPress={() => handleConfirmPay('efectivo')}
              loading={payAward.isPending}
              buttonColor={colors.brand}
              style={{ flex: 1 }}
            >
              Efectivo
            </Button>
            <Button
              mode="contained"
              onPress={() => handleConfirmPay('yappy')}
              loading={payAward.isPending}
              buttonColor={colors.brand}
              style={{ flex: 1 }}
            >
              Yappy
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={4000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20, backgroundColor: colors.surface },
  field: { marginBottom: 12 },
  numbersRow: { flexDirection: 'row', gap: 12 },
  sectionTitle: { marginTop: 20, marginBottom: 8, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12 },
});

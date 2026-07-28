import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useLotteries } from '@/features/lotteries/hooks';
import { usePayoutMultipliers, useUpsertPayoutMultiplier } from '@/features/payoutMultipliers/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Lottery } from '@/api/lotteries';

const DIGIT_COUNTS = [2, 3, 4] as const;
const POSITIONS = [1, 2, 3] as const;
const POSITION_LABELS: Record<number, string> = { 1: '1ra', 2: '2da', 3: '3ra' };

function cellKey(digitCount: number, position: number) {
  return `${digitCount}-${position}`;
}

// Pantalla "Multiplicadores": tabla cifras x posición, cada celda guarda su propio valor de
// forma independiente (como en la app de referencia) en vez de un formulario único.
export default function MultipliersScreen() {
  const { data: lotteries } = useLotteries();
  const [lotteryId, setLotteryId] = useState<string | null>(null);
  const { data: multipliers, isLoading } = usePayoutMultipliers(lotteryId);
  const upsert = useUpsertPayoutMultiplier();

  const [values, setValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of multipliers ?? []) {
      next[cellKey(m.digitCount, m.position)] = m.multiplier;
    }
    setValues(next);
  }, [multipliers]);

  const handleSave = async (digitCount: number, position: number) => {
    if (!lotteryId) return;
    const key = cellKey(digitCount, position);
    const raw = values[key];
    const multiplier = raw ? parseFloat(raw.replace(',', '.')) : NaN;
    if (!raw || Number.isNaN(multiplier) || multiplier <= 0) return;

    setSavingKey(key);
    try {
      await upsert.mutateAsync({ lotteryId, digitCount, position, multiplier });
      setSnackbar(`Guardado: ${digitCount} cifras · ${POSITION_LABELS[position]} = ${multiplier}x`);
    } catch {
      setSnackbar('No se pudo guardar el multiplicador');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
          Multiplicadores de pago
        </Text>

        <PlatformPicker
          options={(lotteries ?? []).map((l: Lottery) => ({ value: l.id, label: l.name }))}
          value={lotteryId}
          onChange={setLotteryId}
          placeholder="Seleccionar lotería"
          textColor={colors.brandDark}
          style={styles.field}
        />

        {!lotteryId && <Text style={styles.muted}>Selecciona una lotería para configurar sus multiplicadores.</Text>}

        {lotteryId && isLoading && <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />}

        {lotteryId &&
          !isLoading &&
          DIGIT_COUNTS.map((digitCount) => (
            <View key={digitCount} style={styles.digitGroup}>
              <Text variant="titleSmall" style={styles.groupTitle}>
                {digitCount} cifras
              </Text>
              {POSITIONS.map((position) => {
                const key = cellKey(digitCount, position);
                return (
                  <View key={key} style={styles.cellRow}>
                    <Text style={styles.cellLabel}>{POSITION_LABELS[position]}</Text>
                    <TextInput
                      value={values[key] ?? ''}
                      onChangeText={(v) => setValues((prev) => ({ ...prev, [key]: v }))}
                      keyboardType="decimal-pad"
                      dense
                      style={styles.cellInput}
                    />
                    <Button
                      compact
                      mode="contained"
                      onPress={() => handleSave(digitCount, position)}
                      loading={savingKey === key}
                      buttonColor={colors.brand}
                    >
                      Guardar
                    </Button>
                  </View>
                );
              })}
            </View>
          ))}
      </View>

      <Snackbar visible={!!snackbar} onDismiss={() => setSnackbar(null)} duration={3000}>
        <Text style={{ color: 'white' }}>{snackbar}</Text>
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20, backgroundColor: colors.surface },
  field: { marginBottom: 12 },
  muted: { color: colors.textMuted },
  digitGroup: { marginTop: 16 },
  groupTitle: { marginBottom: 8, color: colors.brandDark },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  cellLabel: { width: 40, color: colors.textMuted },
  cellInput: { flex: 1 },
});

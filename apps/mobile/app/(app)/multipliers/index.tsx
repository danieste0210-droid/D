import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useLotteries } from '@/features/lotteries/hooks';
import { usePayoutMultipliers, useUpsertPayoutMultiplier } from '@/features/payoutMultipliers/hooks';
import { useCombinadoMultipliers, useUpsertCombinadoMultiplier } from '@/features/combinadoMultipliers/hooks';
import { usePaletMultipliers, useUpsertPaletMultiplier } from '@/features/paletMultipliers/hooks';
import { useChance3Multiplier, useUpsertChance3Multiplier } from '@/features/chance3Multipliers/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Lottery } from '@/api/lotteries';
import type { PaletTier } from '@/api/paletMultipliers';

const DIGIT_COUNTS = [2, 3, 4] as const;
const POSITIONS = [1, 2, 3] as const;
const POSITION_LABELS: Record<number, string> = { 1: '1ra', 2: '2da', 3: '3ra' };
const COMBINADO_DIGIT_COUNTS = [3, 4] as const;
// 2 niveles: mayor cubre 1ra-con-2da Y 1ra-con-3ra por igual (mismo pago); menor es 2da-con-3ra.
const PALET_TIERS: PaletTier[] = ['mayor', 'menor'];
const PALET_TIER_LABELS: Record<PaletTier, string> = {
  mayor: 'Premio mayor (1ra-2da o 1ra-3ra)',
  menor: 'Premio menor (2da con 3ra)',
};

type RectoMatchType = 'ultimas' | 'primeras' | 'ultimas3' | 'ultimas2';

function rectoKey(digitCount: number, position: number, matchType: RectoMatchType) {
  return `${digitCount}-${position}-${matchType}`;
}

// Pantalla "Multiplicadores": cada celda guarda su propio valor de forma independiente (como en
// la app de referencia), agrupadas en Billete (recto), bono de primeras cifras, Combinado y Palet.
export default function MultipliersScreen() {
  const { data: lotteries } = useLotteries();
  const [lotteryId, setLotteryId] = useState<string | null>(null);
  const { data: rectoMultipliers, isLoading: loadingRecto } = usePayoutMultipliers(lotteryId);
  const { data: combinadoMultipliers, isLoading: loadingCombinado } = useCombinadoMultipliers(lotteryId);
  const { data: paletMultipliers, isLoading: loadingPalet } = usePaletMultipliers(lotteryId);
  const { data: chance3Multiplier, isLoading: loadingChance3 } = useChance3Multiplier(lotteryId);
  const upsertRecto = useUpsertPayoutMultiplier();
  const upsertCombinado = useUpsertCombinadoMultiplier();
  const upsertPalet = useUpsertPaletMultiplier();
  const upsertChance3 = useUpsertChance3Multiplier();
  const isLoading = loadingRecto || loadingCombinado || loadingPalet || loadingChance3;

  const [rectoValues, setRectoValues] = useState<Record<string, string>>({});
  const [combinadoValues, setCombinadoValues] = useState<Record<number, string>>({});
  const [paletValues, setPaletValues] = useState<Record<string, string>>({});
  const [chance3Value, setChance3Value] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of rectoMultipliers ?? []) {
      next[rectoKey(m.digitCount, m.position, m.matchType)] = m.multiplier;
    }
    setRectoValues(next);
  }, [rectoMultipliers]);

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const m of combinadoMultipliers ?? []) next[m.digitCount] = m.multiplier;
    setCombinadoValues(next);
  }, [combinadoMultipliers]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const m of paletMultipliers ?? []) next[m.tier] = m.multiplier;
    setPaletValues(next);
  }, [paletMultipliers]);

  useEffect(() => {
    setChance3Value(chance3Multiplier?.multiplier ?? '');
  }, [chance3Multiplier]);

  const handleSaveRecto = async (digitCount: number, position: number, matchType: RectoMatchType) => {
    if (!lotteryId) return;
    const key = rectoKey(digitCount, position, matchType);
    const raw = rectoValues[key];
    const multiplier = raw ? parseFloat(raw.replace(',', '.')) : NaN;
    if (!raw || Number.isNaN(multiplier) || multiplier <= 0) return;

    setSavingKey(key);
    try {
      await upsertRecto.mutateAsync({ lotteryId, digitCount, position, matchType, multiplier });
      setSnackbar(`Guardado: ${digitCount} cifras · ${POSITION_LABELS[position]} = ${multiplier}x`);
    } catch {
      setSnackbar('No se pudo guardar el multiplicador');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveCombinado = async (digitCount: number) => {
    if (!lotteryId) return;
    const key = `combinado-${digitCount}`;
    const raw = combinadoValues[digitCount];
    const multiplier = raw ? parseFloat(raw.replace(',', '.')) : NaN;
    if (!raw || Number.isNaN(multiplier) || multiplier <= 0) return;

    setSavingKey(key);
    try {
      await upsertCombinado.mutateAsync({ lotteryId, digitCount, multiplier });
      setSnackbar(`Guardado: Combinado ${digitCount} cifras = ${multiplier}x`);
    } catch {
      setSnackbar('No se pudo guardar el multiplicador');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveChance3 = async () => {
    if (!lotteryId) return;
    const key = 'chance3';
    const multiplier = chance3Value ? parseFloat(chance3Value.replace(',', '.')) : NaN;
    if (!chance3Value || Number.isNaN(multiplier) || multiplier <= 0) return;

    setSavingKey(key);
    try {
      await upsertChance3.mutateAsync({ lotteryId, multiplier });
      setSnackbar(`Guardado: Chance de tres cifras = ${multiplier}x`);
    } catch {
      setSnackbar('No se pudo guardar el multiplicador');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSavePalet = async (tier: PaletTier) => {
    if (!lotteryId) return;
    const key = `palet-${tier}`;
    const raw = paletValues[tier];
    const multiplier = raw ? parseFloat(raw.replace(',', '.')) : NaN;
    if (!raw || Number.isNaN(multiplier) || multiplier <= 0) return;

    setSavingKey(key);
    try {
      await upsertPalet.mutateAsync({ lotteryId, tier, multiplier });
      setSnackbar(`Guardado: Palet ${PALET_TIER_LABELS[tier]} = ${multiplier}x`);
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

        {lotteryId && !isLoading && (
          <>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Billete (recto)
            </Text>
            {DIGIT_COUNTS.map((digitCount) => (
              <View key={digitCount} style={styles.digitGroup}>
                <Text variant="titleSmall" style={styles.groupTitle}>
                  {digitCount} cifras
                </Text>
                {POSITIONS.map((position) => {
                  const key = rectoKey(digitCount, position, 'ultimas');
                  return (
                    <View key={key} style={styles.cellRow}>
                      <Text style={styles.cellLabel}>{POSITION_LABELS[position]}</Text>
                      <TextInput
                        value={rectoValues[key] ?? ''}
                        onChangeText={(v) => setRectoValues((prev) => ({ ...prev, [key]: v }))}
                        keyboardType="decimal-pad"
                        dense
                        style={styles.cellInput}
                      />
                      <Button
                        compact
                        mode="contained"
                        onPress={() => handleSaveRecto(digitCount, position, 'ultimas')}
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

            <Text variant="titleSmall" style={styles.sectionTitle}>
              Bono: primeras 3 cifras (solo billetes de 4 cifras)
            </Text>
            <View style={styles.digitGroup}>
              {POSITIONS.map((position) => {
                const key = rectoKey(4, position, 'primeras');
                return (
                  <View key={key} style={styles.cellRow}>
                    <Text style={styles.cellLabel}>{POSITION_LABELS[position]}</Text>
                    <TextInput
                      value={rectoValues[key] ?? ''}
                      onChangeText={(v) => setRectoValues((prev) => ({ ...prev, [key]: v }))}
                      keyboardType="decimal-pad"
                      dense
                      style={styles.cellInput}
                    />
                    <Button
                      compact
                      mode="contained"
                      onPress={() => handleSaveRecto(4, position, 'primeras')}
                      loading={savingKey === key}
                      buttonColor={colors.brand}
                    >
                      Guardar
                    </Button>
                  </View>
                );
              })}
            </View>

            <Text variant="titleSmall" style={styles.sectionTitle}>
              Bono: últimas 3 cifras (solo billetes de 4 cifras)
            </Text>
            <View style={styles.digitGroup}>
              {POSITIONS.map((position) => {
                const key = rectoKey(4, position, 'ultimas3');
                return (
                  <View key={key} style={styles.cellRow}>
                    <Text style={styles.cellLabel}>{POSITION_LABELS[position]}</Text>
                    <TextInput
                      value={rectoValues[key] ?? ''}
                      onChangeText={(v) => setRectoValues((prev) => ({ ...prev, [key]: v }))}
                      keyboardType="decimal-pad"
                      dense
                      style={styles.cellInput}
                    />
                    <Button
                      compact
                      mode="contained"
                      onPress={() => handleSaveRecto(4, position, 'ultimas3')}
                      loading={savingKey === key}
                      buttonColor={colors.brand}
                    >
                      Guardar
                    </Button>
                  </View>
                );
              })}
            </View>

            <Text variant="titleSmall" style={styles.sectionTitle}>
              Bono: últimas 2 cifras (solo billetes de 4 cifras)
            </Text>
            <View style={styles.digitGroup}>
              {POSITIONS.map((position) => {
                const key = rectoKey(4, position, 'ultimas2');
                return (
                  <View key={key} style={styles.cellRow}>
                    <Text style={styles.cellLabel}>{POSITION_LABELS[position]}</Text>
                    <TextInput
                      value={rectoValues[key] ?? ''}
                      onChangeText={(v) => setRectoValues((prev) => ({ ...prev, [key]: v }))}
                      keyboardType="decimal-pad"
                      dense
                      style={styles.cellInput}
                    />
                    <Button
                      compact
                      mode="contained"
                      onPress={() => handleSaveRecto(4, position, 'ultimas2')}
                      loading={savingKey === key}
                      buttonColor={colors.brand}
                    >
                      Guardar
                    </Button>
                  </View>
                );
              })}
            </View>

            <Text variant="titleSmall" style={styles.sectionTitle}>
              Combinado
            </Text>
            <View style={styles.digitGroup}>
              {COMBINADO_DIGIT_COUNTS.map((digitCount) => {
                const key = `combinado-${digitCount}`;
                return (
                  <View key={key} style={styles.cellRow}>
                    <Text style={styles.cellLabel}>{digitCount} cifras</Text>
                    <TextInput
                      value={combinadoValues[digitCount] ?? ''}
                      onChangeText={(v) => setCombinadoValues((prev) => ({ ...prev, [digitCount]: v }))}
                      keyboardType="decimal-pad"
                      dense
                      style={styles.cellInput}
                    />
                    <Button
                      compact
                      mode="contained"
                      onPress={() => handleSaveCombinado(digitCount)}
                      loading={savingKey === key}
                      buttonColor={colors.brand}
                    >
                      Guardar
                    </Button>
                  </View>
                );
              })}
            </View>

            <Text variant="titleSmall" style={styles.sectionTitle}>
              Chance de tres cifras
            </Text>
            <Text variant="bodySmall" style={{ color: colors.textMuted, marginTop: 4 }}>
              Coincidencia exacta contra últimas 2 cifras del 1er premio + última cifra del 2do premio. No
              disponible para loterías de un solo resultado (ej. El Salvador).
            </Text>
            <View style={styles.digitGroup}>
              <View style={styles.cellRow}>
                <Text style={styles.cellLabel}>Multiplicador</Text>
                <TextInput
                  value={chance3Value}
                  onChangeText={setChance3Value}
                  keyboardType="decimal-pad"
                  dense
                  style={styles.cellInput}
                />
                <Button compact mode="contained" onPress={handleSaveChance3} loading={savingKey === 'chance3'} buttonColor={colors.brand}>
                  Guardar
                </Button>
              </View>
            </View>

            <Text variant="titleSmall" style={styles.sectionTitle}>
              Palet
            </Text>
            <View style={styles.digitGroup}>
              {PALET_TIERS.map((tier) => {
                const key = `palet-${tier}`;
                return (
                  <View key={key} style={styles.cellRow}>
                    <Text style={[styles.cellLabel, { width: 170 }]}>{PALET_TIER_LABELS[tier]}</Text>
                    <TextInput
                      value={paletValues[tier] ?? ''}
                      onChangeText={(v) => setPaletValues((prev) => ({ ...prev, [tier]: v }))}
                      keyboardType="decimal-pad"
                      dense
                      style={styles.cellInput}
                    />
                    <Button
                      compact
                      mode="contained"
                      onPress={() => handleSavePalet(tier)}
                      loading={savingKey === key}
                      buttonColor={colors.brand}
                    >
                      Guardar
                    </Button>
                  </View>
                );
              })}
            </View>
          </>
        )}
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
  sectionTitle: { marginTop: 24, color: colors.brand, fontWeight: '700' },
  digitGroup: { marginTop: 16 },
  groupTitle: { marginBottom: 8, color: colors.brandDark },
  cellRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  cellLabel: { width: 40, color: colors.textMuted },
  cellInput: { flex: 1 },
});

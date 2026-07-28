import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, HelperText, IconButton, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useLotteries } from '@/features/lotteries/hooks';
import { useBlockedNumbers, useCreateBlockedNumber, useDeleteBlockedNumber } from '@/features/blockedNumbers/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Lottery } from '@/api/lotteries';
import type { BlockedNumber } from '@/api/blockedNumbers';

function BlockedNumberRow({ item, onDelete }: { item: BlockedNumber; onDelete: (id: string) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">#{item.number}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {item.lottery?.name ?? item.lotteryId}
        </Text>
      </View>
      <IconButton icon="delete-outline" iconColor={colors.danger} onPress={() => onDelete(item.id)} />
    </View>
  );
}

export default function BlockedNumbersScreen() {
  const { data: lotteries } = useLotteries();
  const { data: blockedNumbers, isLoading } = useBlockedNumbers();
  const createBlockedNumber = useCreateBlockedNumber();
  const deleteBlockedNumber = useDeleteBlockedNumber();

  const [lotteryId, setLotteryId] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isValid = !!lotteryId && /^\d{2,4}$/.test(number.trim());

  const handleBlock = async () => {
    if (!isValid || !lotteryId) return;
    setError(null);
    try {
      await createBlockedNumber.mutateAsync({ lotteryId, number: number.trim() });
      setNumber('');
    } catch {
      setError('No se pudo bloquear (¿ya está bloqueado para esta lotería?)');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text variant="titleMedium" style={{ marginBottom: 12 }}>
          Bloquear número
        </Text>

        <PlatformPicker
          options={(lotteries ?? []).map((l: Lottery) => ({ value: l.id, label: l.name }))}
          value={lotteryId}
          onChange={setLotteryId}
          placeholder="Seleccionar lotería"
          textColor={colors.brandDark}
          style={styles.field}
        />

        <TextInput
          label="Número (2 a 4 cifras)"
          value={number}
          onChangeText={setNumber}
          keyboardType="number-pad"
          style={styles.field}
        />

        {error && <HelperText type="error">{error}</HelperText>}

        <Button mode="contained" onPress={handleBlock} loading={createBlockedNumber.isPending} disabled={!isValid} buttonColor={colors.brand}>
          Bloquear
        </Button>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={colors.brand} />
      ) : (
        <FlatList
          data={blockedNumbers ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BlockedNumberRow item={item} onDelete={(id) => deleteBlockedNumber.mutate(id)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={[styles.muted, { padding: 20 }]}>No hay números bloqueados</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  form: { padding: 20, backgroundColor: colors.surface },
  field: { marginBottom: 12 },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
});

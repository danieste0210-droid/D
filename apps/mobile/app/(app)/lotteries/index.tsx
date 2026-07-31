import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Chip, FAB, HelperText, IconButton, Modal, Portal, SegmentedButtons, Text, TextInput, Button } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { useBlockLottery, useCreateLottery, useEditLottery, useLotteries } from '@/features/lotteries/hooks';
import type { Lottery } from '@/api/lotteries';

function LotteryRow({
  lottery,
  canManage,
  onEdit,
  onToggleBlock,
}: {
  lottery: Lottery;
  canManage: boolean;
  onEdit: (l: Lottery) => void;
  onToggleBlock: (l: Lottery) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">{lottery.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          Límite/número: {lottery.maxAmountPerNumber ? `$${lottery.maxAmountPerNumber}` : 'sin límite'}
          {lottery.resultPositions === 1 ? ' · Un solo resultado' : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {lottery.blocked && <Chip compact textStyle={{ color: colors.danger }}>Bloqueada</Chip>}
        {!lottery.active && <Chip compact>Inactiva</Chip>}
        {canManage && (
          <>
            <IconButton icon="pencil-outline" onPress={() => onEdit(lottery)} />
            {!lottery.blocked && (
              <Button compact onPress={() => onToggleBlock(lottery)} textColor={colors.danger}>
                Bloquear
              </Button>
            )}
          </>
        )}
      </View>
    </View>
  );
}

export default function LotteriesScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'super' || role === 'admin';

  const { data: lotteries, isLoading } = useLotteries();
  const createLottery = useCreateLottery();
  const editLottery = useEditLottery();
  const blockLottery = useBlockLottery();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [resultPositions, setResultPositions] = useState<'3' | '1'>('3');
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editingId;
  const saving = isEditing ? editLottery.isPending : createLottery.isPending;

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setMaxAmount('');
    setResultPositions('3');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (lottery: Lottery) => {
    setEditingId(lottery.id);
    setName(lottery.name);
    setMaxAmount(lottery.maxAmountPerNumber ?? '');
    setResultPositions(lottery.resultPositions === 1 ? '1' : '3');
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    const payload = {
      name: name.trim(),
      maxAmountPerNumber: maxAmount ? parseFloat(maxAmount.replace(',', '.')) : undefined,
      resultPositions: Number(resultPositions),
    };

    try {
      if (isEditing) {
        await editLottery.mutateAsync({ id: editingId!, payload });
      } else {
        await createLottery.mutateAsync(payload);
      }
      setModalOpen(false);
    } catch {
      setError(isEditing ? 'No se pudo actualizar la lotería' : 'No se pudo crear la lotería');
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.brand} />
      ) : (
        <FlatList
          data={lotteries ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LotteryRow lottery={item} canManage={canManage} onEdit={openEditModal} onToggleBlock={(l) => blockLottery.mutate(l.id)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.muted}>No hay loterías registradas</Text>}
          contentContainerStyle={lotteries?.length ? undefined : styles.emptyContainer}
        />
      )}

      {canManage && (
        <>
          <FAB icon="plus" style={styles.fab} color="white" customSize={56} onPress={openCreateModal} />
          <Portal>
            <Modal visible={modalOpen} onDismiss={() => setModalOpen(false)} contentContainerStyle={styles.modal}>
              <Text variant="titleMedium" style={{ marginBottom: 16 }}>
                {isEditing ? 'Editar lotería' : 'Nueva lotería'}
              </Text>
              <TextInput label="Nombre" value={name} onChangeText={setName} style={styles.field} />
              <TextInput
                label="Límite máximo por número (opcional)"
                value={maxAmount}
                onChangeText={setMaxAmount}
                keyboardType="decimal-pad"
                style={styles.field}
              />
              <Text variant="bodySmall" style={[styles.muted, { marginBottom: 4 }]}>
                Tipo de resultado
              </Text>
              <SegmentedButtons
                value={resultPositions}
                onValueChange={(v) => setResultPositions(v as '3' | '1')}
                style={styles.field}
                buttons={[
                  { value: '3', label: 'Estándar (3 premios)' },
                  { value: '1', label: 'Un solo resultado' },
                ]}
              />
              {error && <HelperText type="error">{error}</HelperText>}
              <Button mode="contained" onPress={handleSave} loading={saving} buttonColor={colors.brand}>
                {isEditing ? 'Guardar cambios' : 'Crear'}
              </Button>
            </Modal>
          </Portal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.brand },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12 },
  field: { marginBottom: 12 },
});

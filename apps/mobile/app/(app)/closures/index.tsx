import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, FAB, HelperText, IconButton, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import { useCreateClosure, useDeleteClosure, useUpdateClosure, useClosures } from '@/features/closures/hooks';
import { useLotteries } from '@/features/lotteries/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { Closure } from '@/api/closures';
import type { Lottery } from '@/api/lotteries';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function ClosureRow({
  closure,
  canManage,
  onEdit,
  onDelete,
}: {
  closure: Closure;
  canManage: boolean;
  onEdit: (c: Closure) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">{closure.lottery?.name ?? closure.lotteryId}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {DAY_LABELS[closure.dayOfWeek]} · cierra {closure.closeTime}
        </Text>
      </View>
      {canManage && (
        <View style={{ flexDirection: 'row' }}>
          <IconButton icon="pencil-outline" onPress={() => onEdit(closure)} />
          <IconButton icon="delete-outline" onPress={() => onDelete(closure.id)} iconColor={colors.danger} />
        </View>
      )}
    </View>
  );
}

export default function ClosuresScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'super' || role === 'admin';

  const { data: closures, isLoading } = useClosures();
  const { data: lotteries } = useLotteries();
  const createClosure = useCreateClosure();
  const updateClosure = useUpdateClosure();
  const deleteClosure = useDeleteClosure();

  const [modalOpen, setModalOpen] = useState(false);
  const [lotteryId, setLotteryId] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [closeTime, setCloseTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editingClosure, setEditingClosure] = useState<Closure | null>(null);
  const [editCloseTime, setEditCloseTime] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const selectedLottery = lotteries?.find((l: Lottery) => l.id === lotteryId);
  const isValid = !!lotteryId && dayOfWeek !== null && TIME_REGEX.test(closeTime);

  const handleCreate = async () => {
    if (!isValid || !lotteryId || dayOfWeek === null) return;
    setError(null);
    try {
      await createClosure.mutateAsync({ lotteryId, dayOfWeek, closeTime });
      setModalOpen(false);
      setCloseTime('');
    } catch {
      setError('No se pudo crear el cierre (¿ya existe uno para esa lotería y día?)');
    }
  };

  const openEditModal = (closure: Closure) => {
    setEditingClosure(closure);
    setEditCloseTime(closure.closeTime);
    setEditError(null);
  };

  const handleUpdate = async () => {
    if (!editingClosure || !TIME_REGEX.test(editCloseTime)) return;
    setEditError(null);
    try {
      await updateClosure.mutateAsync({ id: editingClosure.id, closeTime: editCloseTime });
      setEditingClosure(null);
    } catch {
      setEditError('No se pudo actualizar el cierre');
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.brand} />
      ) : (
        <FlatList
          data={closures ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClosureRow closure={item} canManage={canManage} onEdit={openEditModal} onDelete={(id) => deleteClosure.mutate(id)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.muted}>No hay cierres configurados</Text>}
          contentContainerStyle={closures?.length ? undefined : styles.emptyContainer}
        />
      )}

      {canManage && (
        <>
          <FAB icon="plus" style={styles.fab} color="white" customSize={56} onPress={() => setModalOpen(true)} />

          <Portal>
            <Modal visible={modalOpen} onDismiss={() => setModalOpen(false)} contentContainerStyle={styles.modal}>
              <Text variant="titleMedium" style={{ marginBottom: 16 }}>
                Nuevo cierre
              </Text>

              <PlatformPicker
                options={(lotteries ?? []).map((l: Lottery) => ({ value: l.id, label: l.name }))}
                value={lotteryId}
                onChange={setLotteryId}
                placeholder="Seleccionar lotería"
                textColor={colors.brandDark}
                style={styles.field}
              />

              <PlatformPicker
                options={DAY_LABELS.map((label, index) => ({ value: String(index), label }))}
                value={dayOfWeek !== null ? String(dayOfWeek) : null}
                onChange={(v) => setDayOfWeek(Number(v))}
                placeholder="Seleccionar día"
                textColor={colors.brandDark}
                style={styles.field}
              />

              <TextInput
                label="Hora de cierre (HH:mm, America/Panama)"
                value={closeTime}
                onChangeText={setCloseTime}
                placeholder="18:00"
                style={styles.field}
              />

              {error && <HelperText type="error">{error}</HelperText>}

              <Button mode="contained" onPress={handleCreate} loading={createClosure.isPending} disabled={!isValid} buttonColor={colors.brand}>
                Crear
              </Button>
            </Modal>

            <Modal visible={!!editingClosure} onDismiss={() => setEditingClosure(null)} contentContainerStyle={styles.modal}>
              <Text variant="titleMedium" style={{ marginBottom: 4 }}>
                Editar cierre
              </Text>
              <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
                {editingClosure?.lottery?.name} · {editingClosure ? DAY_LABELS[editingClosure.dayOfWeek] : ''}
              </Text>
              <TextInput
                label="Hora de cierre (HH:mm, America/Panama)"
                value={editCloseTime}
                onChangeText={setEditCloseTime}
                placeholder="18:00"
                style={styles.field}
              />
              {editError && <HelperText type="error">{editError}</HelperText>}
              <Button
                mode="contained"
                onPress={handleUpdate}
                loading={updateClosure.isPending}
                disabled={!TIME_REGEX.test(editCloseTime)}
                buttonColor={colors.brand}
              >
                Guardar cambios
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: colors.brand },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12 },
  field: { marginBottom: 12 },
});

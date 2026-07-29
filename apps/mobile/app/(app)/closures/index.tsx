import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, HelperText, IconButton, Modal, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useAuthStore } from '@/state/authStore';
import {
  useClosureDefaults,
  useClosures,
  useCreateClosure,
  useDeleteClosure,
  useUpdateClosure,
  useUpsertClosureDefault,
} from '@/features/closures/hooks';
import { useLotteries } from '@/features/lotteries/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import { TimePickerField } from '@/components/TimePickerField';
import type { Closure, ClosureDefault } from '@/api/closures';
import type { Lottery } from '@/api/lotteries';

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function scheduleLabel(openTime: string | null, closeTime: string): string {
  return openTime ? `${openTime} – ${closeTime}` : closeTime;
}

// Editor genérico de horario (Día/Rango + hora), reutilizado tanto para el horario general por
// día como para la excepción de una lotería específica.
function ScheduleEditor({
  openTime,
  closeTime,
  onChangeOpenTime,
  onChangeCloseTime,
}: {
  openTime: string | null;
  closeTime: string;
  onChangeOpenTime: (v: string | null) => void;
  onChangeCloseTime: (v: string) => void;
}) {
  const isRango = openTime !== null;

  return (
    <View>
      <RadioButton.Group
        value={isRango ? 'rango' : 'dia'}
        onValueChange={(v) => onChangeOpenTime(v === 'rango' ? (openTime ?? '08:00') : null)}
      >
        <View style={styles.modeRow}>
          <View style={styles.modeOption}>
            <RadioButton value="dia" color={colors.brand} />
            <Text>Día (abre todo el día hasta la hora de cierre)</Text>
          </View>
          <View style={styles.modeOption}>
            <RadioButton value="rango" color={colors.brand} />
            <Text>Rango (abre y cierra a horas específicas)</Text>
          </View>
        </View>
      </RadioButton.Group>

      {isRango && (
        <TimePickerField label="Hora de apertura" value={openTime} onChange={onChangeOpenTime} style={styles.field} />
      )}
      <TimePickerField label="Hora de cierre" value={closeTime} onChange={onChangeCloseTime} style={styles.field} />
    </View>
  );
}

function DayDefaultRow({ dayOfWeek, closureDefault, canManage, onEdit }: {
  dayOfWeek: number;
  closureDefault?: ClosureDefault;
  canManage: boolean;
  onEdit: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text variant="titleMedium" style={{ flex: 1 }}>
        {DAY_LABELS[dayOfWeek]}
      </Text>
      <Text variant="bodyMedium" style={styles.muted}>
        {closureDefault ? scheduleLabel(closureDefault.openTime, closureDefault.closeTime) : 'Sin definir'}
      </Text>
      {canManage && <IconButton icon="pencil-outline" onPress={onEdit} />}
    </View>
  );
}

function LotteryScheduleRow({
  lottery,
  closure,
  fallback,
  canManage,
  onEdit,
}: {
  lottery: Lottery;
  closure?: Closure;
  fallback?: ClosureDefault;
  canManage: boolean;
  onEdit: () => void;
}) {
  const effective = closure ?? fallback;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">{lottery.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          {effective ? scheduleLabel(effective.openTime, effective.closeTime) : 'Sin horario'}
        </Text>
      </View>
      {closure && <Chip compact>Excepción</Chip>}
      {canManage && <IconButton icon="pencil-outline" onPress={onEdit} />}
    </View>
  );
}

// Pantalla "Cierres": horario general por día de la semana (plantilla que aplica a toda lotería
// sin excepción propia) + lista de loterías donde se puede definir una excepción puntual para un
// día específico. Cada horario puede ser modo "Día" (solo hora de cierre) o "Rango" (abre y cierra).
export default function ClosuresScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'super' || role === 'admin';

  const { data: closureDefaults, isLoading: loadingDefaults } = useClosureDefaults();
  const { data: closures, isLoading: loadingClosures } = useClosures();
  const { data: lotteries, isLoading: loadingLotteries } = useLotteries();
  const upsertDefault = useUpsertClosureDefault();
  const createClosure = useCreateClosure();
  const updateClosure = useUpdateClosure();
  const deleteClosure = useDeleteClosure();

  const todayDayOfWeek = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(String(todayDayOfWeek));
  const [search, setSearch] = useState('');

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [defaultOpenTime, setDefaultOpenTime] = useState<string | null>(null);
  const [defaultCloseTime, setDefaultCloseTime] = useState('18:00');
  const [defaultError, setDefaultError] = useState<string | null>(null);

  const [editingLottery, setEditingLottery] = useState<Lottery | null>(null);
  const [lotteryOpenTime, setLotteryOpenTime] = useState<string | null>(null);
  const [lotteryCloseTime, setLotteryCloseTime] = useState('18:00');
  const [lotteryError, setLotteryError] = useState<string | null>(null);

  const dayOfWeekNum = Number(selectedDay);
  const defaultForSelectedDay = closureDefaults?.find((d: ClosureDefault) => d.dayOfWeek === dayOfWeekNum);

  const closuresByLottery = useMemo(() => {
    const map = new Map<string, Closure>();
    for (const c of closures ?? []) {
      if (c.dayOfWeek === dayOfWeekNum) map.set(c.lotteryId, c);
    }
    return map;
  }, [closures, dayOfWeekNum]);

  const filteredLotteries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (lotteries ?? []).filter((l: Lottery) => {
      if (!term) return true;
      const effective = closuresByLottery.get(l.id) ?? defaultForSelectedDay;
      const label = effective ? scheduleLabel(effective.openTime, effective.closeTime).toLowerCase() : '';
      return l.name.toLowerCase().includes(term) || label.includes(term);
    });
  }, [lotteries, search, closuresByLottery, defaultForSelectedDay]);

  const openDefaultEditor = (dayOfWeek: number) => {
    const existing = closureDefaults?.find((d: ClosureDefault) => d.dayOfWeek === dayOfWeek);
    setEditingDay(dayOfWeek);
    setDefaultOpenTime(existing?.openTime ?? null);
    setDefaultCloseTime(existing?.closeTime ?? '18:00');
    setDefaultError(null);
  };

  const handleSaveDefault = async () => {
    if (editingDay === null) return;
    setDefaultError(null);
    try {
      await upsertDefault.mutateAsync({
        dayOfWeek: editingDay,
        openTime: defaultOpenTime ?? undefined,
        closeTime: defaultCloseTime,
      });
      setEditingDay(null);
    } catch {
      setDefaultError('No se pudo guardar el horario general');
    }
  };

  const openLotteryEditor = (lottery: Lottery) => {
    const existing = closuresByLottery.get(lottery.id);
    setEditingLottery(lottery);
    setLotteryOpenTime(existing?.openTime ?? null);
    setLotteryCloseTime(existing?.closeTime ?? defaultForSelectedDay?.closeTime ?? '18:00');
    setLotteryError(null);
  };

  const handleSaveLottery = async () => {
    if (!editingLottery) return;
    setLotteryError(null);
    const existing = closuresByLottery.get(editingLottery.id);
    try {
      if (existing) {
        await updateClosure.mutateAsync({ id: existing.id, openTime: lotteryOpenTime ?? undefined, closeTime: lotteryCloseTime });
      } else {
        await createClosure.mutateAsync({
          lotteryId: editingLottery.id,
          dayOfWeek: dayOfWeekNum,
          openTime: lotteryOpenTime ?? undefined,
          closeTime: lotteryCloseTime,
        });
      }
      setEditingLottery(null);
    } catch {
      setLotteryError('No se pudo guardar la excepción');
    }
  };

  const handleRemoveException = async () => {
    if (!editingLottery) return;
    const existing = closuresByLottery.get(editingLottery.id);
    if (!existing) return;
    await deleteClosure.mutateAsync(existing.id);
    setEditingLottery(null);
  };

  const isLoading = loadingDefaults || loadingClosures || loadingLotteries;

  return (
    <ScrollView style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Horario general (aplica a toda lotería sin excepción propia)
      </Text>
      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      ) : (
        DAY_LABELS.map((_, dayOfWeek) => (
          <DayDefaultRow
            key={dayOfWeek}
            dayOfWeek={dayOfWeek}
            closureDefault={closureDefaults?.find((d: ClosureDefault) => d.dayOfWeek === dayOfWeek)}
            canManage={canManage}
            onEdit={() => openDefaultEditor(dayOfWeek)}
          />
        ))
      )}

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Excepciones por lotería
      </Text>
      <View style={styles.form}>
        <PlatformPicker
          options={DAY_LABELS.map((label, index) => ({ value: String(index), label }))}
          value={selectedDay}
          onChange={setSelectedDay}
          placeholder="Día"
          textColor={colors.brandDark}
          style={styles.field}
        />
        <TextInput
          label="Buscar por lotería u hora"
          value={search}
          onChangeText={setSearch}
          style={styles.field}
        />
      </View>

      {!isLoading && (
        <FlatList
          data={filteredLotteries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LotteryScheduleRow
              lottery={item}
              closure={closuresByLottery.get(item.id)}
              fallback={defaultForSelectedDay}
              canManage={canManage}
              onEdit={() => openLotteryEditor(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={[styles.muted, { padding: 20 }]}>No hay loterías que coincidan</Text>}
          scrollEnabled={false}
        />
      )}

      <Portal>
        <Modal visible={editingDay !== null} onDismiss={() => setEditingDay(null)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 16 }}>
            Horario general — {editingDay !== null ? DAY_LABELS[editingDay] : ''}
          </Text>
          <ScheduleEditor
            openTime={defaultOpenTime}
            closeTime={defaultCloseTime}
            onChangeOpenTime={setDefaultOpenTime}
            onChangeCloseTime={setDefaultCloseTime}
          />
          {defaultError && <HelperText type="error">{defaultError}</HelperText>}
          <Button mode="contained" onPress={handleSaveDefault} loading={upsertDefault.isPending} buttonColor={colors.brand}>
            Guardar
          </Button>
        </Modal>

        <Modal visible={!!editingLottery} onDismiss={() => setEditingLottery(null)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 4 }}>
            {editingLottery?.name} — {DAY_LABELS[dayOfWeekNum]}
          </Text>
          <Text variant="bodySmall" style={[styles.muted, { marginBottom: 16 }]}>
            Horario general de este día: {defaultForSelectedDay ? scheduleLabel(defaultForSelectedDay.openTime, defaultForSelectedDay.closeTime) : 'sin definir'}
          </Text>
          <ScheduleEditor
            openTime={lotteryOpenTime}
            closeTime={lotteryCloseTime}
            onChangeOpenTime={setLotteryOpenTime}
            onChangeCloseTime={setLotteryCloseTime}
          />
          {lotteryError && <HelperText type="error">{lotteryError}</HelperText>}
          <Button
            mode="contained"
            onPress={handleSaveLottery}
            loading={createClosure.isPending || updateClosure.isPending}
            buttonColor={colors.brand}
            style={{ marginBottom: 8 }}
          >
            Guardar excepción
          </Button>
          {editingLottery && closuresByLottery.has(editingLottery.id) && (
            <Button mode="text" onPress={handleRemoveException} textColor={colors.danger} loading={deleteClosure.isPending}>
              Quitar excepción (usar horario general)
            </Button>
          )}
        </Modal>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { marginTop: 20, marginBottom: 8, paddingHorizontal: 20 },
  form: { paddingHorizontal: 20 },
  field: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.surface, gap: 8 },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
  modal: { backgroundColor: colors.surface, margin: 24, padding: 20, borderRadius: 12 },
  modeRow: { marginBottom: 12 },
  modeOption: { flexDirection: 'row', alignItems: 'center' },
});

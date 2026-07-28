import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useSupervisors, useVendorsBySupervisor } from '@/features/users/hooks';
import type { AppUser } from '@/api/users';

function SupervisorRow({ supervisor, selected, onPress }: { supervisor: AppUser; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text variant="titleMedium">{supervisor.name}</Text>
      <Text variant="bodySmall" style={styles.muted}>
        @{supervisor.username}
      </Text>
    </Pressable>
  );
}

function VendorRow({ vendor }: { vendor: AppUser }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">{vendor.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          @{vendor.username}
        </Text>
      </View>
      <Text variant="bodyMedium" style={{ color: colors.brandDark }}>
        {vendor.commissionPercent ? `${Number(vendor.commissionPercent)}%` : 'sin comisión'}
      </Text>
    </View>
  );
}

export default function SupervisorsScreen() {
  const { data: supervisors, isLoading } = useSupervisors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: vendors, isLoading: loadingVendors } = useVendorsBySupervisor(selectedId);
  const selected = supervisors?.find((s: AppUser) => s.id === selectedId);

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Supervisores
      </Text>
      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={supervisors ?? []}
          keyExtractor={(item) => item.id}
          horizontal
          renderItem={({ item }) => (
            <SupervisorRow supervisor={item} selected={item.id === selectedId} onPress={() => setSelectedId(item.id)} />
          )}
          ItemSeparatorComponent={() => <View style={{ width: 1 }} />}
          ListEmptyComponent={<Text style={[styles.muted, { padding: 20 }]}>No hay supervisores</Text>}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        />
      )}

      {selected && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Vendedores de: {selected.name}
          </Text>
          {loadingVendors ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 16 }} />
          ) : (
            <FlatList
              data={vendors ?? []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <VendorRow vendor={item} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<Text style={[styles.muted, { padding: 20 }]}>Sin vendedores asignados</Text>}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  sectionTitle: { marginTop: 16, marginBottom: 8, paddingHorizontal: 20 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    marginRight: 8,
    borderRadius: 8,
  },
  chipSelected: { backgroundColor: colors.brandLight },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface },
  separator: { height: 1, backgroundColor: '#ECECEC' },
  muted: { color: colors.textMuted },
});

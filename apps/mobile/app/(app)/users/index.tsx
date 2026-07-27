import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, FAB, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { colors } from '@/theme/colors';
import { useAuthStore, type Role } from '@/state/authStore';
import { useCreateUser, useDeactivateUser, useUsers } from '@/features/users/hooks';
import { PlatformPicker } from '@/components/PlatformPicker';
import type { AppUser } from '@/api/users';

const ROLE_LABELS: Record<Role, string> = {
  super: 'Super Admin',
  admin: 'Admin',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
};

function UserRow({ user, onDeactivate }: { user: AppUser; onDeactivate: (id: string) => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="titleMedium">{user.name}</Text>
        <Text variant="bodySmall" style={styles.muted}>
          @{user.username} · {ROLE_LABELS[user.role]}
        </Text>
      </View>
      {!user.active ? (
        <Chip compact>Inactivo</Chip>
      ) : (
        <Button compact onPress={() => onDeactivate(user.id)} textColor={colors.danger}>
          Desactivar
        </Button>
      )}
    </View>
  );
}

// El endpoint GET /user/super (listado) solo lo permite el backend para rol "super" -- por eso
// esta pantalla completa se restringe a ese rol, aunque crear/desactivar también lo pueda admin.
export default function UsersScreen() {
  const currentRole = useAuthStore((s) => s.user?.role);
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deactivateUser = useDeactivateUser();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('vendedor');
  const [error, setError] = useState<string | null>(null);

  const isValid = name.trim().length > 0 && username.trim().length > 0 && password.length >= 8;

  const handleCreate = async () => {
    if (!isValid) return;
    setError(null);
    try {
      await createUser.mutateAsync({ name: name.trim(), username: username.trim(), password, role });
      setName('');
      setUsername('');
      setPassword('');
      setRole('vendedor');
      setModalOpen(false);
    } catch {
      setError('No se pudo crear el usuario (¿el usuario ya existe?)');
    }
  };

  if (currentRole !== 'super') {
    return (
      <View style={styles.container}>
        <Text style={[styles.muted, { padding: 24 }]}>Solo el Super Admin puede ver la lista de usuarios.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.brand} />
      ) : (
        <FlatList
          data={users ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserRow user={item} onDeactivate={(id) => deactivateUser.mutate(id)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.muted}>No hay usuarios</Text>}
          contentContainerStyle={users?.length ? undefined : styles.emptyContainer}
        />
      )}

      <FAB icon="plus" style={styles.fab} color="white" customSize={56} onPress={() => setModalOpen(true)} />
      <Portal>
        <Modal visible={modalOpen} onDismiss={() => setModalOpen(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 16 }}>
            Nuevo usuario
          </Text>
          <TextInput label="Nombre" value={name} onChangeText={setName} style={styles.field} />
          <TextInput label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" style={styles.field} />
          <TextInput label="Contraseña (mín. 8 caracteres)" value={password} onChangeText={setPassword} secureTextEntry style={styles.field} />

          <PlatformPicker
            options={(Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            value={role}
            onChange={setRole}
            placeholder="Rol"
            textColor={colors.brandDark}
            style={styles.field}
          />

          {error && <HelperText type="error">{error}</HelperText>}

          <Button mode="contained" onPress={handleCreate} loading={createUser.isPending} disabled={!isValid} buttonColor={colors.brand}>
            Crear
          </Button>
        </Modal>
      </Portal>
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

import { View, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Avatar, Button, Divider, Text } from 'react-native-paper';
import Constants from 'expo-constants';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';

const ROLE_LABELS: Record<string, string> = {
  super: 'Super Admin',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
};

export function DrawerContent(props: DrawerContentComponentProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props}>
        <View style={styles.header}>
          <Avatar.Text size={48} label={(user?.name ?? '?').charAt(0).toUpperCase()} style={styles.avatar} />
          <Text variant="titleMedium" style={styles.name}>
            {user?.name ?? 'Usuario'}
          </Text>
          <Text variant="bodySmall" style={styles.role}>
            {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
          </Text>
        </View>
        <Divider />
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      <Divider />
      <View style={styles.footer}>
        <Button mode="text" icon="logout" textColor={colors.danger} onPress={() => logout()}>
          Cerrar sesión
        </Button>
        <Text variant="bodySmall" style={styles.version}>
          CloverApp Panamá v{Constants.expoConfig?.version ?? '0.1.0'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, backgroundColor: colors.brandLight },
  avatar: { backgroundColor: colors.brand },
  name: { marginTop: 8, fontWeight: '600' },
  role: { color: colors.textMuted },
  footer: { padding: 12 },
  version: { textAlign: 'center', color: colors.textMuted, marginTop: 4 },
});

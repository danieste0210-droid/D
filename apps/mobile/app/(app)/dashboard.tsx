import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';

// TODO(dashboard): gráficas de ventas del día, comisiones y premios pagados (ver módulo reports).
export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isVendedor = user?.role === 'vendedor';

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Hola, {user?.name ?? 'usuario'}</Text>
      <Text variant="bodyMedium" style={styles.role}>
        Rol: {user?.role}
      </Text>

      {isVendedor && (
        <Button
          mode="outlined"
          onPress={() => router.push('/(app)/printer/settings')}
          style={styles.printerButton}
          textColor={colors.brandDark}
          icon="printer"
        >
          Configurar impresora de tickets
        </Button>
      )}

      {/* app/(app)/_layout.tsx redirige a login solo con que `user` pase a null -- no hace
          falta navegar manualmente después de logout(). */}
      <Button mode="text" onPress={() => logout()} style={styles.logoutButton} textColor={colors.danger} icon="logout">
        Cerrar sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  role: { color: colors.textMuted, marginTop: 4 },
  printerButton: { marginTop: 24 },
  logoutButton: { marginTop: 12 },
});

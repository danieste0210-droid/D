import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuthStore } from '@/state/authStore';
import { colors } from '@/theme/colors';

// TODO(dashboard): gráficas de ventas del día, comisiones y premios pagados (ver módulo reports).
export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  role: { color: colors.textMuted, marginTop: 4 },
  printerButton: { marginTop: 24 },
});

import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/state/authStore';
import { useOfflineSync } from '@/offline/sync';
import { useRegisterPushToken } from '@/notifications/registerPushToken';
import { colors } from '@/theme/colors';

// Visibilidad de tabs en sync con los @Roles() del backend: ocultar (href: null) en vez de
// solo bloquear la acción evita que el usuario navegue a una pantalla que le va a dar 403.
export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  useOfflineSync();
  useRegisterPushToken();

  if (!user) return <Redirect href="/(auth)/login" />;

  const role = user.role;
  const canSeeResults = role === 'super' || role === 'admin';
  const canSeeReports = role === 'super' || role === 'admin' || role === 'supervisor';
  const canSeeUsers = role === 'super';

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.brand }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="sales/index" options={{ title: 'Ventas' }} />
      <Tabs.Screen name="lotteries/index" options={{ title: 'Loterías' }} />
      <Tabs.Screen name="closures/index" options={{ title: 'Cierres' }} />
      <Tabs.Screen name="results/index" options={{ title: 'Resultados', href: canSeeResults ? undefined : null }} />
      <Tabs.Screen name="reports/index" options={{ title: 'Reportes', href: canSeeReports ? undefined : null }} />
      <Tabs.Screen name="users/index" options={{ title: 'Usuarios', href: canSeeUsers ? undefined : null }} />
      <Tabs.Screen name="sales/new" options={{ href: null }} />
      <Tabs.Screen name="printer/settings" options={{ href: null }} />
    </Tabs>
  );
}

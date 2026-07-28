import { ComponentProps } from 'react';
import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/state/authStore';
import { useOfflineSync } from '@/offline/sync';
import { useRegisterPushToken } from '@/notifications/registerPushToken';
import { colors } from '@/theme/colors';
import { DrawerContent } from '@/navigation/DrawerContent';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function drawerIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => <MaterialCommunityIcons name={name} color={color} size={size} />;
}

// Visibilidad de ítems del drawer en sync con los @Roles() del backend: ocultar (drawerItemStyle
// display:none) en vez de solo bloquear la acción evita que el usuario navegue a una pantalla
// que le va a dar 403.
export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  useOfflineSync();
  useRegisterPushToken();

  if (!user) return <Redirect href="/(auth)/login" />;

  const role = user.role;
  const canSeeResults = role === 'super' || role === 'admin';
  const canSeeReports = role === 'super' || role === 'admin' || role === 'supervisor';
  const canSeeUsers = role === 'super' || role === 'admin';
  const canManageCatalog = role === 'super' || role === 'admin';
  const canSeeSupervisors = role === 'super' || role === 'admin';
  const isVendedor = role === 'vendedor';
  const hidden = { drawerItemStyle: { display: 'none' as const } };

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{ headerTintColor: colors.brand, drawerActiveTintColor: colors.brand }}
    >
      <Drawer.Screen name="dashboard" options={{ title: 'Inicio', drawerIcon: drawerIcon('home') }} />
      <Drawer.Screen name="sales/index" options={{ title: 'Ventas', drawerIcon: drawerIcon('ticket') }} />
      <Drawer.Screen name="lotteries/index" options={{ title: 'Loterías', drawerIcon: drawerIcon('cash-multiple') }} />
      <Drawer.Screen name="closures/index" options={{ title: 'Cierres', drawerIcon: drawerIcon('clock-outline') }} />
      <Drawer.Screen
        name="results/index"
        options={{ title: 'Resultados', drawerIcon: drawerIcon('trophy'), ...(canSeeResults ? {} : hidden) }}
      />
      <Drawer.Screen
        name="reports/index"
        options={{ title: 'Reportes', drawerIcon: drawerIcon('chart-bar'), ...(canSeeReports ? {} : hidden) }}
      />
      <Drawer.Screen
        name="global-sales/index"
        options={{ title: 'Ventas Globales', drawerIcon: drawerIcon('earth'), ...(canSeeReports ? {} : hidden) }}
      />
      <Drawer.Screen
        name="multipliers/index"
        options={{ title: 'Multiplicadores', drawerIcon: drawerIcon('multiplication'), ...(canManageCatalog ? {} : hidden) }}
      />
      <Drawer.Screen
        name="blocked-numbers/index"
        options={{ title: 'Bloquear números', drawerIcon: drawerIcon('cancel'), ...(canManageCatalog ? {} : hidden) }}
      />
      <Drawer.Screen
        name="delete-sales/index"
        options={{ title: 'Eliminar Ventas', drawerIcon: drawerIcon('delete-outline'), ...(canManageCatalog ? {} : hidden) }}
      />
      <Drawer.Screen
        name="supervisors/index"
        options={{ title: 'Supervisores', drawerIcon: drawerIcon('account-supervisor'), ...(canSeeSupervisors ? {} : hidden) }}
      />
      <Drawer.Screen
        name="users/index"
        options={{ title: 'Usuarios', drawerIcon: drawerIcon('account-group'), ...(canSeeUsers ? {} : hidden) }}
      />
      <Drawer.Screen
        name="last-sale/index"
        options={{ title: 'Última Venta', drawerIcon: drawerIcon('receipt'), ...(isVendedor ? {} : hidden) }}
      />
      <Drawer.Screen name="sales/new" options={hidden} />
      <Drawer.Screen name="printer/settings" options={hidden} />
    </Drawer>
  );
}

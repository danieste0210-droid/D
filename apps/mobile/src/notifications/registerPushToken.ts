import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '@/api/client';
import { endpoints } from '@/api/endpoints';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requiere dispositivo físico (los simuladores/emuladores no reciben push reales) y, para
// builds standalone con EAS, un projectId en app.json (extra.eas.projectId) -- en Expo Go
// alcanza con lo de aquí. No se pudo probar en un dispositivo real en este entorno de desarrollo.
async function requestTokenAndRegister() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  await apiFetch(endpoints.auth.pushToken, { method: 'POST', body: JSON.stringify({ token }) });
}

// Se monta una sola vez por sesión autenticada (ver app/(app)/_layout.tsx).
export function useRegisterPushToken() {
  useEffect(() => {
    requestTokenAndRegister().catch(() => {
      // Silencioso a propósito: sin permisos o sin push token no debe romper el flujo de la app.
    });
  }, []);
}

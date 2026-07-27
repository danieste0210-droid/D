import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store no implementa getValueWithKeyAsync en web (usa el keychain nativo de
// iOS/Android) -- sin este fallback, `expo start --web` truena con "is not a function" apenas
// se monta la app. localStorage no es tan seguro como el keychain nativo, pero es aceptable
// para desarrollo/preview en web; en producción esta app corre como app nativa, no en browser.
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

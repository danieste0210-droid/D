import Constants from 'expo-constants';

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ?? 'http://localhost:3000/v1';

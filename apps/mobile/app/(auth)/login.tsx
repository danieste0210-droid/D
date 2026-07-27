import { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { router } from 'expo-router';
import { colors } from '@/theme/colors';
import { apiFetch } from '@/api/client';
import { endpoints } from '@/api/endpoints';
import { useAuthStore } from '@/state/authStore';

// TODO(login): manejo de errores de red/credenciales inválidas con feedback visual,
// soporte 2FA para admins (input de código tras login exitoso con requiresTwoFactor).
export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; name: string; username: string; role: 'super' | 'admin' | 'supervisor' | 'vendedor' };
      }>(endpoints.auth.login, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      await setSession(result);
      router.replace('/(app)/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        CloverApp Panamá
      </Text>
      <TextInput label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" style={styles.input} />
      <TextInput label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      <Button mode="contained" onPress={handleLogin} loading={loading} buttonColor={colors.brand}>
        Ingresar
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { textAlign: 'center', marginBottom: 32, color: colors.brandDark },
  input: { marginBottom: 16 },
});

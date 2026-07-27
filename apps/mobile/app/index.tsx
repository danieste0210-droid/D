import { Redirect } from 'expo-router';
import { useAuthStore } from '@/state/authStore';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={user ? '/(app)/dashboard' : '/(auth)/login'} />;
}

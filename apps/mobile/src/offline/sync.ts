import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { createSale } from '@/api/sales';
import { ApiError } from '@/api/client';
import { getQueue, removeFromQueue } from './queue';

let draining = false;

async function drainQueue(onSaleSynced: () => void) {
  if (draining) return;
  draining = true;
  try {
    const queue = await getQueue();
    for (const item of queue) {
      try {
        await createSale({ lotteryId: item.lotteryId, numberPlayed: item.numberPlayed, amount: item.amount, betType: item.betType });
        await removeFromQueue(item.id);
        onSaleSynced();
      } catch (err) {
        if (err instanceof ApiError) {
          // El servidor rechazó la venta (p.ej. la lotería ya cerró) -- reintentar no la va a
          // arreglar. Se descarta para no bloquear el resto de la cola.
          // TODO(offline): avisar al vendedor qué venta se perdió y por qué.
          await removeFromQueue(item.id);
          continue;
        }
        // Fallo de red: seguimos sin conexión real pese al evento de NetInfo. Se deja el resto
        // en la cola para el próximo intento.
        break;
      }
    }
  } finally {
    draining = false;
  }
}

// Se monta una sola vez por sesión autenticada (ver app/(app)/_layout.tsx). Drena la cola al
// detectar reconexión y también al montar, por si quedó algo pendiente de una sesión anterior.
export function useOfflineSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const notify = () => queryClient.invalidateQueries({ queryKey: ['sales-mine'] });

    void drainQueue(notify);

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void drainQueue(notify);
      }
    });

    return () => unsubscribe();
  }, [queryClient]);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'offline_sales_queue';

export interface QueuedSale {
  id: string; // uuid local, generado en el cliente
  lotteryId: string;
  numberPlayed: string;
  amount: number;
  createdAt: string;
}

// Cola simple para ventas creadas sin señal. Se drena cuando vuelve la conexión
// (ver hook useOfflineSync, pendiente de implementar) llamando a sales.process por cada item
// y removiéndolo solo si el backend confirma éxito.
export async function enqueueSale(sale: QueuedSale): Promise<void> {
  const queue = await getQueue();
  queue.push(sale);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedSale[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((s) => s.id !== id)));
}

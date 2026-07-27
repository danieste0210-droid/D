import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'paired_printer';

interface PrinterState {
  deviceId: string | null;
  deviceName: string | null;
  setPrinter: (deviceId: string, deviceName: string) => Promise<void>;
  hydrate: () => Promise<void>;
  clear: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set) => ({
  deviceId: null,
  deviceName: null,

  setPrinter: async (deviceId, deviceName) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ deviceId, deviceName }));
    set({ deviceId, deviceName });
  },

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const { deviceId, deviceName } = JSON.parse(raw);
    set({ deviceId, deviceName });
  },

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ deviceId: null, deviceName: null });
  },
}));

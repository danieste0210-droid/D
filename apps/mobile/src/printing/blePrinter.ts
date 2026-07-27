import { BleManager, Device } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

// UUIDs de servicio/característica de escritura de las impresoras BLE 58mm genéricas más
// comunes (clones compatibles con apps tipo "Bluetooth Print"). NO hay un estándar universal
// para impresoras térmicas BLE -- esto casi seguro necesita ajustarse al modelo real (ver
// NEXT_STEPS.md). Para encontrar los UUIDs correctos: escanear con una app tipo "nRF Connect"
// contra la impresora real y ubicar el servicio con una característica "Write".
const PRINTER_SERVICE_UUID = '0000ff00-0000-1000-8000-00805f9b34fb';
const PRINTER_WRITE_CHARACTERISTIC_UUID = '0000ff02-0000-1000-8000-00805f9b34fb';

// BLE típicamente limita cada escritura a ~180-512 bytes (según el MTU negociado) -- se manda
// el ticket en bloques para no truncarlo.
const CHUNK_SIZE = 180;

let manager: BleManager | null = null;

function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

function toBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | ((b2 ?? 0) >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | ((b3 ?? 0) >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

// Escanea dispositivos BLE cercanos. Devuelve una función para detener el escaneo manualmente
// (además del timeout automático).
export function scanForPrinters(onDevice: (device: Device) => void, timeoutMs = 8000): () => void {
  const ble = getManager();
  ble.startDeviceScan(null, null, (error, device) => {
    if (error || !device?.name) return;
    onDevice(device);
  });

  const timeout = setTimeout(() => ble.stopDeviceScan(), timeoutMs);
  return () => {
    clearTimeout(timeout);
    ble.stopDeviceScan();
  };
}

export async function printTicket(deviceId: string, ticket: Uint8Array): Promise<void> {
  const ble = getManager();
  const device: Device = await ble.connectToDevice(deviceId);
  await device.discoverAllServicesAndCharacteristics();

  for (let offset = 0; offset < ticket.length; offset += CHUNK_SIZE) {
    const chunk = ticket.slice(offset, offset + CHUNK_SIZE);
    await device.writeCharacteristicWithoutResponseForService(
      PRINTER_SERVICE_UUID,
      PRINTER_WRITE_CHARACTERISTIC_UUID,
      toBase64(chunk),
    );
  }

  await device.cancelConnection();
}

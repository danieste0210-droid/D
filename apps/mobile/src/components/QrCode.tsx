import { View } from 'react-native';
import QRCodeCore from 'qrcode/lib/core/qrcode';

interface QrCodeProps {
  value: string;
  size?: number;
}

// QR en pantalla (no impreso) como grilla de Views -- reutiliza el mismo cálculo de matriz de
// `qrcode/lib/core/qrcode` que ya usa printing/escpos.ts para el QR raster de la impresora
// térmica, así no se agrega una dependencia nueva (react-native-svg, etc.) solo para esto.
export function QrCode({ value, size = 200 }: QrCodeProps) {
  const qr = QRCodeCore.create(value, { errorCorrectionLevel: 'M' });
  const moduleCount = qr.modules.size;
  const data = qr.modules.data;
  const moduleSize = size / moduleCount;

  return (
    <View style={{ width: size, height: size, backgroundColor: 'white' }}>
      {Array.from({ length: moduleCount }).map((_, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {Array.from({ length: moduleCount }).map((_, x) => {
            const isBlack = data[y * moduleCount + x] & 1;
            return (
              <View
                key={x}
                style={{ width: moduleSize, height: moduleSize, backgroundColor: isBlack ? 'black' : 'white' }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

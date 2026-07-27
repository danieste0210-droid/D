// Comandos ESC/POS genéricos, compatibles con la mayoría de impresoras térmicas 58mm/80mm con
// BLE. El set exacto de comandos y códigos de escape puede variar por fabricante -- esto cubre
// el subconjunto más universal (texto, alineación, feed, corte, QR como imagen raster).
//
// Import interno a propósito: qrcode/lib/core/qrcode expone solo el cálculo de la matriz del QR
// (sin canvas ni Buffer), a diferencia del entrypoint público que sí los necesita y no corre en
// React Native. Ver src/types/qrcode-core.d.ts para el shim de tipos.
import QRCodeCore from 'qrcode/lib/core/qrcode';

const ESC = 0x1b;
const GS = 0x1d;

function textToBytes(text: string): number[] {
  // ESC/POS clásico usa codepages tipo CP437/Latin1, no UTF-8 -- sin configurar la codepage de
  // la impresora (ESC t), tildes/ñ salen como basura. Se normalizan como fallback seguro.
  // TODO(printing): detectar/configurar la codepage real de la impresora en vez de degradar texto.
  const normalized = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return Array.from(normalized).map((ch) => ch.charCodeAt(0) & 0xff);
}

export class TicketBuilder {
  private chunks: number[] = [];

  init() {
    this.chunks.push(ESC, 0x40);
    return this;
  }

  alignCenter() {
    this.chunks.push(ESC, 0x61, 1);
    return this;
  }

  alignLeft() {
    this.chunks.push(ESC, 0x61, 0);
    return this;
  }

  bold(on: boolean) {
    this.chunks.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleHeight(on: boolean) {
    this.chunks.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  line(text = '') {
    this.chunks.push(...textToBytes(text), 0x0a);
    return this;
  }

  feed(lines = 1) {
    for (let i = 0; i < lines; i++) this.chunks.push(0x0a);
    return this;
  }

  // Corte parcial (GS V 1) -- impresoras BLE baratas sin cuchilla automática simplemente lo ignoran.
  cut() {
    this.chunks.push(GS, 0x56, 1);
    return this;
  }

  // Imprime el QR como imagen raster monocromo (GS v 0) en vez de los comandos QR nativos
  // (GS ( k), que varían mucho entre fabricantes -- el modo raster es el más universal.
  qrCode(text: string, moduleSize = 3) {
    const qr = QRCodeCore.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const data = qr.modules.data; // 1 byte por módulo, bit 0 = negro/blanco

    const widthBytes = Math.ceil((size * moduleSize) / 8);
    const heightPx = size * moduleSize;
    const raster: number[] = [];

    for (let y = 0; y < heightPx; y++) {
      const moduleY = Math.floor(y / moduleSize);
      const rowBytes = new Uint8Array(widthBytes);
      for (let x = 0; x < size; x++) {
        const isBlack = data[moduleY * size + x] & 1;
        if (!isBlack) continue;
        for (let dx = 0; dx < moduleSize; dx++) {
          const px = x * moduleSize + dx;
          rowBytes[px >> 3] |= 0x80 >> (px & 7);
        }
      }
      raster.push(...rowBytes);
    }

    this.chunks.push(
      GS,
      0x76,
      0x30,
      0x00,
      widthBytes & 0xff,
      (widthBytes >> 8) & 0xff,
      heightPx & 0xff,
      (heightPx >> 8) & 0xff,
      ...raster,
    );
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

export interface TicketData {
  lotteryName: string;
  numberPlayed: string;
  amount: number;
  ticketCode: string;
  sellerName: string;
  createdAt: string;
}

export function buildSaleTicket(data: TicketData): Uint8Array {
  const date = new Date(data.createdAt).toLocaleString('es-PA');
  return new TicketBuilder()
    .init()
    .alignCenter()
    .bold(true)
    .doubleHeight(true)
    .line('CloverApp Panama')
    .doubleHeight(false)
    .bold(false)
    .line(data.lotteryName)
    .line('--------------------------------')
    .alignLeft()
    .line(`Numero: ${data.numberPlayed}`)
    .line(`Monto: $${data.amount.toFixed(2)}`)
    .line(`Vendedor: ${data.sellerName}`)
    .line(`Fecha: ${date}`)
    .line('--------------------------------')
    .alignCenter()
    .qrCode(data.ticketCode)
    .feed(1)
    .line(data.ticketCode)
    .feed(3)
    .cut()
    .build();
}

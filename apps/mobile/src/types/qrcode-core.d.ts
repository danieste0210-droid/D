// `qrcode` no publica tipos para su entrada interna lib/core/qrcode (sin canvas/Buffer,
// segura para React Native -- ver comentario en src/printing/escpos.ts).
declare module 'qrcode/lib/core/qrcode' {
  export interface QRCodeModules {
    size: number;
    data: Uint8Array;
  }

  export interface QRCodeData {
    modules: QRCodeModules;
  }

  export function create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): QRCodeData;

  const _default: { create: typeof create };
  export default _default;
}

import * as FileSystem from 'expo-file-system';
import { apiFetch } from './client';
import { API_URL } from './config';
import { endpoints } from './endpoints';
import { useAuthStore } from '@/state/authStore';

export interface SalesSummaryRow {
  sellerId: string;
  lotteryId: string;
  _sum: { amount: string | null };
  _count: number;
}

export function getSalesSummary(from: string, to: string): Promise<SalesSummaryRow[]> {
  return apiFetch<SalesSummaryRow[]>(`${endpoints.reports.sales}?from=${from}&to=${to}`);
}

// Los endpoints de export devuelven binarios (xlsx/pdf), no JSON -- apiFetch no sirve aquí.
// Se descarga con auth manual a un archivo local y se devuelve su URI para compartir/abrir.
export async function downloadSalesReport(format: 'excel' | 'pdf', from: string, to: string): Promise<string> {
  const accessToken = useAuthStore.getState().accessToken;
  const path = format === 'excel' ? endpoints.reports.exportExcel : endpoints.reports.exportPdf;
  const extension = format === 'excel' ? 'xlsx' : 'pdf';
  const fileUri = `${FileSystem.cacheDirectory}ventas_${from}_${to}.${extension}`;

  const result = await FileSystem.downloadAsync(`${API_URL}${path}?from=${from}&to=${to}`, fileUri, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (result.status !== 200) {
    throw new Error(`No se pudo descargar el reporte (status ${result.status})`);
  }

  return result.uri;
}

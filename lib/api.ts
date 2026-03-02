import { Order, DashboardStats, ApiResponse } from './types';
import { getCached, setCached, invalidateCache } from './cache';

const BASE = '/api/proxy';

async function post<T>(action: string, body: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function get<T>(action: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
  const query = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${BASE}?${query}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────
export async function apiLogin(username: string, password: string) {
  return post<{ username: string; role: string }>('login', { username, password });
}

// ─── Orders (with sessionStorage cache) ─────────────────
export async function apiGetOrders(): Promise<ApiResponse<Order[]>> {
  const cached = getCached<Order[]>('wp_orders');
  if (cached) return { success: true, data: cached };

  const res = await get<Order[]>('getOrders');
  if (res.success && res.data) setCached('wp_orders', res.data);
  return res;
}

export async function apiGetOrdersForce(): Promise<ApiResponse<Order[]>> {
  invalidateCache('wp_orders');
  const res = await get<Order[]>('getOrders');
  if (res.success && res.data) setCached('wp_orders', res.data);
  return res;
}

export async function apiAddOrder(data: Record<string, unknown>) {
  const res = await post<{ rowIndex: number; no: number; noWorkOrder: string; tglSelesai: string }>('addOrder', data);
  if (res.success) invalidateCache('wp_orders', 'wp_dashboard');
  return res;
}

export async function apiUpdateOrder(data: Record<string, unknown>) {
  const res = await post<void>('updateOrder', data);
  if (res.success) invalidateCache('wp_orders', 'wp_dashboard');
  return res;
}

export async function apiUpdateProgress(data: {
  rowIndex: number;
  stage: string;
  checked: boolean;
  tglKirim?: string;
}) {
  const res = await post<void>('updateProgress', data);
  if (res.success) invalidateCache('wp_orders', 'wp_dashboard');
  return res;
}

// ─── Dashboard ───────────────────────────────────────────
export async function apiGetDashboard(): Promise<ApiResponse<DashboardStats>> {
  const cached = getCached<DashboardStats>('wp_dashboard');
  if (cached) return { success: true, data: cached };

  const res = await get<DashboardStats>('getDashboard');
  if (res.success && res.data) setCached('wp_dashboard', res.data);
  return res;
}

export async function apiGetDashboardForce(): Promise<ApiResponse<DashboardStats>> {
  invalidateCache('wp_dashboard');
  const res = await get<DashboardStats>('getDashboard');
  if (res.success && res.data) setCached('wp_dashboard', res.data);
  return res;
}

export async function apiGetCapacity() {
  return get<Record<string, number>>('getCapacity');
}

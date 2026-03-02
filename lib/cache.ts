const TTL = 30_000; // 30 seconds

export function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > TTL) { sessionStorage.removeItem(key); return null; }
    return data as T;
  } catch { return null; }
}

export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export function invalidateCache(...keys: string[]): void {
  if (typeof window === 'undefined') return;
  keys.forEach(k => { try { sessionStorage.removeItem(k); } catch {} });
}

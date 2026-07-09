'use server';
/**
 * Server actions that talk to the QRganize home-inventory REST API.
 * Config via env: QRGANIZE_API_URL (optional) and QRGANIZE_UUID (per-device id).
 */

const QRGANIZE_API_URL =
  process.env.QRGANIZE_API_URL || 'https://us-central1-qrganize-f651b.cloudfunctions.net/app';
const QRGANIZE_UUID = process.env.QRGANIZE_UUID || '';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  onShoppingList: boolean;
}

export interface QrganizeResult<T> {
  configured: boolean;
  data: T;
  error?: string;
}

async function qrganize(path: string, init: RequestInit = {}) {
  const res = await fetch(`${QRGANIZE_API_URL}${path}`, {
    ...init,
    headers: {
      uuid: QRGANIZE_UUID,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`QRganize ${init.method || 'GET'} ${path} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Returns the QRganize inventory (names + quantity + shopping-list flag). */
export async function getQrganizeInventory(): Promise<QrganizeResult<InventoryItem[]>> {
  if (!QRGANIZE_UUID) {
    return { configured: false, data: [], error: 'QRganize is not configured (missing QRGANIZE_UUID).' };
  }
  try {
    const result = await qrganize('/api/items/getAll');
    const items: InventoryItem[] = (result?.data || []).map((i: any) => ({
      id: i.id,
      name: (i.name || '').trim(),
      quantity: Number(i.quantity) || 0,
      onShoppingList: !!i.shoppingList,
    }));
    return { configured: true, data: items };
  } catch (error) {
    return { configured: true, data: [], error: error instanceof Error ? error.message : 'Failed to reach QRganize.' };
  }
}

/** Adds an item to the QRganize shopping list (flags an existing item or creates one). */
export async function addToQrganizeShoppingList(name: string): Promise<QrganizeResult<{ created: boolean }>> {
  if (!QRGANIZE_UUID) {
    return { configured: false, data: { created: false }, error: 'QRganize is not configured (missing QRGANIZE_UUID).' };
  }
  try {
    const all = await qrganize('/api/items/getAll');
    const norm = (s: string) => (s || '').trim().toLowerCase();
    const existing = (all?.data || []).find((i: any) => norm(i.name) === norm(name));
    if (existing) {
      await qrganize(`/api/items/shoppingList/${existing.id}`, { method: 'PUT', body: JSON.stringify({ shoppingList: true }) });
      return { configured: true, data: { created: false } };
    }
    await qrganize('/api/items/create', {
      method: 'POST',
      body: JSON.stringify({ name, price: '0', quantity: 1, shoppingList: true, image: null, expirationDate: null }),
    });
    return { configured: true, data: { created: true } };
  } catch (error) {
    return { configured: true, data: { created: false }, error: error instanceof Error ? error.message : 'Failed to reach QRganize.' };
  }
}

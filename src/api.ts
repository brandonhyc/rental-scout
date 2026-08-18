import type { DB, ImportPreview, Listing, RefreshSummary, Settings } from './types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export type AppState = Pick<DB, 'listings' | 'settings' | 'fetchLog'>;

export const api = {
  state: () => req<AppState>('/api/state'),
  refresh: () => req<RefreshSummary>('/api/refresh', { method: 'POST' }),
  importUrl: (url: string) => req<ImportPreview & { existingId?: string }>('/api/import/url', { method: 'POST', body: JSON.stringify({ url }) }),
  importText: (text: string, url?: string) =>
    req<ImportPreview & { existingId?: string }>('/api/import/text', { method: 'POST', body: JSON.stringify({ text, url }) }),
  createListing: (listing: Partial<Listing>) => req<Listing>('/api/listings', { method: 'POST', body: JSON.stringify(listing) }),
  updateListing: (id: string, patch: Partial<Listing>) => req<Listing>(`/api/listings/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteListing: (id: string) => req<{ ok: true }>(`/api/listings/${id}`, { method: 'DELETE' }),
  saveSettings: (settings: Settings) => req<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};

import { Search } from 'lucide-react';
import type { Listing, ListingStatus, Settings } from '../types';

export interface Filters {
  query: string;
  status: 'active' | 'all' | ListingStatus;
  city: string; // '' = all
  beds: 'any' | '1' | '2';
  maxPrice: string; // '' = none; for 2BR compares your share
  catOnly: boolean;
  commuteOnly: boolean;
  hideGone: boolean;
  sort: 'score' | 'price' | 'newest' | 'commute';
}

export const defaultFilters: Filters = {
  query: '',
  status: 'active',
  city: '',
  beds: 'any',
  maxPrice: '',
  catOnly: false,
  commuteOnly: false,
  hideGone: true,
  sort: 'score',
};

export function applyFilters(listings: Listing[], f: Filters): Listing[] {
  let out = listings.filter((l) => {
    if (f.status === 'active') {
      if (['rejected', 'hidden'].includes(l.status)) return false;
    } else if (f.status !== 'all' && l.status !== f.status) return false;
    if (f.city && l.city !== f.city) return false;
    if (f.beds !== 'any' && l.beds !== Number(f.beds)) return false;
    if (f.maxPrice) {
      const cap = Number(f.maxPrice);
      const effective = l.beds >= 2 && l.yourShare ? l.yourShare : l.price;
      if (effective > cap) return false;
    }
    if (f.catOnly && l.catPolicy !== 'yes') return false;
    if (f.commuteOnly && (l.commuteMinutes === undefined || l.commuteMinutes > 30)) return false;
    if (f.hideGone && l.possiblyGone) return false;
    if (f.query) {
      const hay = [l.title, l.address, l.city, l.description, l.notes, l.tags.join(' ')].join(' ').toLowerCase();
      if (!hay.includes(f.query.toLowerCase())) return false;
    }
    return true;
  });
  out = [...out];
  switch (f.sort) {
    case 'score':
      out.sort((a, b) => b.score - a.score);
      break;
    case 'price':
      out.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
      break;
    case 'newest':
      out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'commute':
      out.sort((a, b) => (a.commuteMinutes ?? 999) - (b.commuteMinutes ?? 999));
      break;
  }
  return out;
}

const STATUS_OPTIONS: { value: Filters['status']; label: string }[] = [
  { value: 'active', label: 'Active (not rejected/hidden)' },
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'interested', label: 'Interested' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'toured', label: 'Toured' },
  { value: 'applied', label: 'Applied' },
  { value: 'signed', label: 'Signed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hidden', label: 'Hidden' },
];

export default function FiltersBar({
  filters,
  setFilters,
  settings,
  count,
  total,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  settings: Settings;
  count: number;
  total: number;
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const inputCls = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="relative">
        <Search className="absolute top-2 left-2 h-4 w-4 text-slate-400" />
        <input
          className={`${inputCls} w-48 pl-7`}
          placeholder="Search…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
        />
      </div>
      <select className={inputCls} value={filters.status} onChange={(e) => set({ status: e.target.value as Filters['status'] })}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <select className={inputCls} value={filters.city} onChange={(e) => set({ city: e.target.value })}>
        <option value="">All cities</option>
        {settings.cities.map((c) => (
          <option key={c.name} value={c.name}>{c.name}</option>
        ))}
      </select>
      <select className={inputCls} value={filters.beds} onChange={(e) => set({ beds: e.target.value as Filters['beds'] })}>
        <option value="any">Any beds</option>
        <option value="1">1 BR</option>
        <option value="2">2 BR</option>
      </select>
      <input
        className={`${inputCls} w-32`}
        placeholder="Max $ (share)"
        type="number"
        value={filters.maxPrice}
        onChange={(e) => set({ maxPrice: e.target.value })}
      />
      <label className="flex items-center gap-1 text-sm text-slate-600">
        <input type="checkbox" checked={filters.catOnly} onChange={(e) => set({ catOnly: e.target.checked })} /> Cat OK only
      </label>
      <label className="flex items-center gap-1 text-sm text-slate-600">
        <input type="checkbox" checked={filters.commuteOnly} onChange={(e) => set({ commuteOnly: e.target.checked })} /> ≤30 min commute
      </label>
      <label className="flex items-center gap-1 text-sm text-slate-600">
        <input type="checkbox" checked={filters.hideGone} onChange={(e) => set({ hideGone: e.target.checked })} /> Hide likely-gone
      </label>
      <select className={`${inputCls} ml-auto`} value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters['sort'] })}>
        <option value="score">Sort: best match</option>
        <option value="price">Sort: price ↑</option>
        <option value="newest">Sort: newest</option>
        <option value="commute">Sort: commute ↑</option>
      </select>
      <span className="text-xs text-slate-400">{count}/{total}</span>
    </div>
  );
}

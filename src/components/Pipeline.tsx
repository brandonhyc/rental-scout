import type { Listing, ListingStatus } from '../types';
import { STATUS_META, scoreColor } from './ListingCard';

const COLUMNS: ListingStatus[] = ['new', 'interested', 'contacted', 'toured', 'applied', 'signed'];

export default function Pipeline({
  listings,
  onOpen,
  onPatch,
}: {
  listings: Listing[];
  onOpen: (id: string) => void;
  onPatch: (id: string, patch: Partial<Listing>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {COLUMNS.map((status) => {
        const items = listings.filter((l) => l.status === status).sort((a, b) => b.score - a.score);
        return (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-2">
            <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_META[status].cls}`}>{STATUS_META[status].label}</span>
              <span className="text-xs text-slate-400">{items.length}</span>
            </h3>
            <div className="space-y-2">
              {items.map((l) => {
                const idx = COLUMNS.indexOf(status);
                const next = idx >= 0 && idx < COLUMNS.length - 1 ? COLUMNS[idx + 1] : null;
                return (
                  <div key={l.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                    <button onClick={() => onOpen(l.id)} className="line-clamp-2 text-left font-medium hover:text-indigo-700">
                      {l.title}
                    </button>
                    <div className="mt-1 flex items-center gap-2 text-slate-500">
                      <span className={`rounded px-1 font-bold text-white ${scoreColor(l.score)}`}>{l.score}</span>
                      <span>${l.price.toLocaleString()}</span>
                      {l.city && <span className="truncate">{l.city}</span>}
                    </div>
                    {next && (
                      <button
                        onClick={() => onPatch(l.id, { status: next })}
                        className="mt-1.5 w-full rounded border border-indigo-200 px-1 py-0.5 text-indigo-600 hover:bg-indigo-50"
                      >
                        → {STATUS_META[next].label}
                      </button>
                    )}
                  </div>
                );
              })}
              {items.length === 0 && <p className="px-1 pb-1 text-xs text-slate-300">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

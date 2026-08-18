import { useState } from 'react';
import { X, ExternalLink, Trash2, ShieldCheck } from 'lucide-react';
import type { CatPolicy, Listing, ListingStatus, Settings } from '../types';
import { STATUS_META, scoreColor } from './ListingCard';

export default function ListingDetailModal({
  listing,
  settings,
  onClose,
  onPatch,
  onDelete,
}: {
  listing: Listing;
  settings: Settings;
  onClose: () => void;
  onPatch: (patch: Partial<Listing>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(listing.notes);
  const [tags, setTags] = useState(listing.tags.join(', '));
  const city = settings.cities.find((c) => c.name === listing.city);
  const inputCls = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

  const saveNotes = () => {
    onPatch({ notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onClose}>
      <div className="mt-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-bold">{listing.title}</h2>
            <p className="text-sm text-slate-500">
              {listing.address || listing.city || 'Location unknown'}
              {listing.availableDate && ` · Available ${listing.availableDate}`}
            </p>
          </div>
          <span className={`ml-auto rounded-full px-2.5 py-1 text-sm font-bold text-white ${scoreColor(listing.score)}`}>
            {listing.score}
          </span>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-3">
            {listing.imageUrl && <img src={listing.imageUrl} alt="" className="w-full rounded-lg object-cover" />}
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Price ($/mo)
                <input
                  className={inputCls}
                  type="number"
                  defaultValue={listing.price || ''}
                  onBlur={(e) => Number(e.target.value) !== listing.price && onPatch({ price: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-slate-500">
                City
                <select className={inputCls} value={listing.city ?? ''} onChange={(e) => onPatch({ city: e.target.value || undefined })}>
                  <option value="">(unknown)</option>
                  {settings.cities.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Beds
                <input className={inputCls} type="number" defaultValue={listing.beds} onBlur={(e) => onPatch({ beds: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-slate-500">
                Baths
                <input className={inputCls} type="number" step="0.5" defaultValue={listing.baths ?? ''} onBlur={(e) => e.target.value && onPatch({ baths: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-slate-500">
                Cat policy
                <select className={inputCls} value={listing.catPolicy} onChange={(e) => onPatch({ catPolicy: e.target.value as CatPolicy })}>
                  <option value="yes">Cats OK</option>
                  <option value="no">No cats</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Status
                <select className={inputCls} value={listing.status} onChange={(e) => onPatch({ status: e.target.value as ListingStatus })}>
                  {Object.entries(STATUS_META).map(([value, m]) => (
                    <option key={value} value={value}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {listing.beds >= 2 && listing.yourShare !== undefined && (
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                Roommate split: ~<b>${listing.yourShare.toLocaleString()}</b>/person — {listing.yourShare <= settings.twoBrMaxShare ? 'within' : 'OVER'} your ${settings.twoBrMaxShare} share cap.
              </p>
            )}
            {city && (
              <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <b>{city.name}</b> — safety {city.safetyRating}/5. {city.safetyNote}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="mb-1 text-sm font-semibold">Score breakdown</h3>
              <ul className="space-y-1 text-xs">
                {listing.scoreParts.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`w-10 shrink-0 text-right font-mono font-semibold ${p.points >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {p.points >= 0 ? '+' : ''}{p.points}
                    </span>
                    <span className="text-slate-600">
                      <b>{p.label}:</b> {p.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {listing.priceHistory.length > 1 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Price history</h3>
                <ul className="text-xs text-slate-600">
                  {listing.priceHistory.map((p, i) => (
                    <li key={i}>{p.date}: ${p.price.toLocaleString()}</li>
                  ))}
                </ul>
              </div>
            )}
            <label className="block text-xs text-slate-500">
              Notes
              <textarea className={`${inputCls} h-24`} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Viewing impressions, landlord contact, questions to ask…" />
            </label>
            <label className="block text-xs text-slate-500">
              Tags (comma-separated)
              <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} onBlur={saveNotes} placeholder="in-unit laundry, parking, top pick" />
            </label>
            {listing.description && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">Description</summary>
                <p className="mt-1 whitespace-pre-wrap">{listing.description}</p>
              </details>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 p-4">
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-indigo-600 hover:underline">
              Open on {listing.source} <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => {
              if (confirm('Delete this listing permanently? (Use status "Hidden" or "Rejected" to keep a record instead.)')) onDelete();
            }}
            className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

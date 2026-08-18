import { useState } from 'react';
import { X, Link2, ClipboardPaste, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { CatPolicy, Listing, Settings } from '../types';

type Mode = 'url' | 'text';

export default function ImportModal({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Listing> | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  const inputCls = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

  const parse = async () => {
    setLoading(true);
    setError(null);
    try {
      const preview = mode === 'url' ? await api.importUrl(url.trim()) : await api.importText(text, url.trim() || undefined);
      setDraft({ catPolicy: 'unknown', beds: 1, ...preview.listing });
      setWarnings(preview.warnings);
      setExistingId(preview.existingId ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      if (existingId) {
        await api.updateListing(existingId, draft);
      } else {
        await api.createListing({ ...draft, status: 'interested' });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  const setD = (patch: Partial<Listing>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onClose}>
      <div className="mt-8 w-full max-w-xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">Add a listing</h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 ${mode === 'url' ? 'bg-white shadow' : 'text-slate-500'}`}
              onClick={() => setMode('url')}
            >
              <Link2 className="h-4 w-4" /> From URL
            </button>
            <button
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 ${mode === 'text' ? 'bg-white shadow' : 'text-slate-500'}`}
              onClick={() => setMode('text')}
            >
              <ClipboardPaste className="h-4 w-4" /> Paste text
            </button>
          </div>

          <input className={inputCls} placeholder="Listing URL (Craigslist, Zillow, Apartments.com, …)" value={url} onChange={(e) => setUrl(e.target.value)} />
          {mode === 'text' && (
            <textarea
              className={`${inputCls} h-32`}
              placeholder="Open the listing page, select all (Cmd/Ctrl+A), copy, and paste here. Works even for sites that block automated fetching (e.g. Zillow)."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}
          <button
            onClick={parse}
            disabled={loading || (mode === 'url' ? !url.trim() : !text.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Parse listing
          </button>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {warnings.map((w, i) => (
            <p key={i} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>
          ))}

          {draft && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-semibold">{existingId ? 'Update saved listing' : 'Review & save'}</h3>
              <label className="block text-xs text-slate-500">
                Title
                <input className={inputCls} value={draft.title ?? ''} onChange={(e) => setD({ title: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500">
                  Price ($/mo)
                  <input className={inputCls} type="number" value={draft.price ?? ''} onChange={(e) => setD({ price: Number(e.target.value) })} />
                </label>
                <label className="text-xs text-slate-500">
                  City
                  <select className={inputCls} value={draft.city ?? ''} onChange={(e) => setD({ city: e.target.value || undefined })}>
                    <option value="">(pick a city)</option>
                    {settings.cities.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Beds (0 = studio)
                  <input className={inputCls} type="number" value={draft.beds ?? ''} onChange={(e) => setD({ beds: Number(e.target.value) })} />
                </label>
                <label className="text-xs text-slate-500">
                  Baths
                  <input className={inputCls} type="number" step="0.5" value={draft.baths ?? ''} onChange={(e) => setD({ baths: e.target.value ? Number(e.target.value) : undefined })} />
                </label>
                <label className="text-xs text-slate-500">
                  Cat policy
                  <select className={inputCls} value={draft.catPolicy ?? 'unknown'} onChange={(e) => setD({ catPolicy: e.target.value as CatPolicy })}>
                    <option value="yes">Cats OK</option>
                    <option value="no">No cats</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Address
                  <input className={inputCls} value={draft.address ?? ''} onChange={(e) => setD({ address: e.target.value })} />
                </label>
              </div>
              <button
                onClick={save}
                disabled={loading || !draft.title}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} {existingId ? 'Update listing' : 'Save listing'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

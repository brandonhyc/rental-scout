import { useState } from 'react';
import { Save, CheckCircle2, XCircle } from 'lucide-react';
import type { FetchLogEntry, Settings } from '../types';

export default function SettingsView({
  settings,
  fetchLog,
  onSave,
}: {
  settings: Settings;
  fetchLog: FetchLogEntry[];
  onSave: (s: Settings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Settings>(() => structuredClone(settings));
  const [saved, setSaved] = useState(false);
  const inputCls = 'w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';

  const save = async () => {
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setCity = (i: number, patch: Partial<Settings['cities'][number]>) => {
    const cities = draft.cities.map((c, j) => (i === j ? { ...c, ...patch } : c));
    setDraft({ ...draft, cities });
  };
  const setSearch = (i: number, patch: Partial<Settings['searches'][number]>) => {
    const searches = draft.searches.map((s, j) => (i === j ? { ...s, ...patch } : s));
    setDraft({ ...draft, searches });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Budget & criteria</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-500">
            1BR max $/mo
            <input className={inputCls} type="number" value={draft.oneBrMaxPrice} onChange={(e) => setDraft({ ...draft, oneBrMaxPrice: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            2BR max total $/mo
            <input className={inputCls} type="number" value={draft.twoBrMaxTotal} onChange={(e) => setDraft({ ...draft, twoBrMaxTotal: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            2BR max your share
            <input className={inputCls} type="number" value={draft.twoBrMaxShare} onChange={(e) => setDraft({ ...draft, twoBrMaxShare: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            Max commute (min)
            <input className={inputCls} type="number" value={draft.maxCommuteMinutes} onChange={(e) => setDraft({ ...draft, maxCommuteMinutes: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            Sign deadline
            <input className={inputCls} type="date" value={draft.signDeadline} onChange={(e) => setDraft({ ...draft, signDeadline: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">
            Move-in date
            <input className={inputCls} type="date" value={draft.moveInDate} onChange={(e) => setDraft({ ...draft, moveInDate: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">
            Daily auto-refresh hour (0–23)
            <input className={inputCls} type="number" min={0} max={23} value={draft.refreshHour} onChange={(e) => setDraft({ ...draft, refreshHour: Number(e.target.value) })} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={draft.requireCatFriendly} onChange={(e) => setDraft({ ...draft, requireCatFriendly: e.target.checked })} />
            Cat-friendly required
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-semibold">Cities</h2>
        <p className="mb-3 text-xs text-slate-500">
          Commute = typical weekday-morning driving minutes to Mountain View (estimates — adjust to your experience). Safety 1–5 is your own
          judgement; the defaults are rough starting points. Verify with resources like city crime maps before deciding.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="p-1">Enabled</th>
                <th className="p-1">City</th>
                <th className="p-1">Commute (min)</th>
                <th className="p-1">Safety (1–5)</th>
                <th className="p-1">Safety note</th>
              </tr>
            </thead>
            <tbody>
              {draft.cities.map((c, i) => (
                <tr key={c.name} className="border-t border-slate-100">
                  <td className="p-1 text-center">
                    <input type="checkbox" checked={c.enabled} onChange={(e) => setCity(i, { enabled: e.target.checked })} />
                  </td>
                  <td className="p-1 font-medium">{c.name}</td>
                  <td className="p-1">
                    <input className="w-16 rounded border border-slate-200 px-1 py-0.5" type="number" value={c.commuteMinutes} onChange={(e) => setCity(i, { commuteMinutes: Number(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <input className="w-14 rounded border border-slate-200 px-1 py-0.5" type="number" min={1} max={5} value={c.safetyRating} onChange={(e) => setCity(i, { safetyRating: Number(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <input className="w-full min-w-48 rounded border border-slate-200 px-1 py-0.5" value={c.safetyNote} onChange={(e) => setCity(i, { safetyNote: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 font-semibold">Automated searches (Craigslist)</h2>
        <p className="mb-3 text-xs text-slate-500">
          These run on every refresh and once a day automatically. Edit the URLs to tweak filters (open one in your browser, adjust filters
          there, and copy the resulting URL back).
        </p>
        <div className="space-y-2">
          {draft.searches.map((s, i) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="checkbox" checked={s.enabled} onChange={(e) => setSearch(i, { enabled: e.target.checked })} />
              <input className="w-72 rounded border border-slate-200 px-2 py-1" value={s.label} onChange={(e) => setSearch(i, { label: e.target.value })} />
              <input className="min-w-64 flex-1 rounded border border-slate-200 px-2 py-1 font-mono text-xs" value={s.url} onChange={(e) => setSearch(i, { url: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <button onClick={save} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        <Save className="h-4 w-4" /> {saved ? 'Saved ✓ (listings re-scored)' : 'Save settings'}
      </button>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Fetch log</h2>
        {fetchLog.length === 0 ? (
          <p className="text-sm text-slate-400">No fetches yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {fetchLog.map((e, i) => (
              <li key={i} className="flex items-start gap-2">
                {e.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />}
                <span className="text-slate-500">{new Date(e.at).toLocaleString()}</span>
                <span className="font-medium">{e.source}</span>
                <span className="text-slate-500">
                  {e.ok ? `${e.found} found, ${e.added} added, ${e.updated} updated.` : ''} {e.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

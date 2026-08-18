import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Home, KanbanSquare, Settings as SettingsIcon, Cat } from 'lucide-react';
import { api, type AppState } from './api';
import type { Listing, Settings } from './types';
import CountdownHeader from './components/CountdownHeader';
import FiltersBar, { defaultFilters, type Filters, applyFilters } from './components/FiltersBar';
import ListingCard from './components/ListingCard';
import ListingDetailModal from './components/ListingDetailModal';
import ImportModal from './components/ImportModal';
import Pipeline from './components/Pipeline';
import SettingsView from './components/SettingsView';

type Tab = 'listings' | 'pipeline' | 'settings';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('listings');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setState(await api.state());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const listings = state?.listings ?? [];
  const settings = state?.settings;
  const selected = listings.find((l) => l.id === selectedId) ?? null;

  const filtered = useMemo(() => applyFilters(listings, filters), [listings, filters]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const summary = await api.refresh();
      const failures = summary.ran.filter((r) => !r.ok);
      setRefreshMsg(
        `Refresh done: ${summary.added} new, ${summary.updated} updated` +
          (failures.length ? ` — ${failures.length} source(s) failed (see Settings → fetch log)` : ''),
      );
      await reload();
    } catch (e) {
      setRefreshMsg(`Refresh failed: ${(e as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const patchListing = async (id: string, patch: Partial<Listing>) => {
    try {
      await api.updateListing(id, patch);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeListing = async (id: string) => {
    await api.deleteListing(id);
    setSelectedId(null);
    await reload();
  };

  const saveSettings = async (s: Settings) => {
    await api.saveSettings(s);
    await reload();
  };

  if (error) {
    return (
      <div className="p-8 text-red-600">
        Failed to load: {error}. Is the server running? <button className="underline" onClick={() => { setError(null); reload(); }}>Retry</button>
      </div>
    );
  }
  if (!state || !settings) {
    return <div className="p-8 text-slate-500">Loading…</div>;
  }

  const newCount = listings.filter((l) => l.status === 'new').length;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="flex items-center gap-2 text-lg font-bold text-indigo-700">
            <Cat className="h-5 w-5" /> Bay Rental Scout
          </h1>
          <CountdownHeader settings={settings} />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Add listing
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4">
          {(
            [
              ['listings', 'Listings', Home],
              ['pipeline', 'Pipeline', KanbanSquare],
              ['settings', 'Settings', SettingsIcon],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                tab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === 'listings' && newCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">{newCount} new</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {refreshMsg && (
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">{refreshMsg}</div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4">
        {tab === 'listings' && (
          <>
            <FiltersBar filters={filters} setFilters={setFilters} settings={settings} count={filtered.length} total={listings.length} />
            {filtered.length === 0 ? (
              <div className="mt-10 text-center text-slate-500">
                <p className="text-lg font-medium">No listings yet</p>
                <p className="mt-1 text-sm">
                  Hit <b>Refresh now</b> to pull Craigslist, or <b>Add listing</b> to import a Zillow / Apartments.com link or pasted text.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((l) => (
                  <ListingCard key={l.id} listing={l} onOpen={() => setSelectedId(l.id)} onPatch={(p) => patchListing(l.id, p)} />
                ))}
              </div>
            )}
          </>
        )}
        {tab === 'pipeline' && <Pipeline listings={listings} onOpen={setSelectedId} onPatch={patchListing} />}
        {tab === 'settings' && <SettingsView settings={settings} fetchLog={state.fetchLog} onSave={saveSettings} />}
      </main>

      {selected && (
        <ListingDetailModal
          listing={selected}
          settings={settings}
          onClose={() => setSelectedId(null)}
          onPatch={(p) => patchListing(selected.id, p)}
          onDelete={() => removeListing(selected.id)}
        />
      )}
      {importOpen && settings && (
        <ImportModal
          settings={settings}
          onClose={() => setImportOpen(false)}
          onSaved={async () => {
            setImportOpen(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

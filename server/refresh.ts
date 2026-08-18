import type { DB, Listing, RefreshSummary } from '../src/types';
import { runCraigslistSearch } from './craigslist';
import { applyScore } from './score';
import { findListingByUrl, newId, normalizeUrl, saveDB } from './store';

let refreshInFlight: Promise<RefreshSummary> | null = null;

export function runRefresh(db: DB): Promise<RefreshSummary> {
  // Collapse concurrent refresh requests into one run.
  if (!refreshInFlight) {
    refreshInFlight = doRefresh(db).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(db: DB): Promise<RefreshSummary> {
  const summary: RefreshSummary = { ran: [], added: 0, updated: 0 };
  const now = new Date().toISOString();
  const seenThisRun = new Set<string>();

  for (const search of db.settings.searches.filter((s) => s.enabled)) {
    try {
      const result = await runCraigslistSearch(search.url, db.settings, (url) => !!findListingByUrl(url));
      let added = 0;
      let updated = 0;

      for (const cand of result.candidates) {
        if (!cand.url) continue;
        seenThisRun.add(normalizeUrl(cand.url));
        const existing = findListingByUrl(cand.url);
        if (existing) {
          existing.lastSeenAt = now;
          existing.possiblyGone = false;
          if (cand.price && cand.price !== existing.price) {
            existing.priceHistory.push({ date: now.slice(0, 10), price: cand.price });
            existing.price = cand.price;
            existing.updatedAt = now;
            applyScore(existing, db.settings);
            updated++;
          }
        } else {
          const listing: Listing = {
            id: newId(),
            source: 'craigslist',
            url: cand.url,
            title: cand.title || 'Craigslist listing',
            address: cand.address,
            city: cand.city,
            price: cand.price ?? 0,
            beds: cand.beds ?? 1,
            baths: cand.baths,
            sqft: cand.sqft,
            catPolicy: cand.catPolicy ?? 'unknown',
            availableDate: cand.availableDate,
            description: cand.description,
            imageUrl: cand.imageUrl,
            status: 'new',
            notes: '',
            tags: [],
            score: 0,
            scoreParts: [],
            priceHistory: cand.price ? [{ date: now.slice(0, 10), price: cand.price }] : [],
            createdAt: now,
            updatedAt: now,
            lastSeenAt: now,
          };
          applyScore(listing, db.settings);
          db.listings.push(listing);
          added++;
        }
      }

      summary.ran.push({ source: search.label, ok: true, found: result.found, added, updated, message: result.message });
      summary.added += added;
      summary.updated += updated;
      db.fetchLog.unshift({ at: now, source: search.label, ok: true, found: result.found, added, updated, message: result.message });
    } catch (e) {
      const message = (e as Error).message;
      summary.ran.push({ source: search.label, ok: false, found: 0, added: 0, updated: 0, message });
      db.fetchLog.unshift({ at: now, source: search.label, ok: false, found: 0, added: 0, updated: 0, message });
    }
  }

  // Craigslist listings that stopped appearing in searches for 3+ days are
  // probably rented out — flag rather than delete, the user decides.
  const staleCutoff = Date.now() - 3 * 24 * 3600 * 1000;
  for (const l of db.listings) {
    if (l.source === 'craigslist' && l.lastSeenAt && !seenThisRun.has(normalizeUrl(l.url))) {
      if (new Date(l.lastSeenAt).getTime() < staleCutoff && !['signed', 'rejected', 'hidden'].includes(l.status)) {
        l.possiblyGone = true;
      }
    }
  }

  db.fetchLog = db.fetchLog.slice(0, 200);
  saveDB();
  return summary;
}

// Lightweight daily scheduler: checks every 15 minutes whether we've passed
// the configured refresh hour without refreshing today.
export function startScheduler(db: DB): void {
  const tick = async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (db.lastAutoRefreshDate === today) return;
    if (new Date().getHours() < db.settings.refreshHour) return;
    db.lastAutoRefreshDate = today;
    saveDB();
    try {
      const summary = await runRefresh(db);
      console.log(`[auto-refresh] added ${summary.added}, updated ${summary.updated}`);
    } catch (e) {
      console.error('[auto-refresh] failed:', (e as Error).message);
    }
  };
  setInterval(tick, 15 * 60 * 1000);
  setTimeout(tick, 10 * 1000);
}

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDB, saveDB, findListingByUrl, newId } from './server/store';
import { applyScore } from './server/score';
import { importFromUrl, importFromText } from './server/importers';
import { runRefresh, startScheduler } from './server/refresh';
import type { Listing } from './src/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '5mb' }));

const db = loadDB();

// ---------- API ----------

app.get('/api/state', (_req, res) => {
  res.json({ listings: db.listings, settings: db.settings, fetchLog: db.fetchLog.slice(0, 30) });
});

app.post('/api/refresh', async (_req, res) => {
  try {
    const summary = await runRefresh(db);
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/import/url', async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'url required' });
  const existing = findListingByUrl(url);
  if (existing) return res.json({ listing: existing, warnings: ['Already saved — editing the existing entry.'], existingId: existing.id });
  try {
    const preview = await importFromUrl(url, db.settings);
    res.json(preview);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/import/text', (req, res) => {
  const { text, url } = req.body as { text?: string; url?: string };
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  if (url) {
    const existing = findListingByUrl(url);
    if (existing) return res.json({ listing: existing, warnings: ['Already saved — editing the existing entry.'], existingId: existing.id });
  }
  res.json(importFromText(text, url, db.settings));
});

app.post('/api/listings', (req, res) => {
  const body = req.body as Partial<Listing>;
  const now = new Date().toISOString();
  const listing: Listing = {
    id: newId(),
    source: body.source ?? 'other',
    url: body.url ?? '',
    title: body.title || 'Untitled listing',
    address: body.address,
    city: body.city,
    neighborhood: body.neighborhood,
    price: Number(body.price) || 0,
    beds: Number(body.beds ?? 1),
    baths: body.baths !== undefined && body.baths !== null ? Number(body.baths) : undefined,
    sqft: body.sqft ? Number(body.sqft) : undefined,
    catPolicy: body.catPolicy ?? 'unknown',
    availableDate: body.availableDate,
    description: body.description,
    imageUrl: body.imageUrl,
    status: body.status ?? 'interested',
    notes: body.notes ?? '',
    tags: body.tags ?? [],
    score: 0,
    scoreParts: [],
    priceHistory: body.price ? [{ date: now.slice(0, 10), price: Number(body.price) }] : [],
    createdAt: now,
    updatedAt: now,
  };
  if (listing.url && findListingByUrl(listing.url)) {
    return res.status(409).json({ error: 'A listing with this URL is already saved.' });
  }
  applyScore(listing, db.settings);
  db.listings.push(listing);
  saveDB();
  res.json(listing);
});

app.patch('/api/listings/:id', (req, res) => {
  const listing = db.listings.find((l) => l.id === req.params.id);
  if (!listing) return res.status(404).json({ error: 'not found' });
  const body = req.body as Partial<Listing>;
  const now = new Date().toISOString();

  if (body.price !== undefined && Number(body.price) !== listing.price) {
    listing.priceHistory.push({ date: now.slice(0, 10), price: Number(body.price) });
  }
  const editable: (keyof Listing)[] = [
    'title', 'url', 'address', 'city', 'neighborhood', 'price', 'beds', 'baths', 'sqft',
    'catPolicy', 'availableDate', 'description', 'imageUrl', 'status', 'notes', 'tags', 'source', 'possiblyGone',
  ];
  for (const key of editable) {
    if (body[key] !== undefined) (listing as unknown as Record<string, unknown>)[key] = body[key];
  }
  listing.updatedAt = now;
  applyScore(listing, db.settings);
  saveDB();
  res.json(listing);
});

app.delete('/api/listings/:id', (req, res) => {
  const idx = db.listings.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.listings.splice(idx, 1);
  saveDB();
  res.json({ ok: true });
});

app.put('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...(req.body as object) };
  for (const l of db.listings) applyScore(l, db.settings);
  saveDB();
  res.json(db.settings);
});

// ---------- Frontend ----------

async function start() {
  if (isProd) {
    const clientDir = path.join(__dirname, 'client');
    app.use(express.static(clientDir));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Bay Rental Scout running at http://localhost:${PORT}`);
  });
  startScheduler(db);
}

start();

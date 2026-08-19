import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DB, Settings, CityInfo, Listing } from '../src/types';

// ESM in dev (tsx), CJS in the esbuild production bundle — resolve either way.
// Both land on <repo>/data: server/../data in dev, dist/../data when bundled.
const moduleDir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(moduleDir, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Commute minutes are typical weekday-morning driving estimates to downtown
// Mountain View. Safety ratings are rough starting points (1 worst - 5 best):
// verify with local crime maps and edit in Settings.
const DEFAULT_CITIES: CityInfo[] = [
  { name: 'Mountain View', direction: 'south', commuteMinutes: 8, safetyRating: 4, safetyNote: 'Generally safe; check specific complex reviews.', enabled: true },
  { name: 'Los Altos', direction: 'south', commuteMinutes: 12, safetyRating: 5, safetyNote: 'Very safe, quiet, limited rental stock.', enabled: true },
  { name: 'Sunnyvale', direction: 'south', commuteMinutes: 15, safetyRating: 4, safetyNote: 'Generally safe across most neighborhoods.', enabled: true },
  { name: 'Palo Alto', direction: 'north', commuteMinutes: 18, safetyRating: 4, safetyNote: 'Safe; pricier stock near downtown.', enabled: true },
  { name: 'Santa Clara', direction: 'south', commuteMinutes: 20, safetyRating: 4, safetyNote: 'Generally safe; varies near event venues.', enabled: true },
  { name: 'Cupertino', direction: 'south', commuteMinutes: 22, safetyRating: 5, safetyNote: 'Very safe.', enabled: true },
  { name: 'Menlo Park', direction: 'north', commuteMinutes: 22, safetyRating: 4, safetyNote: 'Safe; check area east of 101 separately.', enabled: true },
  { name: 'Milpitas', direction: 'east', commuteMinutes: 28, safetyRating: 4, safetyNote: 'Generally safe; newer complexes near the Great Mall.', enabled: true },
  { name: 'Redwood City', direction: 'north', commuteMinutes: 28, safetyRating: 3, safetyNote: 'Varies by neighborhood; research the specific block.', enabled: true },
  { name: 'North San Jose', direction: 'south', commuteMinutes: 25, safetyRating: 3, safetyNote: 'Varies by neighborhood; research the specific block.', enabled: true },
  { name: 'San Carlos', direction: 'north', commuteMinutes: 32, safetyRating: 4, safetyNote: 'Safe, quieter suburb.', enabled: true },
  { name: 'Belmont', direction: 'north', commuteMinutes: 35, safetyRating: 4, safetyNote: 'Safe, hilly, quiet.', enabled: true },
  { name: 'Foster City', direction: 'north', commuteMinutes: 35, safetyRating: 5, safetyNote: 'Very safe, popular with commuters.', enabled: true },
  { name: 'Fremont', direction: 'east', commuteMinutes: 35, safetyRating: 4, safetyNote: 'Generally safe; Ardenwood/Warm Springs popular. 84/Dumbarton traffic varies.', enabled: true },
  { name: 'San Mateo', direction: 'north', commuteMinutes: 40, safetyRating: 3, safetyNote: 'Varies by neighborhood; research the specific block.', enabled: true },
];

const DEFAULT_SETTINGS: Settings = {
  oneBrMaxPrice: 3000,
  twoBrMaxTotal: 4400,
  twoBrMaxShare: 2200,
  requireCatFriendly: true,
  maxCommuteMinutes: 30,
  maxCommuteNorthMinutes: 45,
  refreshHour: 8,
  cities: DEFAULT_CITIES,
  searches: [
    {
      id: 'cl-1br-pen',
      label: 'Craigslist 1BR ≤$3000 cats OK — Peninsula',
      url: 'https://sfbay.craigslist.org/search/pen/apa?min_bedrooms=1&max_bedrooms=1&max_price=3000&pets_cat=1',
      enabled: true,
    },
    {
      id: 'cl-1br-sby',
      label: 'Craigslist 1BR ≤$3000 cats OK — South Bay',
      url: 'https://sfbay.craigslist.org/search/sby/apa?min_bedrooms=1&max_bedrooms=1&max_price=3000&pets_cat=1',
      enabled: true,
    },
    {
      id: 'cl-1br-eby',
      label: 'Craigslist 1BR ≤$3000 cats OK — East Bay (Fremont/Milpitas)',
      url: 'https://sfbay.craigslist.org/search/eby/apa?min_bedrooms=1&max_bedrooms=1&max_price=3000&pets_cat=1',
      enabled: true,
    },
    {
      id: 'cl-2br-pen',
      label: 'Craigslist 2BR/2BA ≤$4400 cats OK — Peninsula',
      url: 'https://sfbay.craigslist.org/search/pen/apa?min_bedrooms=2&max_bedrooms=2&min_bathrooms=2&max_price=4400&pets_cat=1',
      enabled: true,
    },
    {
      id: 'cl-2br-sby',
      label: 'Craigslist 2BR/2BA ≤$4400 cats OK — South Bay',
      url: 'https://sfbay.craigslist.org/search/sby/apa?min_bedrooms=2&max_bedrooms=2&min_bathrooms=2&max_price=4400&pets_cat=1',
      enabled: true,
    },
    {
      id: 'cl-2br-eby',
      label: 'Craigslist 2BR/2BA ≤$4400 cats OK — East Bay (Fremont/Milpitas)',
      url: 'https://sfbay.craigslist.org/search/eby/apa?min_bedrooms=2&max_bedrooms=2&min_bathrooms=2&max_price=4400&pets_cat=1',
      enabled: true,
    },
  ],
  signDeadline: '2026-09-15',
  moveInDate: '2026-10-01',
};

let db: DB | null = null;

export function loadDB(): DB {
  if (db) return db;
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DB;
    // Merge in any settings keys added after the db file was first created.
    parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    db = parsed;
  } catch {
    db = { listings: [], settings: structuredClone(DEFAULT_SETTINGS), fetchLog: [] };
  }
  return db;
}

export function saveDB(): void {
  if (!db) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export function findListingByUrl(url: string): Listing | undefined {
  const norm = normalizeUrl(url);
  return loadDB().listings.find((l) => normalizeUrl(l.url) === norm);
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

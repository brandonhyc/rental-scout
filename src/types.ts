// Shared types between server and client.

export type ListingStatus =
  | 'new'
  | 'interested'
  | 'contacted'
  | 'toured'
  | 'applied'
  | 'signed'
  | 'rejected'
  | 'hidden';

export type ListingSource = 'craigslist' | 'zillow' | 'apartments' | 'zumper' | 'hotpads' | 'trulia' | 'facebook' | 'other';

export type CatPolicy = 'yes' | 'no' | 'unknown';

export interface PricePoint {
  date: string; // ISO date
  price: number;
}

export interface Listing {
  id: string;
  source: ListingSource;
  url: string;
  title: string;
  address?: string;
  city?: string; // normalized city name if recognized
  neighborhood?: string;
  price: number; // monthly rent in USD
  beds: number; // 0 = studio
  baths?: number;
  sqft?: number;
  catPolicy: CatPolicy;
  availableDate?: string;
  description?: string;
  imageUrl?: string;
  status: ListingStatus;
  notes: string;
  tags: string[];
  score: number; // 0-100 match score
  scoreParts: ScorePart[];
  commuteMinutes?: number; // estimated rush-hour driving to Mountain View
  yourShare?: number; // for 2br: price / 2
  priceHistory: PricePoint[];
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string; // last time an automated fetch saw this listing
  possiblyGone?: boolean; // not seen in recent automated fetches
}

export interface ScorePart {
  label: string;
  points: number; // signed contribution
  detail: string;
}

export interface CityInfo {
  name: string;
  commuteMinutes: number; // typical rush-hour driving to Mountain View
  safetyRating: number; // 1 (worst) - 5 (best), user-editable
  safetyNote: string;
  enabled: boolean;
  // 'north' = Peninsula corridor north of Mountain View (Menlo Park → San
  // Mateo), which gets the more generous commute limit.
  direction?: 'north' | 'south' | 'east';
}

export interface SearchConfig {
  id: string;
  label: string;
  url: string; // full Craigslist search URL
  enabled: boolean;
}

export interface Settings {
  oneBrMaxPrice: number; // e.g. 3000
  twoBrMaxTotal: number; // e.g. 4400 (your share cap x 2)
  twoBrMaxShare: number; // e.g. 2200
  requireCatFriendly: boolean;
  maxCommuteMinutes: number; // e.g. 30
  maxCommuteNorthMinutes: number; // e.g. 45 — limit for 'north' (Peninsula) cities
  refreshHour: number; // local hour (0-23) for the daily auto-refresh
  cities: CityInfo[];
  searches: SearchConfig[];
  signDeadline: string; // ISO date
  moveInDate: string; // ISO date
}

export interface FetchLogEntry {
  at: string;
  source: string;
  ok: boolean;
  found: number;
  added: number;
  updated: number;
  message: string;
}

export interface DB {
  listings: Listing[];
  settings: Settings;
  fetchLog: FetchLogEntry[];
  lastAutoRefreshDate?: string; // YYYY-MM-DD of last automatic refresh
}

export interface ImportPreview {
  listing: Partial<Listing>;
  warnings: string[];
}

export interface RefreshSummary {
  ran: { source: string; ok: boolean; found: number; added: number; updated: number; message: string }[];
  added: number;
  updated: number;
}

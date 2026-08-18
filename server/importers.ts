import * as cheerio from 'cheerio';
import type { ImportPreview, Listing, ListingSource, Settings, CatPolicy } from '../src/types';
import { fetchHtml, parseDetailPage, parsePrice } from './craigslist';
import { detectCity } from './score';

export function sourceFromUrl(url: string): ListingSource {
  const h = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (h.includes('craigslist')) return 'craigslist';
  if (h.includes('zillow')) return 'zillow';
  if (h.includes('apartments.com')) return 'apartments';
  if (h.includes('zumper')) return 'zumper';
  if (h.includes('hotpads')) return 'hotpads';
  if (h.includes('trulia')) return 'trulia';
  if (h.includes('facebook')) return 'facebook';
  return 'other';
}

// Import a listing by fetching its URL. Craigslist gets the dedicated parser;
// other sites go through JSON-LD / OpenGraph / heuristics. Sites with bot
// protection (Zillow especially) may refuse — the caller falls back to
// paste-the-page-text import.
export async function importFromUrl(url: string, settings: Settings): Promise<ImportPreview> {
  const warnings: string[] = [];
  const source = sourceFromUrl(url);
  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    return {
      listing: { url, source },
      warnings: [
        `Could not fetch the page (${(e as Error).message}). This site may block automated requests — use "Paste listing text" instead: open the listing, select-all, copy, and paste.`,
      ],
    };
  }

  let listing: Partial<Listing>;
  if (source === 'craigslist') {
    const d = parseDetailPage(html);
    listing = { url, source, title: d.title, price: d.price, beds: d.beds, baths: d.baths, sqft: d.sqft, address: d.address, catPolicy: d.catPolicy, availableDate: d.availableDate, description: d.description, imageUrl: d.imageUrl };
  } else {
    listing = parseGenericListingPage(html, url);
    listing.source = source;
  }

  listing.city = detectCity(settings, listing.address, listing.title, listing.description, url);
  if (!listing.price) warnings.push('Could not detect the price — fill it in below.');
  if (listing.beds === undefined) warnings.push('Could not detect bedrooms — fill it in below.');
  if (!listing.city) warnings.push('Could not match a city from your list — pick one below for commute/safety scoring.');
  if (listing.catPolicy === 'unknown') warnings.push('Cat policy not detected — verify with the listing.');
  return { listing, warnings };
}

function parseGenericListingPage(html: string, url: string): Partial<Listing> {
  const $ = cheerio.load(html);
  const listing: Partial<Listing> = { url, catPolicy: 'unknown' };

  // JSON-LD is the most reliable structured data when present.
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      for (const node of Array.isArray(data) ? data : [data]) {
        const t = String(node['@type'] ?? '');
        if (/Apartment|House|Residence|Offer|Product|Place|RealEstateListing/i.test(t)) {
          listing.title = listing.title || node.name;
          const offer = node.offers ?? node;
          const price = Number(offer?.price ?? offer?.lowPrice);
          if (!listing.price && price > 100) listing.price = Math.round(price);
          const addr = node.address;
          if (addr && !listing.address) {
            listing.address = [addr.streetAddress, addr.addressLocality, addr.addressRegion].filter(Boolean).join(', ');
          }
          if (node.numberOfRooms && listing.beds === undefined) listing.beds = Number(node.numberOfRooms);
          if (node.floorSize?.value && !listing.sqft) listing.sqft = Number(node.floorSize.value);
          if (node.image && !listing.imageUrl) listing.imageUrl = Array.isArray(node.image) ? node.image[0] : node.image;
        }
      }
    } catch {
      // Malformed JSON-LD blocks are common; skip them.
    }
  });

  listing.title = listing.title || $('meta[property="og:title"]').attr('content') || $('title').text().trim() || undefined;
  listing.imageUrl = listing.imageUrl || $('meta[property="og:image"]').attr('content') || undefined;
  const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';

  const textBits = [listing.title, description, $('body').text().slice(0, 40000)].join('\n');
  applyTextHeuristics(listing, textBits);
  if (description && !listing.description) listing.description = description.slice(0, 2000);
  return listing;
}

// Parse a listing from raw text the user pasted (works when scraping is blocked).
export function importFromText(text: string, url: string | undefined, settings: Settings): ImportPreview {
  const warnings: string[] = [];
  const listing: Partial<Listing> = { url: url || '', source: url ? sourceFromUrl(url) : 'other', catPolicy: 'unknown' };

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  listing.title = lines.find((l) => l.length > 10 && l.length < 120) || lines[0]?.slice(0, 120);
  applyTextHeuristics(listing, text);
  listing.description = text.trim().slice(0, 2000);
  listing.city = detectCity(settings, text, url);

  if (!listing.price) warnings.push('Could not detect the price in the pasted text — fill it in below.');
  if (listing.beds === undefined) warnings.push('Could not detect bedrooms — fill it in below.');
  if (!listing.city) warnings.push('Could not match a city from your list — pick one below.');
  return { listing, warnings };
}

function applyTextHeuristics(listing: Partial<Listing>, text: string): void {
  const t = text.toLowerCase().replace(/,/g, '');

  if (!listing.price) {
    // Prefer "$X/mo"-style prices; fall back to the first plausible rent amount.
    const perMo = t.match(/\$\s*(\d{3,5})\s*(?:\/|per\s*)(?:mo|month)/);
    listing.price = perMo ? parseInt(perMo[1], 10) : undefined;
    if (!listing.price) {
      for (const m of t.matchAll(/\$\s*(\d{3,5})(?!\d)/g)) {
        const v = parseInt(m[1], 10);
        if (v >= 800 && v <= 15000) {
          listing.price = v;
          break;
        }
      }
    }
  }

  if (listing.beds === undefined) {
    if (/\bstudio\b/.test(t)) listing.beds = 0;
    else {
      const m = t.match(/(\d)\s*(?:br\b|bed(?:room)?s?\b|bd\b|b(?=\d*b))/);
      if (m) listing.beds = parseInt(m[1], 10);
    }
  }
  if (listing.baths === undefined) {
    const m = t.match(/(\d(?:\.\d)?)\s*(?:ba\b|bath(?:room)?s?\b)/);
    if (m) listing.baths = parseFloat(m[1]);
  }
  if (!listing.sqft) {
    const m = t.match(/(\d{3,5})\s*(?:sq\s*\.?\s*ft|sqft|square\s+feet)/);
    if (m) listing.sqft = parseInt(m[1], 10);
  }
  if (listing.catPolicy === 'unknown') {
    if (/no\s+pets|no\s+cats|pets?\s*:\s*no/.test(t)) listing.catPolicy = 'no';
    else if (/cats?\s+(are\s+)?(ok|okay|welcome|allowed|friendly)|cat[\s-]*friendly|pet[\s-]*friendly|pets?\s+(ok|okay|welcome|allowed)/.test(t)) listing.catPolicy = 'yes';
  }
  const avail = t.match(/available\s+(?:on\s+|starting\s+)?([a-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (avail && !listing.availableDate) listing.availableDate = avail[1];
}

export { detectCity };
export type { CatPolicy };

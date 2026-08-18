import type { Listing, ScorePart, Settings } from '../src/types';

// Try to recognize one of the configured cities in free text (title/address/etc).
export function detectCity(settings: Settings, ...texts: (string | undefined)[]): string | undefined {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return undefined;
  const aliases: Record<string, string[]> = {
    'Mountain View': ['mountain view', 'mtn view', 'mt view', 'mtview'],
    'North San Jose': ['north san jose', 'san jose north', 'berryessa', 'alviso'],
  };
  for (const city of settings.cities) {
    const names = aliases[city.name] ?? [city.name.toLowerCase()];
    if (names.some((n) => hay.includes(n))) return city.name;
  }
  // "San Jose" without a recognized-north qualifier stays unrecognized on
  // purpose — most of San Jose is outside the commute window.
  return undefined;
}

export function scoreListing(listing: Partial<Listing>, settings: Settings): { score: number; parts: ScorePart[]; commuteMinutes?: number; yourShare?: number } {
  const parts: ScorePart[] = [];
  let score = 50;

  const beds = listing.beds ?? 1;
  const price = listing.price ?? 0;
  const is2br = beds >= 2;
  const yourShare = is2br ? Math.round(price / 2) : undefined;

  // Budget: 1BR against oneBrMaxPrice; 2BR against twoBrMaxTotal (your share = half).
  const cap = is2br ? settings.twoBrMaxTotal : settings.oneBrMaxPrice;
  if (price > 0 && cap > 0) {
    if (price <= cap) {
      const margin = (cap - price) / cap; // 0..1
      const pts = Math.round(10 + margin * 20);
      parts.push({ label: 'Budget', points: pts, detail: is2br ? `$${price} total ≤ $${cap} cap (your share ~$${yourShare})` : `$${price} ≤ $${cap} cap` });
      score += pts;
    } else {
      const over = Math.min(1, (price - cap) / cap);
      const pts = -Math.round(20 + over * 30);
      parts.push({ label: 'Budget', points: pts, detail: `$${price} is over the $${cap} cap` });
      score += pts;
    }
  }

  // Commute via recognized city.
  const city = listing.city ? settings.cities.find((c) => c.name === listing.city) : undefined;
  let commuteMinutes: number | undefined;
  if (city) {
    commuteMinutes = city.commuteMinutes;
    if (city.commuteMinutes <= settings.maxCommuteMinutes) {
      const pts = 15;
      parts.push({ label: 'Commute', points: pts, detail: `~${city.commuteMinutes} min rush-hour drive to Mountain View` });
      score += pts;
    } else {
      const pts = -Math.min(25, (city.commuteMinutes - settings.maxCommuteMinutes) * 2);
      parts.push({ label: 'Commute', points: pts, detail: `~${city.commuteMinutes} min — over your ${settings.maxCommuteMinutes} min limit` });
      score += pts;
    }
    // Safety from the city's rating (1-5).
    const safetyPts = (city.safetyRating - 3) * 5;
    parts.push({ label: 'Safety', points: safetyPts, detail: `${city.name} rated ${city.safetyRating}/5 — ${city.safetyNote}` });
    score += safetyPts;
    if (!city.enabled) {
      parts.push({ label: 'Area', points: -30, detail: `${city.name} is disabled in your settings` });
      score -= 30;
    }
  } else {
    parts.push({ label: 'Commute', points: -5, detail: 'City not recognized — set it manually to score commute & safety' });
    score -= 5;
  }

  // Cat policy.
  if (listing.catPolicy === 'yes') {
    parts.push({ label: 'Cat', points: 10, detail: 'Cats explicitly allowed' });
    score += 10;
  } else if (listing.catPolicy === 'no') {
    const pts = settings.requireCatFriendly ? -60 : -20;
    parts.push({ label: 'Cat', points: pts, detail: 'Cats not allowed' });
    score += pts;
  } else {
    parts.push({ label: 'Cat', points: -5, detail: 'Cat policy unknown — ask the landlord' });
    score -= 5;
  }

  // Bed/bath fit: user wants 1b1b, or 2b2b (with roommate).
  if (is2br && listing.baths !== undefined && listing.baths < 2) {
    parts.push({ label: 'Layout', points: -15, detail: `2BR but only ${listing.baths} bath — you wanted 2b2b for roommate setup` });
    score -= 15;
  }
  if (beds === 0) {
    parts.push({ label: 'Layout', points: -10, detail: 'Studio — you wanted at least 1b1b' });
    score -= 10;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), parts, commuteMinutes, yourShare };
}

// Re-score a listing in place (after edits or settings changes).
export function applyScore(listing: Listing, settings: Settings): void {
  const { score, parts, commuteMinutes, yourShare } = scoreListing(listing, settings);
  listing.score = score;
  listing.scoreParts = parts;
  listing.commuteMinutes = commuteMinutes;
  listing.yourShare = yourShare;
}

import * as cheerio from 'cheerio';
import type { Listing, Settings, CatPolicy } from '../src/types';
import { detectCity } from './score';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export async function fetchHtml(url: string, timeoutMs = 20000): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

export interface CLSearchResult {
  url: string;
  title: string;
  price?: number;
  location?: string;
}

// Craigslist search pages ship a static no-JS fallback list
// (li.cl-static-search-result) alongside the JS gallery. Parse that first,
// then fall back to older markup and to bare link extraction.
export function parseSearchPage(html: string): CLSearchResult[] {
  const $ = cheerio.load(html);
  const results: CLSearchResult[] = [];
  const seen = new Set<string>();

  const push = (url: string | undefined, title: string, priceText: string, location: string) => {
    if (!url) return;
    const clean = url.split('#')[0];
    if (!/craigslist\.org\/.*\/\d+\.html/.test(clean)) return;
    if (seen.has(clean)) return;
    seen.add(clean);
    const price = parsePrice(priceText);
    results.push({ url: clean, title: title.trim() || 'Craigslist listing', price, location: location.trim() || undefined });
  };

  $('li.cl-static-search-result').each((_, el) => {
    const $el = $(el);
    push(
      $el.find('a').attr('href'),
      $el.attr('title') || $el.find('.title').text(),
      $el.find('.price').text(),
      $el.find('.location').text(),
    );
  });

  if (results.length === 0) {
    // Older/gallery markup.
    $('li.result-row, div.cl-search-result, li.cl-search-result').each((_, el) => {
      const $el = $(el);
      push(
        $el.find('a.result-title, a.cl-app-anchor, a.posting-title, a').first().attr('href'),
        $el.find('.result-title, .label, .posting-title, .titlestring').first().text(),
        $el.find('.result-price, .price, .priceinfo').first().text(),
        $el.find('.result-hood, .meta, .location, .supertitle').first().text(),
      );
    });
  }

  if (results.length === 0) {
    // Last resort: any posting links present in the HTML.
    const re = /https?:\/\/[a-z]+\.craigslist\.org\/[a-z]{3}\/apa\/d\/[a-z0-9-]+\/\d+\.html/g;
    for (const m of html.match(re) ?? []) push(m, 'Craigslist listing', '', '');
  }

  return results;
}

export interface CLDetail {
  title?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  address?: string;
  catPolicy: CatPolicy;
  availableDate?: string;
  description?: string;
  imageUrl?: string;
}

// Individual Craigslist posting pages are classic server-rendered HTML.
export function parseDetailPage(html: string): CLDetail {
  const $ = cheerio.load(html);
  const detail: CLDetail = { catPolicy: 'unknown' };

  detail.title = $('#titletextonly').text().trim() || $('span.postingtitletext').text().trim() || $('title').text().trim() || undefined;
  detail.price = parsePrice($('.price').first().text());

  const attrs: string[] = [];
  $('.attrgroup span, .attrgroup .attr, .mapAndAttrs span').each((_, el) => {
    attrs.push($(el).text().trim().toLowerCase());
  });
  const attrBlob = attrs.join(' | ');

  const bedBath = attrBlob.match(/(\d+)\s*br\s*\/?\s*(\d+(?:\.\d+)?)\s*ba/);
  if (bedBath) {
    detail.beds = parseInt(bedBath[1], 10);
    detail.baths = parseFloat(bedBath[2]);
  } else {
    const beds = attrBlob.match(/(\d+)\s*br/);
    if (beds) detail.beds = parseInt(beds[1], 10);
    const baths = attrBlob.match(/(\d+(?:\.\d+)?)\s*ba/);
    if (baths) detail.baths = parseFloat(baths[1]);
  }
  const sqft = attrBlob.match(/(\d{3,5})\s*ft/);
  if (sqft) detail.sqft = parseInt(sqft[1], 10);

  const body = $('#postingbody').text().toLowerCase();
  if (attrBlob.includes('cats are ok') || attrBlob.includes('cats ok')) detail.catPolicy = 'yes';
  else if (/no\s+(pets|cats)/.test(body) || /no\s+(pets|cats)/.test(attrBlob)) detail.catPolicy = 'no';
  else if (/cats?\s+(ok|okay|welcome|allowed|friendly)/.test(body) || /pet[\s-]*friendly/.test(body)) detail.catPolicy = 'yes';

  const avail = attrBlob.match(/available\s+([a-z]{3}\s+\d{1,2})/);
  if (avail) detail.availableDate = avail[1];
  const availData = $('.housing_movein_now').attr('data-date');
  if (availData) detail.availableDate = availData;

  detail.address = $('.mapaddress').first().text().trim() || undefined;
  detail.description = $('#postingbody').text().replace(/\s*QR Code Link to This Post\s*/g, '').trim().slice(0, 2000) || undefined;
  detail.imageUrl = $('meta[property="og:image"]').attr('content') || $('.slide.first img, .gallery img').first().attr('src') || undefined;

  return detail;
}

export function parsePrice(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = text.replace(/,/g, '').match(/\$\s*(\d{3,6})/);
  return m ? parseInt(m[1], 10) : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SourceRunResult {
  found: number;
  candidates: Partial<Listing>[];
  message: string;
}

// Run one configured Craigslist search: fetch the search page, then fetch
// detail pages for listings we haven't stored yet (politely rate-limited).
export async function runCraigslistSearch(
  url: string,
  settings: Settings,
  isKnown: (url: string) => boolean,
  maxDetailFetches = 25,
): Promise<SourceRunResult> {
  const html = await fetchHtml(url);
  const results = parseSearchPage(html);
  const candidates: Partial<Listing>[] = [];
  let detailFetches = 0;

  for (const r of results) {
    const base: Partial<Listing> = {
      source: 'craigslist',
      url: r.url,
      title: r.title,
      price: r.price,
      city: detectCity(settings, r.location, r.title, r.url),
      catPolicy: 'unknown',
    };
    if (!isKnown(r.url) && detailFetches < maxDetailFetches) {
      detailFetches++;
      try {
        await sleep(600 + Math.floor(Math.random() * 600));
        const detail = parseDetailPage(await fetchHtml(r.url));
        Object.assign(base, {
          title: detail.title || base.title,
          price: detail.price ?? base.price,
          beds: detail.beds,
          baths: detail.baths,
          sqft: detail.sqft,
          address: detail.address,
          catPolicy: detail.catPolicy,
          availableDate: detail.availableDate,
          description: detail.description,
          imageUrl: detail.imageUrl,
        });
        base.city = detectCity(settings, detail.address, r.location, base.title, base.description) ?? base.city;
      } catch {
        // Keep the search-page data if the detail fetch fails.
      }
    }
    candidates.push(base);
  }

  return {
    found: results.length,
    candidates,
    message: results.length === 0 ? 'Search page returned no parseable results (Craigslist may have changed markup or blocked the request)' : `${results.length} results, ${detailFetches} detail pages fetched`,
  };
}

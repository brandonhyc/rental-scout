import { Cat, Car, ExternalLink, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Listing, ListingStatus } from '../types';

export const STATUS_META: Record<ListingStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-indigo-100 text-indigo-700' },
  interested: { label: 'Interested', cls: 'bg-sky-100 text-sky-700' },
  contacted: { label: 'Contacted', cls: 'bg-cyan-100 text-cyan-700' },
  toured: { label: 'Toured', cls: 'bg-violet-100 text-violet-700' },
  applied: { label: 'Applied', cls: 'bg-amber-100 text-amber-700' },
  signed: { label: 'Signed 🎉', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-slate-200 text-slate-500' },
  hidden: { label: 'Hidden', cls: 'bg-slate-200 text-slate-500' },
};

export function scoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 55) return 'bg-amber-500';
  return 'bg-red-400';
}

function priceTrend(l: Listing): 'down' | 'up' | null {
  if (l.priceHistory.length < 2) return null;
  const prev = l.priceHistory[l.priceHistory.length - 2].price;
  return l.price < prev ? 'down' : l.price > prev ? 'up' : null;
}

export default function ListingCard({
  listing,
  onOpen,
  onPatch,
}: {
  listing: Listing;
  onOpen: () => void;
  onPatch: (patch: Partial<Listing>) => void;
}) {
  const meta = STATUS_META[listing.status];
  const trend = priceTrend(listing);
  const share = listing.beds >= 2 && listing.yourShare;

  return (
    <div className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button onClick={onOpen} className="relative h-36 w-full overflow-hidden rounded-t-xl bg-slate-100 text-left">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-slate-300">🏠</div>
        )}
        <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
        <span
          className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold text-white ${scoreColor(listing.score)}`}
          title="Match score"
        >
          {listing.score}
        </span>
        {listing.possiblyGone && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-white">
            <AlertTriangle className="h-3 w-3" /> likely gone
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold">
            {listing.price ? `$${listing.price.toLocaleString()}` : '$?'}
            <span className="text-xs font-normal text-slate-400">/mo</span>
          </span>
          {trend === 'down' && <TrendingDown className="h-4 w-4 text-emerald-600" aria-label="price dropped" />}
          {trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500" aria-label="price increased" />}
          {share ? <span className="text-xs text-slate-500">~${share.toLocaleString()}/person w/ roommate</span> : null}
        </div>
        <button onClick={onOpen} className="line-clamp-2 text-left text-sm font-medium text-slate-800 hover:text-indigo-700">
          {listing.title}
        </button>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>
            {listing.beds === 0 ? 'Studio' : `${listing.beds}bd`}
            {listing.baths ? `/${listing.baths}ba` : ''}
            {listing.sqft ? ` · ${listing.sqft}ft²` : ''}
          </span>
          {listing.city && (
            <span className="flex items-center gap-1">
              <Car className="h-3 w-3" />
              {listing.city}
              {listing.commuteMinutes !== undefined && ` ~${listing.commuteMinutes}min`}
            </span>
          )}
          <span
            className={`flex items-center gap-0.5 ${
              listing.catPolicy === 'yes' ? 'text-emerald-600' : listing.catPolicy === 'no' ? 'text-red-500' : 'text-slate-400'
            }`}
          >
            <Cat className="h-3 w-3" />
            {listing.catPolicy === 'yes' ? 'cats OK' : listing.catPolicy === 'no' ? 'no cats' : 'cats ?'}
          </span>
        </div>
        <div className="mt-auto flex items-center gap-2 pt-2">
          <select
            value={listing.status}
            onChange={(e) => onPatch({ status: e.target.value as ListingStatus })}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            {Object.entries(STATUS_META).map(([value, m]) => (
              <option key={value} value={value}>{m.label}</option>
            ))}
          </select>
          {listing.url && (
            <a
              href={listing.url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              {listing.source} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

# Bay Rental Scout 🐱🏠

A personal app for your Bay Area rental search: it pulls new Craigslist listings daily, lets you import listings from any site (Zillow, Apartments.com, …), scores every place against **your** criteria, and tracks each candidate through a pipeline from *found* to *signed* — with your Sep 15 sign deadline counting down at the top.

## Your criteria (pre-configured, editable in Settings)

- **1b1b ≤ $3,000/mo**, or **2b2b ≤ $4,400/mo total** (≤ $2,200 your share with a roommate you'd find)
- **Cat-friendly required** — listings that ban cats are heavily penalized
- **≤ 30 min rush-hour drive to Mountain View** (≤ 45 min from the Peninsula corridor north of it — Menlo Park through San Mateo) — city-level estimates, editable
- Areas: Mountain View → San Mateo (Peninsula corridor), plus Sunnyvale, Santa Clara, Cupertino, Milpitas, Fremont, North San Jose
- **Safety**: per-city 1–5 rating and notes, fully editable — treat the defaults as rough starting points and verify with local crime maps
- Deadlines: **sign by 2026-09-15**, **move in 2026-10-01**

## Run it

```bash
npm install
npm run dev        # → http://localhost:3000
```

The server must be running for daily auto-refresh to fire (it checks every 15 minutes and runs once per day after the configured hour, default 8am). You can also click **Refresh now** any time. Data lives in `data/db.json` — one JSON file, easy to back up.

For a production build: `npm run build && npm start`.

## See it on your phone

The UI is responsive; the server prints every reachable URL on startup.

- **Same Wi-Fi:** run `npm run dev` and open the printed `On your phone` URL (e.g. `http://192.168.1.23:3000`) in your phone's browser. Use "Add to Home Screen" to pin it.
- **From anywhere — [Tailscale](https://tailscale.com/download) (free):**
  1. Install Tailscale on the computer and sign in (Google/GitHub/Apple account works).
  2. Install the Tailscale app on the phone and sign in with the same account; enable the VPN toggle.
  3. With the server running, open `http://100.x.y.z:3000` on the phone — the `100.x.y.z` address appears in the Tailscale menu on the computer, and in the server's startup log once Tailscale is installed. Works on cellular too; only your own signed-in devices can reach it.
  4. Keep the computer awake so the server and the daily refresh keep running — Windows: Settings → System → Power & battery → Screen and sleep → "When plugged in, put my device to sleep after" → **Never**; macOS: System Settings → Battery → prevent sleep when display is off.
  5. Windows Firewall may ask to allow Node.js the first time the server starts — click **Allow**. If the phone still can't connect, allow Node.js for both private and public networks in "Allow an app through Windows Firewall".

Avoid deploying to a public cloud host for now: Craigslist blocks most datacenter IPs (the daily fetch would break), and the app has no login.

## How data gets in

1. **Automated (Craigslist)** — six pre-configured searches (1BR ≤$3000 and 2BR/2BA ≤$4400, cats-OK, across Peninsula / South Bay / East Bay) run daily and on demand. New listings arrive with status **New**; price changes are recorded in each listing's price history; listings that vanish from search results for 3+ days get flagged *likely gone*.
2. **Import from URL** — paste any listing URL. Craigslist parses fully; other sites are parsed via their structured data when they allow server fetches.
3. **Paste text** — for sites that block bots (Zillow especially): open the listing, select-all, copy, paste. A heuristic parser extracts price/beds/baths/sqft/cat policy, and you confirm before saving.

Everything imported is deduplicated by URL.

## Match score

Each listing gets a 0–100 score with a visible breakdown: budget fit (with margin), commute estimate, city safety rating, cat policy, and layout fit (2BR with <2 baths is penalized, studios penalized). Fix a listing's city in its detail view if auto-detection missed it — scoring updates instantly. Changing settings re-scores everything.

## Pipeline

Track each serious candidate: **New → Interested → Contacted → Toured → Applied → Signed**, with per-listing notes (landlord contact, viewing impressions) and tags. Reject/hide what you don't like — they stay out of the active view but keep their record so re-posts don't fool you.

## Notes & honest limitations

- Craigslist markup changes occasionally; the parser has several fallbacks, and failures show up in Settings → Fetch log rather than silently.
- Zillow/Apartments.com actively block server-side fetching — that's why the paste-text importer exists. It's the reliable path for those sites.
- Commute times are static per-city estimates, not live traffic. Adjust them in Settings to match your reality (e.g. after test-driving a commute).
- Safety ratings are your own editable judgement, not authoritative data. Useful starting points: each city's police-department crime map, [CityProtect](https://cityprotect.com), and neighborhood-level walkthroughs at different times of day.

# Design

## Architecture

This project is a small TypeScript monorepo with a Next.js frontend, a separate Express API, a shared contract package, and Postgres for durable local storage. The scraper is packaged separately so it can be called from a CLI or from `POST /scrape` without duplicating parsing or persistence logic.

The data flow is intentionally linear:

1. Scrape the Promenade Shops sales page and promotion detail pages.
2. Enrich each promotion with brand data from the same site's store directory pages.
3. If a brand website is available, visit that homepage once to collect brand-owned social profile links.
4. Validate normalized records with shared Zod schemas.
5. Upsert brands and promotions into Postgres.
6. Serve typed REST responses to the UI.

## Scraping Approach

The source brief notes that naive HTTP clients can behave unexpectedly, so the scraper uses Playwright. It loads real pages with browser-like headers, then parses stable links and text from the rendered DOM. Cheerio is used for focused HTML parsing in helper functions and tests where a browser is unnecessary.

The scraper is polite by design: it uses low concurrency, waits between page visits, sets a descriptive user agent, and records per-record failures instead of crashing the whole run. Re-scrapes are idempotent because source IDs are derived from canonical `/deals/{id}/` and `/stores/{id-slug}/` URLs.

Brand social links are collected from the mall store page when available. If the store page exposes a brand website, the scraper also visits that website's homepage once and extracts recognized social profile links. External brand-site failures are non-fatal because website social enrichment should not block the core mall scrape.

## Schema Choices

Brands are normalized into their own table because multiple promotions share the same brand metadata and `/brands` needs promotion counts. Promotions reference brands by ID and store scrape metadata such as `sourcePortal`, `sourceUrl`, and `scrapedAt`.

`ScrapeRun` records start/end timestamps, status, counts, and errors. This makes `POST /scrape` observable even though the MVP trigger runs synchronously.

Missing scalar values are stored as `null`. Missing collections, such as social links, are stored as empty arrays. Hours are stored as an array of display rows because the source presents human-readable operating hours rather than a reliable machine schedule.

## API And UI

The API validates query parameters and response objects through `@promos/shared`. `GET /promotions` supports page-number pagination plus `search`, `startDate`, `endDate`, and `brand` filters. The UI uses those endpoints directly and renders both a flat card list and a grouped-by-brand view.

## Trade-Offs

`POST /scrape` runs the scrape synchronously for simplicity and reviewer transparency. For a production version, this should enqueue a background job and return a run ID immediately. The MVP also avoids a design system and advanced anti-bot work; the focus is the full scrape-to-UI path, type safety, and clear documentation.

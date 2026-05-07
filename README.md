# Promotions Aggregator

A local pipeline that scrapes promotions from [The Promenade Shops at Briargate](https://www.thepromenadeshopsatbriargate.com/sales), persists them in Postgres, and serves them through a typed REST API and a Next.js UI.

## Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [Docker](https://www.docker.com/) (for Postgres)

## Quickstart

```bash
git clone <repo-url>
cd promotions-aggregator
npm install
npm run setup
npm run dev
```

`npm run setup` does the following in order:

1. Copies `.env.example` → `.env` (skips if `.env` already exists)
2. Installs the Playwright Chromium browser
3. Starts the Postgres container via Docker Compose
4. Runs database migrations
5. Runs the initial scrape (~2–4 minutes)

Once setup completes, start the development servers:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| UI | http://localhost:3000 |
| API | http://localhost:4000 |

## Environment variables

All variables have working defaults in `.env.example`. `npm run setup` copies it to `.env` automatically on first run.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://promos:promos@localhost:5432/promotions?schema=public` | Postgres connection string |
| `API_PORT` | `4000` | Port the Express API listens on |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` | API base URL used by the browser |
| `SCRAPER_HEADLESS` | `true` | Set to `false` to watch the browser during a scrape |
| `SCRAPER_USER_AGENT` | `PromotionsAggregatorTakehome/0.1 (+local development)` | User-agent sent with scraper requests |

## Useful commands

```bash
npm run dev            # Start API and web app together
npm run dev:api        # Express API only
npm run dev:web        # Next.js UI only
npm run scrape         # Trigger a fresh scrape from the CLI
npm run db:migrate     # Apply Prisma migrations
npm test               # Run unit tests
npm run build          # Type-check all packages
```

## Triggering a fresh scrape

```bash
# Via CLI
npm run scrape

# Via API
curl -X POST http://localhost:4000/scrape
```

`POST /scrape` runs synchronously and returns a `ScrapeRun` summary when finished. A full scrape takes 2–4 minutes depending on the number of promotions listed and the 750 ms inter-request delay. See [DESIGN.md](DESIGN.md) for the reasoning behind the synchronous approach.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/promotions` | Paginated list. Query: `search`, `startDate`, `endDate`, `brand`, `page`, `pageSize` |
| `GET` | `/promotions/:id` | Single promotion by internal `id` or `sourceId` |
| `GET` | `/brands` | All brands with `promotionCount` and full metadata |
| `POST` | `/scrape` | Trigger a fresh scrape, returns the `ScrapeRun` record |
| `GET` | `/health` | `{ ok: true }` liveness check |

## Running tests

```bash
npm test
```

Tests cover Zod schema validation (`packages/shared`), HTML parsing helpers (`packages/scraper`), and API endpoint behaviour (`apps/api`).

## Project structure

```
apps/
  api/        Express API — routes, query building, Prisma mappers
  web/        Next.js frontend — promotions browser UI
packages/
  scraper/    Playwright + Cheerio scraper, CLI entry point
  shared/     Zod schemas and TypeScript types shared across all packages
prisma/       Schema and migrations
scripts/      setup.mjs — one-command local bootstrap
```

## Infrastructure

Only Postgres runs in Docker. The API and web servers run as local Node processes.

```bash
# Start / stop Postgres independently
docker compose up -d postgres
docker compose down
```

## Known limitations

- `POST /scrape` is synchronous — the HTTP connection stays open for the full scrape duration. A production version would enqueue a background job and return a run ID immediately.
- The scraper uses Playwright because the source site requires a rendered DOM; scrape time is bounded by real browser page loads plus the politeness delay.
- Brand matching between the promotions listing and the store directory is done by normalized name. Brands whose names differ significantly across pages fall back to a stub record with no hours or social links.
- Date range filtering is supported by the API (`startDate`, `endDate` query params) but is not yet exposed in the UI.

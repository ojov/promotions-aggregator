# Assumptions

- The target portal is fixed to `https://www.thepromenadeshopsatbriargate.com`; no multi-portal abstraction is needed for this MVP.
- Promotion source IDs are the numeric IDs in `/deals/{id}/` URLs.
- Brand source IDs are the path segments in `/stores/{id-slug}/` URLs when a matching store page is found; otherwise a deterministic slug from the brand name is used.
- Date text such as `Ends Saturday` is source-relative. The scraper stores the display text and only stores `startDate` or `endDate` when it can parse a reliable calendar date.
- Unknown scalar values are `null`; unavailable arrays are `[]`.
- Brand matching is primarily by normalized brand name. A small alias map is acceptable if the portal uses visibly different names between sales and directory pages.
- Scrape failures for individual records should be logged into `ScrapeRun.errors` and skipped so the API remains available.
- The local reviewer path uses Docker for Postgres, npm workspaces for the apps/packages, and no secrets beyond `.env` values copied from `.env.example`.
- Store pages include phone and mall-level social links near brand data. The scraper excludes phone links and filters out mall-level `shopsbriargate` socials so they are not misrepresented as brand social accounts.
- Some brand social links are not present in the rendered store pages. In those cases `socialLinks` is an empty array while website and hours are still captured when available.

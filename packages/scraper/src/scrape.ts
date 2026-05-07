import { PrismaClient } from "@prisma/client";
import { chromium, type BrowserContext } from "playwright";
import type { ScrapedBrand, ScrapedPromotion, SocialLink } from "@promos/shared";
import {
  BASE_URL,
  absoluteUrl,
  normalizeName,
  parseDirectoryStores,
  parseListingPromotions,
  parsePromotionDetail,
  parseSocialLinksFromHtml,
  parseStoreDetail,
  slugify,
  sourceIdFromUrl,
  type DirectoryStore
} from "./parse.js";
import { createPrismaClient } from "./prisma.js";

const SALES_URL = `${BASE_URL}/sales`;
const DIRECTORY_URL = `${BASE_URL}/stores`;
const REQUEST_DELAY_MS = 750;

export type ScrapeSummary = {
  runId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  promotionsFound: number;
  promotionsSaved: number;
  brandsSaved: number;
  errors: string[];
};

type DetailPromotion = ScrapedPromotion & {
  brandName: string;
  storeUrl: string | null;
  fallbackHours: string[];
};

export async function runScrape(prisma: PrismaClient = createPrismaClient()): Promise<ScrapeSummary> {
  const run = await prisma.scrapeRun.create({
    data: {
      status: "RUNNING"
    }
  });
  const errors: string[] = [];
  let promotionsFound = 0;
  let promotionsSaved = 0;
  const savedBrandIds = new Set<string>();

  const browser = await chromium.launch({
    headless: process.env.SCRAPER_HEADLESS !== "false"
  });
  const context = await browser.newContext({
    userAgent:
      process.env.SCRAPER_USER_AGENT ??
      "PromotionsAggregatorTakehome/0.1 (+local development)"
  });

  try {
    const listingHtml = await readPage(context, SALES_URL);
    const listings = parseListingPromotions(listingHtml);
    promotionsFound = listings.length;

    const directoryStores = parseDirectoryStores(await readPage(context, DIRECTORY_URL));
    const directoryByName = new Map(
      directoryStores.map((store) => [normalizeName(store.name), store])
    );
    const storeDetailCache = new Map<string, ScrapedBrand>();

    for (const listing of listings) {
      try {
        await delay(REQUEST_DELAY_MS);
        const detail = parsePromotionDetail(
          await readPage(context, listing.sourceUrl),
          listing,
          new Date()
        );
        const brand = await resolveBrand(
          context,
          detail,
          directoryByName,
          storeDetailCache
        );

        const savedBrand = await prisma.brand.upsert({
          where: { sourceId: brand.sourceId },
          create: {
            sourceId: brand.sourceId,
            name: brand.name,
            slug: brand.slug,
            mallUrl: brand.mallUrl,
            websiteUrl: brand.websiteUrl,
            hours: brand.hours,
            socialLinks: brand.socialLinks
          },
          update: {
            name: brand.name,
            slug: brand.slug,
            mallUrl: brand.mallUrl,
            websiteUrl: brand.websiteUrl,
            hours: brand.hours,
            socialLinks: brand.socialLinks
          }
        });
        savedBrandIds.add(savedBrand.id);

        await prisma.promotion.upsert({
          where: { sourceId: detail.sourceId },
          create: {
            sourceId: detail.sourceId,
            title: detail.title,
            description: detail.description,
            imageUrl: detail.imageUrl,
            startDate: detail.startDate ? new Date(detail.startDate) : null,
            endDate: detail.endDate ? new Date(detail.endDate) : null,
            dateText: detail.dateText,
            sourceUrl: detail.sourceUrl,
            sourcePortal: detail.sourcePortal,
            scrapedAt: new Date(detail.scrapedAt),
            brandId: savedBrand.id
          },
          update: {
            title: detail.title,
            description: detail.description,
            imageUrl: detail.imageUrl,
            startDate: detail.startDate ? new Date(detail.startDate) : null,
            endDate: detail.endDate ? new Date(detail.endDate) : null,
            dateText: detail.dateText,
            sourceUrl: detail.sourceUrl,
            sourcePortal: detail.sourcePortal,
            scrapedAt: new Date(detail.scrapedAt),
            brandId: savedBrand.id
          }
        });
        promotionsSaved += 1;
      } catch (error) {
        errors.push(formatError(`Promotion ${listing.sourceUrl}`, error));
      }
    }

    const status = errors.length > 0 ? "PARTIAL" : "SUCCESS";
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        promotionsFound,
        promotionsSaved,
        brandsSaved: savedBrandIds.size,
        errors
      }
    });

    return {
      runId: run.id,
      status,
      promotionsFound,
      promotionsSaved,
      brandsSaved: savedBrandIds.size,
      errors
    };
  } catch (error) {
    errors.push(formatError("Scrape run", error));
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        promotionsFound,
        promotionsSaved,
        brandsSaved: savedBrandIds.size,
        errors
      }
    });

    return {
      runId: run.id,
      status: "FAILED",
      promotionsFound,
      promotionsSaved,
      brandsSaved: savedBrandIds.size,
      errors
    };
  } finally {
    await browser.close();
  }
}

async function resolveBrand(
  context: BrowserContext,
  detail: DetailPromotion,
  directoryByName: Map<string, DirectoryStore>,
  storeDetailCache: Map<string, ScrapedBrand>
): Promise<ScrapedBrand> {
  const directStore = detail.storeUrl
    ? {
        sourceId: sourceIdFromUrl(detail.storeUrl, "stores"),
        sourceUrl: detail.storeUrl,
        name: detail.brandName
      }
    : null;
  const directoryStore = directoryByName.get(normalizeName(detail.brandName));
  const store = directStore ?? directoryStore;

  if (!store) {
    return fallbackBrand(detail);
  }

  const cached = storeDetailCache.get(store.sourceId);
  if (cached) return cached;

  await delay(REQUEST_DELAY_MS);
  const parsed = parseStoreDetail(await readPage(context, store.sourceUrl), store);
  const brand = {
    ...parsed,
    hours: parsed.hours.length > 0 ? parsed.hours : detail.fallbackHours,
    socialLinks: await enrichSocialLinksFromWebsite(parsed)
  };
  storeDetailCache.set(store.sourceId, brand);
  return brand;
}

async function enrichSocialLinksFromWebsite(
  brand: ScrapedBrand
): Promise<SocialLink[]> {
  if (!brand.websiteUrl) return brand.socialLinks;

  try {
    await delay(REQUEST_DELAY_MS);
    const websiteHtml = await fetchWebsiteHtml(brand.websiteUrl);
    return mergeSocialLinks(
      brand.socialLinks,
      parseSocialLinksFromHtml(websiteHtml, brand.websiteUrl)
    );
  } catch {
    return brand.socialLinks;
  }
}

async function fetchWebsiteHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(5_000),
    headers: {
      "user-agent":
        process.env.SCRAPER_USER_AGENT ??
        "PromotionsAggregatorTakehome/0.1 (+local development)",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Brand website returned ${response.status}`);
  }

  return response.text();
}

function fallbackBrand(detail: DetailPromotion): ScrapedBrand {
  const slug = slugify(detail.brandName);
  return {
    sourceId: slug,
    name: detail.brandName,
    slug,
    mallUrl: detail.storeUrl ? absoluteUrl(detail.storeUrl) : null,
    websiteUrl: null,
    hours: detail.fallbackHours,
    socialLinks: []
  };
}

async function readPage(
  context: BrowserContext,
  url: string,
  options: { attempts?: number; timeoutMs?: number } = {}
): Promise<string> {
  let lastError: unknown;
  const attempts = options.attempts ?? 2;
  const timeoutMs = options.timeoutMs ?? 45_000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const page = await context.newPage();
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs
      });
      await page.waitForTimeout(350);
      return await page.content();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(1_500);
    } finally {
      await page.close();
    }
  }

  throw lastError;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatError(scope: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${scope}: ${message}`;
}

function mergeSocialLinks(...groups: SocialLink[][]): SocialLink[] {
  const seen = new Set<string>();
  const merged: SocialLink[] = [];

  for (const link of groups.flat()) {
    const key = `${link.platform}:${link.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(link);
  }

  return merged;
}

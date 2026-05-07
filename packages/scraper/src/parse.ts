import * as cheerio from "cheerio";
import type { ScrapedBrand, ScrapedPromotion, SocialLink } from "@promos/shared";
import { SourcePortal } from "@promos/shared";

export const BASE_URL = "https://www.thepromenadeshopsatbriargate.com";

export type ListingPromotion = {
  sourceId: string;
  sourceUrl: string;
  title: string;
  dateText: string | null;
  brandName: string | null;
};

export type DirectoryStore = {
  sourceId: string;
  sourceUrl: string;
  name: string;
};

export function absoluteUrl(href: string): string {
  return new URL(href, BASE_URL).toString();
}

export function sourceIdFromUrl(url: string, prefix: "deals" | "stores"): string {
  const parsed = new URL(url, BASE_URL);
  const match = parsed.pathname.match(new RegExp(`/${prefix}/([^/]+)/?`));
  return match?.[1] ?? parsed.pathname.replace(/\W+/g, "-");
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s&]/g, "")
    .replace(/\band\b/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseListingPromotions(html: string): ListingPromotion[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const promotions: ListingPromotion[] = [];

  $('a[href*="/deals/"]').each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const sourceUrl = absoluteUrl(href);
    const sourceId = sourceIdFromUrl(sourceUrl, "deals");
    if (seen.has(sourceId)) return;

    const lines = textLines($(element).text());
    const parsed = parseDealCardText(lines);
    if (!parsed.title) return;

    seen.add(sourceId);
    promotions.push({
      sourceId,
      sourceUrl,
      title: parsed.title,
      dateText: parsed.dateText,
      brandName: parsed.brandName
    });
  });

  return promotions;
}

export function parseDirectoryStores(html: string): DirectoryStore[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const stores: DirectoryStore[] = [];

  $('a[href*="/stores/"]').each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;

    const sourceUrl = absoluteUrl(href);
    const sourceId = sourceIdFromUrl(sourceUrl, "stores");
    if (seen.has(sourceId)) return;

    const name = cleanStoreName($(element).text());
    if (!name) return;

    seen.add(sourceId);
    stores.push({ sourceId, sourceUrl, name });
  });

  return stores;
}

export function parsePromotionDetail(
  html: string,
  listing: ListingPromotion,
  scrapedAt: Date
): ScrapedPromotion & { brandName: string; storeUrl: string | null; fallbackHours: string[] } {
  const $ = cheerio.load(html);
  const title = cleanText($("h1").first().text()) || listing.title;
  const paragraphs = $("p")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);
  const description = paragraphs.length > 0 ? paragraphs.join("\n\n") : null;
  const imageUrl = firstUrl(
    $('meta[property="og:image"]').attr("content"),
    $("img")
      .map((_, element) => $(element).attr("src"))
      .get()
      .find(Boolean)
  );
  const brandName =
    parseMoreDealsBrand($) ??
    listing.brandName ??
    parseTitleBrandFallback($) ??
    "Unknown Brand";
  const storeUrl = $('a[href*="/stores/"]')
    .map((_, element) => $(element).attr("href"))
    .get()
    .map(absoluteUrl)[0] ?? null;
  const dateText = listing.dateText ?? parseDateTextFromDocument($);
  const endDate = parseEndDate(dateText, scrapedAt);
  const fallbackHours = parseHours($);

  return {
    sourceId: listing.sourceId,
    title,
    description,
    imageUrl,
    startDate: null,
    endDate: endDate?.toISOString() ?? null,
    dateText,
    sourceUrl: listing.sourceUrl,
    sourcePortal: SourcePortal,
    scrapedAt: scrapedAt.toISOString(),
    brandSourceId: slugify(brandName),
    brandName,
    storeUrl,
    fallbackHours
  };
}

export function parseStoreDetail(html: string, store: DirectoryStore): ScrapedBrand {
  const $ = cheerio.load(html);
  const name = cleanText($("h1").first().text()) || store.name;
  const externalLinks = $('a[href]')
    .map((_, element) => safeExternalUrl($(element).attr("href") ?? ""))
    .get()
    .filter((url): url is string => url !== null)
    .filter((url) => !isMallOrVendorUrl(url));

  return {
    sourceId: store.sourceId,
    name,
    slug: slugify(name),
    mallUrl: store.sourceUrl,
    websiteUrl: externalLinks.find((url) => !socialPlatform(url)) ?? null,
    hours: parseHours($),
    socialLinks: externalLinks
      .map((url) => {
        const platform = socialPlatform(url);
        return platform ? { platform, url } : null;
      })
      .filter((link): link is SocialLink => link !== null)
  };
}

export function parseSocialLinksFromHtml(html: string, pageUrl: string): SocialLink[] {
  const $ = cheerio.load(html);
  const links = $('a[href]')
    .map((_, element) => safeUrl($(element).attr("href") ?? "", pageUrl))
    .get()
    .filter((url): url is string => url !== null);

  return uniqueSocialLinks(
    links
      .map((url) => {
        const platform = socialPlatform(url);
        if (!platform || !isLikelySocialProfileUrl(url)) return null;
        return { platform, url: stripTracking(url) };
      })
      .filter((link): link is SocialLink => link !== null)
  );
}

export function parseEndDate(dateText: string | null, now: Date): Date | null {
  if (!dateText) return null;
  const normalized = dateText.replace(/^ends\s+/i, "").trim();
  if (/today/i.test(normalized)) return endOfDay(now);
  if (/tomorrow/i.test(normalized)) return addDays(endOfDay(now), 1);

  const monthDay = normalized.match(/(\d{1,2})\/(\d{1,2})/);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    const candidate = new Date(now.getFullYear(), month - 1, day, 23, 59, 59, 999);
    if (candidate.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }
    return candidate;
  }

  const weekday = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ].findIndex((day) => new RegExp(day, "i").test(normalized));
  if (weekday >= 0) {
    const current = now.getDay();
    const delta = (weekday - current + 7) % 7;
    return addDays(endOfDay(now), delta);
  }

  return null;
}

function parseDealCardText(lines: string[]): {
  title: string | null;
  dateText: string | null;
  brandName: string | null;
} {
  if (lines.length >= 3) {
    const dateIndex = lines.findIndex((line) => /^ends\b/i.test(line));
    if (dateIndex > 0) {
      return {
        title: lines.slice(0, dateIndex).join(" "),
        dateText: lines[dateIndex] ?? null,
        brandName: lines.slice(dateIndex + 1).join(" ") || null
      };
    }
  }

  const joined = lines.join(" ");
  const match = joined.match(/^(?<title>.+?)\s+(?<dateText>Ends\s+(Today|Tomorrow|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|\d{1,2}\/\d{1,2}))\s*(?<brandName>.*)$/i);
  return {
    title: cleanText(match?.groups?.title ?? joined) || null,
    dateText: cleanText(match?.groups?.dateText ?? "") || null,
    brandName: cleanText(match?.groups?.brandName ?? "") || null
  };
}

function parseMoreDealsBrand($: cheerio.CheerioAPI): string | null {
  const heading = $("h2,h3")
    .map((_, element) => cleanText($(element).text()))
    .get()
    .find((text) => /^more deals from /i.test(text));
  return heading?.replace(/^more deals from /i, "").trim() || null;
}

function parseTitleBrandFallback($: cheerio.CheerioAPI): string | null {
  const title = cleanText($("title").text());
  const parts = title.split("::").map((part) => part.trim()).filter(Boolean);
  return parts.length > 2 ? parts[1] ?? null : null;
}

function parseDateTextFromDocument($: cheerio.CheerioAPI): string | null {
  const lines = textLines($("body").text());
  return lines.find((line) => /^ends\b/i.test(line)) ?? null;
}

function parseHours($: cheerio.CheerioAPI): string[] {
  const headings = $("h2,h3,p,strong")
    .filter((_, element) => /^hours:?$/i.test(cleanText($(element).text())))
    .toArray();

  for (const heading of headings) {
    const listItems = $(heading)
      .nextAll("ul")
      .first()
      .find("li")
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter(Boolean);
    if (listItems.length > 0) return normalizeHours(listItems);
  }

  const lines = textLines($("body").text());
  const hoursIndex = lines.findIndex((line) => /^hours:?$/i.test(line));
  if (hoursIndex < 0) return [];

  return normalizeHours(lines
    .slice(hoursIndex + 1, hoursIndex + 8)
    .filter((line) => /\d/.test(line) && /am|pm|closed|–|-|:/i.test(line)));
}

function cleanStoreName(value: string): string {
  return cleanText(value).replace(/^Sale\s+/i, "");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function textLines(value: string): string[] {
  return value
    .split(/\n+/)
    .map(cleanText)
    .filter(Boolean);
}

function firstUrl(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    try {
      return absoluteUrl(value);
    } catch {
      continue;
    }
  }
  return null;
}

function socialPlatform(url: string): string | null {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  if (hostname.includes("instagram")) return "Instagram";
  if (hostname.includes("facebook")) return "Facebook";
  if (hostname.includes("tiktok")) return "TikTok";
  if (hostname.includes("twitter") || hostname.includes("x.com")) return "X";
  if (hostname.includes("youtube")) return "YouTube";
  if (hostname.includes("pinterest")) return "Pinterest";
  return null;
}

function isLikelySocialProfileUrl(url: string): boolean {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const pathname = parsed.pathname.toLowerCase();

  if (pathname === "/" || pathname === "") return false;
  if (pathname.includes("/share") || pathname.includes("/sharer")) return false;
  if (pathname.includes("/intent") || pathname.includes("/dialog")) return false;
  if (hostname.includes("instagram") && pathname.startsWith("/explore")) return false;
  if (hostname.includes("tiktok") && !pathname.startsWith("/@")) return false;
  if (hostname.includes("pinterest") && pathname.startsWith("/pin/create")) return false;

  return true;
}

function normalizeHours(values: string[]): string[] {
  return values
    .flatMap((value) => value.replace(/(?<!^)(Sun:)/g, "\n$1").split("\n"))
    .map(cleanText)
    .filter(Boolean)
    .filter((value) => !/^\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}$/.test(value))
    .filter((value) => /am|pm|closed/i.test(value));
}

function safeExternalUrl(href: string): string | null {
  try {
    const url = new URL(href, BASE_URL);
    const source = new URL(BASE_URL);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.hostname === source.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isMallOrVendorUrl(url: string): boolean {
  const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  return (
    hostname.includes("shopsbriargate") ||
    hostname.includes("hines") ||
    hostname.includes("placewise") ||
    url.toLowerCase().includes("shopsbriargate")
  );
}

function safeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function stripTracking(url: string): string {
  const parsed = new URL(url);
  if (socialPlatform(url)) parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (socialPlatform(url)) parsed.pathname = parsed.pathname.toLowerCase();
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

function uniqueSocialLinks(links: SocialLink[]): SocialLink[] {
  const seen = new Set<string>();
  const unique: SocialLink[] = [];

  for (const link of links) {
    const key = `${link.platform}:${link.url.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(link);
  }

  return unique;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

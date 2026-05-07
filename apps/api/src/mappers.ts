import type { Brand, Promotion, ScrapeRun, SocialLink } from "@promos/shared";

type BrandRecord = {
  id: string;
  sourceId: string;
  name: string;
  slug: string;
  mallUrl: string | null;
  websiteUrl: string | null;
  hours: unknown;
  socialLinks: unknown;
  _count?: {
    promotions: number;
  };
};

type PromotionRecord = {
  id: string;
  sourceId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  dateText: string | null;
  sourceUrl: string;
  sourcePortal: string;
  scrapedAt: Date;
  brand: BrandRecord;
};

type ScrapeRunRecord = {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  startedAt: Date;
  finishedAt: Date | null;
  promotionsFound: number;
  promotionsSaved: number;
  brandsSaved: number;
  errors: unknown;
};

export function mapBrand(record: BrandRecord): Brand {
  return {
    id: record.id,
    sourceId: record.sourceId,
    name: record.name,
    slug: record.slug,
    mallUrl: record.mallUrl,
    websiteUrl: record.websiteUrl,
    hours: stringArray(record.hours),
    socialLinks: socialLinks(record.socialLinks),
    promotionCount: record._count?.promotions
  };
}

export function mapPromotion(record: PromotionRecord): Promotion {
  return {
    id: record.id,
    sourceId: record.sourceId,
    title: record.title,
    description: record.description,
    imageUrl: record.imageUrl,
    startDate: record.startDate?.toISOString() ?? null,
    endDate: record.endDate?.toISOString() ?? null,
    dateText: record.dateText,
    sourceUrl: record.sourceUrl,
    sourcePortal: record.sourcePortal,
    scrapedAt: record.scrapedAt.toISOString(),
    brand: mapBrand(record.brand)
  };
}

export function mapScrapeRun(record: ScrapeRunRecord): ScrapeRun {
  return {
    id: record.id,
    status: record.status,
    startedAt: record.startedAt.toISOString(),
    finishedAt: record.finishedAt?.toISOString() ?? null,
    promotionsFound: record.promotionsFound,
    promotionsSaved: record.promotionsSaved,
    brandsSaved: record.brandsSaved,
    errors: stringArray(record.errors)
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function socialLinks(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is SocialLink => {
    if (typeof item !== "object" || item === null) return false;
    const link = item as Partial<SocialLink>;
    return typeof link.platform === "string" && typeof link.url === "string";
  });
}

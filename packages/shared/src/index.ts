import { z } from "zod";

export const SourcePortal = "thepromenadeshopsatbriargate.com";

export const isoDateStringSchema = z
  .string()
  .datetime({ offset: true })
  .or(z.string().date());

export const socialLinkSchema = z.object({
  platform: z.string().min(1),
  url: z.string().url()
});

export const brandSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  name: z.string(),
  slug: z.string(),
  mallUrl: z.string().url().nullable(),
  websiteUrl: z.string().url().nullable(),
  hours: z.array(z.string()),
  socialLinks: z.array(socialLinkSchema),
  promotionCount: z.number().int().nonnegative().optional()
});

export const promotionSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  startDate: isoDateStringSchema.nullable(),
  endDate: isoDateStringSchema.nullable(),
  dateText: z.string().nullable(),
  sourceUrl: z.string().url(),
  sourcePortal: z.string(),
  scrapedAt: isoDateStringSchema,
  brand: brandSchema
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative()
});

const pageNumber = z.coerce.number().int().positive().default(1);
const pageSizeNumber = z.coerce.number().int().positive().max(100).default(12);
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const promotionsQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  startDate: z.preprocess(emptyToUndefined, z.string().date().optional()),
  endDate: z.preprocess(emptyToUndefined, z.string().date().optional()),
  brand: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  page: pageNumber,
  pageSize: pageSizeNumber
});

export const paginatedPromotionsSchema = z.object({
  data: z.array(promotionSchema),
  pagination: paginationSchema
});

export const brandListSchema = z.array(brandSchema.required({ promotionCount: true }));

export const scrapeRunSchema = z.object({
  id: z.string(),
  status: z.enum(["RUNNING", "SUCCESS", "PARTIAL", "FAILED"]),
  startedAt: isoDateStringSchema,
  finishedAt: isoDateStringSchema.nullable(),
  promotionsFound: z.number().int().nonnegative(),
  promotionsSaved: z.number().int().nonnegative(),
  brandsSaved: z.number().int().nonnegative(),
  errors: z.array(z.string())
});

export type SocialLink = z.infer<typeof socialLinkSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;
export type PaginatedPromotions = z.infer<typeof paginatedPromotionsSchema>;
export type ScrapeRun = z.infer<typeof scrapeRunSchema>;

export type ScrapedBrand = Omit<Brand, "id" | "promotionCount">;
export type ScrapedPromotion = Omit<Promotion, "id" | "brand"> & {
  brandSourceId: string;
};

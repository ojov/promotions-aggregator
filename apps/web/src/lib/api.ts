import {
  brandListSchema,
  paginatedPromotionsSchema,
  type Brand,
  type PaginatedPromotions
} from "@promos/shared";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type PromotionRequest = {
  search: string;
  brand: string;
  page: number;
  pageSize: number;
};

export async function fetchPromotions(
  request: PromotionRequest,
  signal?: AbortSignal
): Promise<PaginatedPromotions> {
  const params = new URLSearchParams({
    page: String(request.page),
    pageSize: String(request.pageSize)
  });

  if (request.search.trim()) params.set("search", request.search.trim());
  if (request.brand) params.set("brand", request.brand);

  const response = await fetch(`${API_BASE_URL}/promotions?${params.toString()}`, {
    signal
  });
  if (!response.ok) {
    throw new Error(`Failed to load promotions (${response.status})`);
  }

  return paginatedPromotionsSchema.parse(await response.json());
}

export async function fetchBrands(signal?: AbortSignal): Promise<Brand[]> {
  const response = await fetch(`${API_BASE_URL}/brands`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load brands (${response.status})`);
  }

  return brandListSchema.parse(await response.json());
}

import { describe, expect, it } from "vitest";
import { paginatedPromotionsSchema, promotionsQuerySchema } from "./index.js";

describe("shared schemas", () => {
  it("coerces promotion query pagination defaults", () => {
    expect(promotionsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 12
    });
  });

  it("validates paginated promotion responses", () => {
    const response = paginatedPromotionsSchema.parse({
      data: [],
      pagination: {
        page: 1,
        pageSize: 12,
        total: 0,
        totalPages: 0
      }
    });

    expect(response.pagination.total).toBe(0);
  });
});

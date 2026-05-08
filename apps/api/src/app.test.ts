import { describe, expect, it } from "vitest";
import { promotionsQuerySchema } from "@promos/shared";
import { buildPromotionWhere } from "./app.js";

describe("buildPromotionWhere", () => {
  it("adds search and brand filters", () => {
    const where = buildPromotionWhere(
      promotionsQuerySchema.parse({
        search: "candles",
        brand: "bath-body-works"
      })
    );

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.any(Array)
        },
        {
          brand: {
            OR: expect.any(Array)
          }
        }
      ]
    });
  });

  it("adds date overlap filters", () => {
    const where = buildPromotionWhere(
      promotionsQuerySchema.parse({
        startDate: "2026-05-01",
        endDate: "2026-05-31"
      })
    );

    const end = new Date("2026-05-31");
    end.setHours(23, 59, 59, 999);

    expect(where).toEqual({
      AND: [
        {
          OR: [{ endDate: null }, { endDate: { gte: new Date("2026-05-01") } }]
        },
        {
          OR: [{ startDate: null }, { startDate: { lte: end } }]
        }
      ]
    });
  });
});

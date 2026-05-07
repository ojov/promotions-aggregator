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

    expect(where).toMatchObject({
      AND: [
        {
          OR: expect.any(Array)
        },
        {
          OR: expect.any(Array)
        }
      ]
    });
  });
});

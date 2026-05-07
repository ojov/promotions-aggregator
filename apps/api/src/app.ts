import cors from "cors";
import express from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  brandListSchema,
  paginatedPromotionsSchema,
  promotionSchema,
  promotionsQuerySchema,
  scrapeRunSchema
} from "@promos/shared";
import { runScrape } from "@promos/scraper";
import { mapBrand, mapPromotion, mapScrapeRun } from "./mappers.js";

export function createApp(prisma: PrismaClient) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/promotions", async (req, res, next) => {
    try {
      const query = promotionsQuerySchema.parse(req.query);
      const where = buildPromotionWhere(query);
      const [records, total] = await Promise.all([
        prisma.promotion.findMany({
          where,
          include: { brand: true },
          orderBy: [{ endDate: "asc" }, { title: "asc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize
        }),
        prisma.promotion.count({ where })
      ]);
      const payload = paginatedPromotionsSchema.parse({
        data: records.map(mapPromotion),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize)
        }
      });

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get("/promotions/:id", async (req, res, next) => {
    try {
      const record = await prisma.promotion.findFirst({
        where: {
          OR: [{ id: req.params.id }, { sourceId: req.params.id }]
        },
        include: { brand: true }
      });

      if (!record) {
        res.status(404).json({ error: "Promotion not found" });
        return;
      }

      res.json(promotionSchema.parse(mapPromotion(record)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/brands", async (_req, res, next) => {
    try {
      const records = await prisma.brand.findMany({
        include: {
          _count: {
            select: { promotions: true }
          }
        },
        orderBy: { name: "asc" }
      });

      res.json(brandListSchema.parse(records.map(mapBrand)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/scrape", async (_req, res, next) => {
    try {
      const summary = await runScrape(prisma);
      const run = await prisma.scrapeRun.findUniqueOrThrow({
        where: { id: summary.runId }
      });

      res.status(summary.status === "FAILED" ? 500 : 201).json(scrapeRunSchema.parse(mapScrapeRun(run)));
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      const status = message.includes("Invalid") ? 400 : 500;
      res.status(status).json({ error: message });
    }
  );

  return app;
}

type ParsedPromotionQuery = ReturnType<typeof promotionsQuerySchema.parse>;

export function buildPromotionWhere(query: ParsedPromotionQuery): Prisma.PromotionWhereInput {
  const and: Prisma.PromotionWhereInput[] = [];

  if (query.search) {
    and.push({
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { brand: { name: { contains: query.search, mode: "insensitive" } } }
      ]
    });
  }

  if (query.brand) {
    and.push({
      brand: {
        OR: [
          { sourceId: query.brand },
          { slug: query.brand },
          { name: { contains: query.brand, mode: "insensitive" } }
        ]
      }
    });
  }

  if (query.startDate) {
    and.push({
      OR: [{ endDate: null }, { endDate: { gte: new Date(query.startDate) } }]
    });
  }

  if (query.endDate) {
    const end = new Date(query.endDate);
    end.setHours(23, 59, 59, 999);
    and.push({
      OR: [{ startDate: null }, { startDate: { lte: end } }]
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

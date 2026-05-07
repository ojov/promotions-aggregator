"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Brand, PaginatedPromotions, Promotion } from "@promos/shared";
import { fetchBrands, fetchPromotions } from "@/lib/api";

const PAGE_SIZE = 12;

type ViewMode = "flat" | "grouped";

export function PromotionsBrowser() {
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [promotions, setPromotions] = useState<PaginatedPromotions | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchBrands(controller.signal)
      .then(setBrands)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchPromotions(
      {
        search,
        brand,
        page,
        pageSize: PAGE_SIZE
      },
      controller.signal
    )
      .then(setPromotions)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [brand, page, search]);

  const groupedPromotions = useMemo(() => {
    const groups = new Map<string, { brand: Brand; promotions: Promotion[] }>();
    for (const promotion of promotions?.data ?? []) {
      const existing = groups.get(promotion.brand.sourceId);
      if (existing) {
        existing.promotions.push(promotion);
      } else {
        groups.set(promotion.brand.sourceId, {
          brand: promotion.brand,
          promotions: [promotion]
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.brand.name.localeCompare(b.brand.name)
    );
  }, [promotions]);

  const total = promotions?.pagination.total ?? 0;
  const totalPages = promotions?.pagination.totalPages ?? 0;

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">The Promenade Shops at Briargate</p>
        <div>
          <h1>Promotions Aggregator</h1>
          <p>
            Browse scraped mall promotions as a flat list or grouped by brand
            with store metadata.
          </p>
        </div>
      </header>

      <section className="toolbar" aria-label="Promotion filters">
        <label>
          Search
          <input
            value={search}
            placeholder="Promotion or brand"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>

        <label>
          Brand
          <select
            value={brand}
            onChange={(event) => {
              setBrand(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All brands</option>
            {brands.map((item) => (
              <option key={item.sourceId} value={item.sourceId}>
                {item.name} ({item.promotionCount ?? 0})
              </option>
            ))}
          </select>
        </label>

        <div className="segmented" aria-label="View mode">
          <button
            className={viewMode === "flat" ? "active" : ""}
            type="button"
            onClick={() => setViewMode("flat")}
          >
            Flat
          </button>
          <button
            className={viewMode === "grouped" ? "active" : ""}
            type="button"
            onClick={() => setViewMode("grouped")}
          >
            Group by brand
          </button>
        </div>
      </section>

      <div className="summary">
        {loading ? "Loading promotions..." : `${total} promotions found`}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {!loading && !error && promotions?.data.length === 0 ? (
        <p className="empty">No promotions match the current filters.</p>
      ) : null}

      {viewMode === "flat" ? (
        <section className="grid" aria-label="Promotions">
          {promotions?.data.map((promotion) => (
            <PromotionCard key={promotion.id} promotion={promotion} />
          ))}
        </section>
      ) : (
        <section className="brand-groups" aria-label="Promotions grouped by brand">
          {groupedPromotions.map((group) => (
            <BrandGroup
              key={group.brand.sourceId}
              brand={group.brand}
              promotions={group.promotions}
            />
          ))}
        </section>
      )}

      <footer className="pagination">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <span>
          Page {totalPages === 0 ? 0 : page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </footer>
    </main>
  );
}

function BrandGroup({
  brand,
  promotions
}: {
  brand: Brand;
  promotions: Promotion[];
}) {
  return (
    <article className="brand-group">
      <header>
        <div>
          <h2>{brand.name}</h2>
          <p>{promotions.length} promotions on this page</p>
        </div>
        <BrandMetadata brand={brand} />
      </header>
      <div className="grid">
        {promotions.map((promotion) => (
          <PromotionCard key={promotion.id} promotion={promotion} />
        ))}
      </div>
    </article>
  );
}

function PromotionCard({ promotion }: { promotion: Promotion }) {
  return (
    <article className="card">
      <div className="imageWrap">
        {promotion.imageUrl ? (
          <Image
            src={promotion.imageUrl}
            alt=""
            fill
            sizes="(max-width: 700px) 100vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="imageFallback">No image</div>
        )}
      </div>
      <div className="cardBody">
        <p className="brandName">{promotion.brand.name}</p>
        <h2>{promotion.title}</h2>
        <p>{promotion.description ?? "No description provided."}</p>
        <div className="cardMeta">
          <span>{promotion.dateText ?? formatDate(promotion.endDate)}</span>
          <a href={promotion.sourceUrl} target="_blank" rel="noreferrer">
            Source
          </a>
        </div>
      </div>
    </article>
  );
}

function BrandMetadata({ brand }: { brand: Brand }) {
  return (
    <dl className="metadata">
      <div>
        <dt>Website</dt>
        <dd>
          {brand.websiteUrl ? (
            <a href={brand.websiteUrl} target="_blank" rel="noreferrer">
              Visit website
            </a>
          ) : (
            "Not found"
          )}
        </dd>
      </div>
      <div>
        <dt>Hours</dt>
        <dd>{brand.hours.length > 0 ? brand.hours.join(" | ") : "Not found"}</dd>
      </div>
      <div>
        <dt>Social</dt>
        <dd>
          {brand.socialLinks.length > 0
            ? brand.socialLinks.map((link) => (
                <a key={`${link.platform}-${link.url}`} href={link.url}>
                  {link.platform}
                </a>
              ))
            : "Not found"}
        </dd>
      </div>
    </dl>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "No end date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

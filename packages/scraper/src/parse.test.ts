import { describe, expect, it } from "vitest";
import {
  parseDirectoryStores,
  parseEndDate,
  parseListingPromotions,
  parseStoreDetail
} from "./parse.js";

describe("scraper parsing", () => {
  it("extracts deal cards from the sales page", () => {
    const html = `
      <a href="/deals/123/">
        Summer Sale
        <span>Ends 6/1</span>
        <span>Example Brand</span>
      </a>
    `;

    expect(parseListingPromotions(html)).toEqual([
      {
        sourceId: "123",
        sourceUrl: "https://www.thepromenadeshopsatbriargate.com/deals/123/",
        title: "Summer Sale",
        dateText: "Ends 6/1",
        brandName: "Example Brand"
      }
    ]);
  });

  it("extracts store metadata without footer socials or phone links", () => {
    const html = `
      <h1>Tradehome Shoes</h1>
      <h2>Hours:</h2>
      <ul>
        <li>Mon - Sat: 10am - 8pmSun: 11am - 6pm</li>
        <li>(719) 368-6462</li>
      </ul>
      <a href="https://tradehome.com">Website</a>
      <a href="https://www.instagram.com/shopsbriargate/">Mall Instagram</a>
      <a href="tel:+17193686462">Phone</a>
    `;

    expect(
      parseStoreDetail(html, {
        sourceId: "1036007-tradehome-shoes",
        sourceUrl:
          "https://www.thepromenadeshopsatbriargate.com/stores/1036007-tradehome-shoes/",
        name: "Tradehome Shoes"
      })
    ).toMatchObject({
      name: "Tradehome Shoes",
      websiteUrl: "https://tradehome.com/",
      hours: ["Mon - Sat: 10am - 8pm", "Sun: 11am - 6pm"],
      socialLinks: []
    });
  });

  it("parses relative end dates", () => {
    const now = new Date("2026-05-07T12:00:00.000Z");
    expect(parseEndDate("Ends Today", now)?.toISOString()).toContain("2026-05-07");
    expect(parseEndDate("Ends 12/31", now)?.toISOString()).toContain("2026-12-31");
  });

  it("extracts directory stores", () => {
    const html = `<a href="/stores/1036007-tradehome-shoes/">Tradehome Shoes</a>`;
    expect(parseDirectoryStores(html)[0]).toMatchObject({
      sourceId: "1036007-tradehome-shoes",
      name: "Tradehome Shoes"
    });
  });
});

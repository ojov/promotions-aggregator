import { describe, expect, it } from "vitest";
import {
  parseDirectoryStores,
  parseEndDate,
  parseListingPromotions,
  parseSocialLinksFromHtml,
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
      <a href="https://www.placewise.com">Mall platform vendor</a>
      <a href="https://www.hines.com">Mall owner</a>
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

  it("extracts brand social links from external brand websites", () => {
    const html = `
      <a href="/stores">Stores</a>
      <a href="https://www.instagram.com/tradehomeshoesofficial/?utm_source=site">Instagram</a>
      <a href="https://www.facebook.com/tradehomeshoes">Facebook</a>
      <a href="https://www.instagram.com/TRADEHOMESHOESOFFICIAL/">Instagram duplicate</a>
      <a href="https://www.facebook.com/profile.php?id=123">Generic Facebook profile</a>
      <a href="https://www.tiktok.com/search?q=tradehome">TikTok search</a>
      <a href="https://www.instagram.com/explore/tags/tradehome/">Tag page</a>
    `;

    expect(parseSocialLinksFromHtml(html, "https://tradehome.com")).toEqual([
      {
        platform: "Instagram",
        url: "https://instagram.com/tradehomeshoesofficial/"
      },
      {
        platform: "Facebook",
        url: "https://facebook.com/tradehomeshoes/"
      }
    ]);
  });

  it("extracts social links from data-marked footer icon blocks", () => {
    const html = `
      <footer>
        <div data-dan-component="social-icons">
          <a aria-label="Open facebook in a new window" href="https://www.facebook.com/bathandbodyworks">Facebook</a>
          <a aria-label="Open instagram in a new window" href="https://www.instagram.com/bathandbodyworks/">Instagram</a>
          <a aria-label="Open tiktok in a new window" href="https://www.tiktok.com/@bathandbodyworks">TikTok</a>
          <a aria-label="Open youtube in a new window" href="https://www.youtube.com/user/bathandbodyworks/">YouTube</a>
          <a aria-label="Open pinterest in a new window" href="https://www.pinterest.com/bathbodyworks/">Pinterest</a>
        </div>
      </footer>
    `;

    expect(parseSocialLinksFromHtml(html, "https://www.bathandbodyworks.com")).toEqual([
      {
        platform: "Facebook",
        url: "https://facebook.com/bathandbodyworks/"
      },
      {
        platform: "Instagram",
        url: "https://instagram.com/bathandbodyworks/"
      },
      {
        platform: "TikTok",
        url: "https://tiktok.com/@bathandbodyworks/"
      },
      {
        platform: "YouTube",
        url: "https://youtube.com/user/bathandbodyworks/"
      },
      {
        platform: "Pinterest",
        url: "https://pinterest.com/bathbodyworks/"
      }
    ]);
  });

  it("extracts social links from icon-only footer lists", () => {
    const html = `
      <footer>
        <ul class="c-pwa-social__list c-pwa-social__list--social">
          <li><a href="https://www.instagram.com/freepeople"><svg aria-label="Instagram"></svg></a></li>
          <li><a href="https://www.tiktok.com/@freepeople"><svg aria-label="TikTok"></svg></a></li>
          <li><a href="https://www.facebook.com/freepeople"><svg aria-label="Facebook"></svg></a></li>
          <li><a href="https://www.pinterest.com/freepeople"><svg aria-label="Pinterest"></svg></a></li>
          <li><a href="https://www.youtube.com/user/freepeople"><svg aria-label="Youtube"></svg></a></li>
        </ul>
      </footer>
    `;

    expect(parseSocialLinksFromHtml(html, "https://www.freepeople.com")).toEqual([
      {
        platform: "Instagram",
        url: "https://instagram.com/freepeople/"
      },
      {
        platform: "TikTok",
        url: "https://tiktok.com/@freepeople/"
      },
      {
        platform: "Facebook",
        url: "https://facebook.com/freepeople/"
      },
      {
        platform: "Pinterest",
        url: "https://pinterest.com/freepeople/"
      },
      {
        platform: "YouTube",
        url: "https://youtube.com/user/freepeople/"
      }
    ]);
  });

  it("extracts social links from data-testid footer items", () => {
    const html = `
      <footer>
        <ul>
          <li data-testid="social-links-item">
            <a class="social-link" href="https://twitter.com/victoriassecret" data-link-name="Twitter" rel="noopener noreferrer" target="_blank">
              <svg aria-label="Twitter" role="img"><title>Twitter</title></svg>
            </a>
          </li>
        </ul>
      </footer>
    `;

    expect(parseSocialLinksFromHtml(html, "https://www.victoriassecret.com")).toEqual([
      {
        platform: "X",
        url: "https://twitter.com/victoriassecret/"
      }
    ]);
  });
});

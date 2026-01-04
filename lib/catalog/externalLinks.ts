// lib/catalog/externalLinks.ts
import type { CatalogListRow } from "./listQuery";

export type ExternalLinks = Array<{ key: string; label: string; href: string }>;

function enc(s: string) {
  return encodeURIComponent(s);
}

function buildEbayQuery(item: CatalogListRow) {
  // Keep it simple and robust. Add set/platform/etc as you expand.
  const bits = [item.name, item.version].filter(Boolean).join(" ");
  return bits.trim();
}

export function buildExternalLinksForListRow(args: {
  item: CatalogListRow;
  isLego: boolean;
  locale?: "en-ca" | "en-us";
}) : ExternalLinks {
  const { item, isLego } = args;
  const locale = args.locale ?? "en-ca";

  const links: ExternalLinks = [];

  // CollectorsHub internal search
  // Adjust query params to match your existing catalogue routing.
  links.push({
    key: "collectorshub",
    label: "CollectorsHub",
    href: `/catalog?query=${enc(item.name)}`
  });

  // eBay search
  const ebayQ = buildEbayQuery(item);
  links.push({
    key: "ebay",
    label: "eBay",
    href: `https://www.ebay.com/sch/i.html?_nkw=${enc(ebayQ)}`
  });

  if (isLego) {
    const bb = item.building_blocks ?? null;
    const setNo = bb?.set_number ?? null;

    // Bricklink (prefer set number)
    if (setNo) {
      links.push({
        key: "bricklink",
        label: "Bricklink",
        href: `https://www.bricklink.com/v2/catalog/catalogitem.page?S=${setNo}-1`
      });
    } else {
      links.push({
        key: "bricklink",
        label: "Bricklink",
        href: `https://www.bricklink.com/v2/search.page?q=${enc(item.name)}`
      });
    }

    // LEGO.com only if in production
    if (item.production_status === "in_production") {
      if (setNo) {
        links.push({
          key: "lego",
          label: "LEGO",
          href: `https://www.lego.com/${locale}/product/${setNo}`
        });
      } else {
        links.push({
          key: "lego",
          label: "LEGO",
          href: `https://www.lego.com/${locale}/search?q=${enc(item.name)}`
        });
      }
    }
  }

  // Keep it tight: 2–4 max
  return links.slice(0, 4);
}

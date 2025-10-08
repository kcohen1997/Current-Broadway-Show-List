import ShowList from "./ShowList";
import NodeCache from "node-cache";
import axios from "axios";
import * as cheerio from "cheerio";
import stringSimilarity from "string-similarity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cache = new NodeCache({ stdTTL: 60 * 60 });
const DEFAULT_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/e/eb/London_%2844761485915%29.jpg";

// ------------------- Helpers -------------------
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) url = "https:" + url;
  if (url.startsWith("/")) url = "https://www.playbill.com" + url;
  return url;
}

// Validate image exists
async function validateImage(url) {
  if (!url) return null;
  try {
    const res = await axios.head(url);
    return res.status === 200 ? url : null;
  } catch {
    return null;
  }
}

// ------------------- Playbill Scraper -------------------
async function getPlaybillShows() {
  const cached = cache.get("playbill");
  if (cached) return cached;

  try {
    const res = await axios.get("https://playbill.com/shows/broadway", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $ = cheerio.load(res.data);
    const shows = [];

    $("div.show-container").each((_, el) => {
      const title = $(el).find("div.prod-title a").text().trim();
      const link = normalizeUrl($(el).find("div.prod-title a").attr("href"));

      if (!title || !link) return;

      let imgSrc = $(el).find("div.cover-container img").first().attr("src") || DEFAULT_IMG;
      if (imgSrc.startsWith("//")) imgSrc = "https:" + imgSrc;

      shows.push({ title, link, imgSrc });
    });

    cache.set("playbill", shows);
    return shows;
  } catch {
    return [];
  }
}

// ------------------- Wikipedia Scraper -------------------
async function getWikipediaShows() {
  const cached = cache.get("wiki");
  if (cached) return cached;

  try {
    const res = await axios.get("https://en.wikipedia.org/wiki/Broadway_theatre", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $ = cheerio.load(res.data);
    const shows = [];

    $("table.wikitable").first().find("tbody tr").slice(1).each((_, el) => {
      const cells = $(el).find("td");
      if (cells.length < 7) return;

      const currentProduction = $(cells[3]).text().trim().replace(/(\s)?\[\d+\]/g, "");
      const type = $(cells[4]).text().trim() || "Unknown";
      const opening = $(cells[5]).text().trim() || "N/A";
      const closing = $(cells[6]).text().trim() || "N/A";

      if (!currentProduction) return;

      shows.push({ title: currentProduction, type, openingdate: opening, closingdate: closing });
    });

    cache.set("wiki", shows);
    return shows;
  } catch {
    return [];
  }
}

// ------------------- Enrich & Filter -------------------
function enrichShows(playbill, wiki) {
  const enriched = [];

  for (const wikiShow of wiki) {
    const normWiki = normalizeTitle(wikiShow.title);
    const match = playbill.find((p) => normalizeTitle(p.title) === normWiki);
    if (!match) continue; // only include shows present on both

    enriched.push({
      title: wikiShow.title,
      type: wikiShow.type,
      openingdate: wikiShow.openingdate,
      closingdate: wikiShow.closingdate,
      imgSrc: match.imgSrc || DEFAULT_IMG,
      link: match.link || "#",
    });
  }

  return enriched;
}

// ------------------- Page -------------------
export default async function Page() {
  const [playbill, wiki] = await Promise.all([getPlaybillShows(), getWikipediaShows()]);
  const enrichedShows = enrichShows(playbill, wiki);

  if (!enrichedShows.length) {
    return (
      <p className="text-center text-gray-500 mt-10">
        No Broadway shows found at this time.
      </p>
    );
  }

  return <ShowList shows={enrichedShows} />;
}

import ShowList from "./ShowList";
import NodeCache from "node-cache";
import axios from "axios";
import * as cheerio from "cheerio";

// Next.js Page Config
export const dynamic = "force-dynamic"; // ensures page always renders fresh data
export const runtime = "nodejs"; // runs on Node.js server environment

// Cache Setup
const cache = new NodeCache({ stdTTL: 60 * 60 }); // cache data for 1 hour

// Default fallback image if a show has no poster
const DEFAULT_IMG =
  "https://upload.wikimedia.org/wikipedia/commons/e/eb/London_%2844761485915%29.jpg";

// Helpers
// Normalize show title for matching (lowercase, remove special chars, trim spaces)
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Normalize URLs to absolute links
function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) url = "https:" + url; // handle protocol-relative URLs
  if (url.startsWith("/")) url = "https://www.playbill.com" + url; // relative Playbill paths
  return url;
}

// Validate image URL by making a HEAD request
async function validateImage(url) {
  if (!url) return null;
  try {
    const res = await axios.head(url);
    return res.status === 200 ? url : null;
  } catch {
    return null;
  }
}

// Playbill Data Scraper
// Scrape current Broadway shows from Playbill
async function getPlaybillShows() {
  // Check cache first
  const cached = cache.get("playbill");
  if (cached) return cached;

  try {
    const res = await axios.get("https://playbill.com/shows/broadway", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const $ = cheerio.load(res.data);
    const shows = [];

    // Each show container
    $("div.show-container").each((_, el) => {
      const title = $(el).find("div.prod-title a").text().trim();
      const link = normalizeUrl($(el).find("div.prod-title a").attr("href"));

      if (!title || !link) return;

      let imgSrc =
        $(el).find("div.cover-container img").first().attr("src") ||
        DEFAULT_IMG;
      if (imgSrc.startsWith("//")) imgSrc = "https:" + imgSrc;

      shows.push({ title, link, imgSrc });
    });

    cache.set("playbill", shows); // cache results
    return shows;
  } catch {
    return [];
  }
}

// Wikipedia Data Scraper
// Scrape Broadway show info from Wikipedia
async function getWikipediaShows() {
  const cached = cache.get("wiki");
  if (cached) return cached;

  try {
    const res = await axios.get(
      "https://en.wikipedia.org/wiki/Broadway_theatre",
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const $ = cheerio.load(res.data);
    const shows = [];

    // Select first wikitable and iterate rows
    $("table.wikitable")
      .first()
      .find("tbody tr")
      .slice(1) // skip header row
      .each((_, el) => {
        const cells = $(el).find("td");
        if (cells.length < 7) return;

        const currentProduction = $(cells[3])
          .text()
          .trim()
          .replace(/(\s)?\[\d+\]/g, ""); // remove reference numbers
        const type = $(cells[4]).text().trim() || "Unknown";
        const opening = $(cells[5]).text().trim() || "N/A";
        const closing = $(cells[6]).text().trim() || "N/A";

        if (!currentProduction) return;

        shows.push({
          title: currentProduction,
          type,
          openingdate: opening,
          closingdate: closing,
        });
      });

    cache.set("wiki", shows); // cache results
    return shows;
  } catch {
    return [];
  }
}

// Match Playbill and Wikipedia shows, only include shows present in both
function enrichShows(playbill, wiki) {
  const enriched = [];

  for (const wikiShow of wiki) {
    const normWiki = normalizeTitle(wikiShow.title);

    // Exact title match with Playbill
    const match = playbill.find((p) => normalizeTitle(p.title) === normWiki);
    if (!match) continue; // skip if not on Playbill

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

export default async function Page() {
  // Fetch Playbill and Wikipedia shows in parallel
  const [playbill, wiki] = await Promise.all([
    getPlaybillShows(),
    getWikipediaShows(),
  ]);

  // Combine both sources, only including shows present in both
  const enrichedShows = enrichShows(playbill, wiki);

  // Handle empty state
  if (!enrichedShows.length) {
    return (
      <p className="text-center text-gray-500 mt-10">
        No Broadway shows found at this time.
      </p>
    );
  }

  // Render ShowList component with enriched show data
  return <ShowList shows={enrichedShows} />;
}

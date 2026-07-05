import type { DateRange } from "../sources-config.js";
import { isWithinDateRange } from "../date-range.js";
import { fetchText, sleep } from "./http.js";
import { parseFlexibleDate, uploadDateFromUrlPath, findPublicationDateInHtml, parseShortUsDate } from "./dates.js";
import { listFeedItems } from "./feed-items.js";
import type { ContentListItem } from "./types.js";

export interface ListingContext {
  sourceUrl: string;
  dateRange?: DateRange;
  requestDelayMs: number;
  maxItems?: number | null;
}

export async function filterListedItems(
  context: ListingContext,
  candidates: ContentListItem[],
  probeMissingDates: boolean,
): Promise<ContentListItem[]> {
  const items: ContentListItem[] = [];

  for (const [index, item] of candidates.entries()) {
    let uploadDate = item.upload_date ?? uploadDateFromUrlPath(item.url) ?? null;

    if (!uploadDate && probeMissingDates) {
      if (context.requestDelayMs > 0 && index > 0) {
        await sleep(context.requestDelayMs);
      }
      uploadDate = await probePageDate(item.url);
    }

    if (!uploadDate) {
      continue;
    }

    if (context.dateRange && uploadDate < context.dateRange.since) {
      break;
    }

    if (context.dateRange && !isWithinDateRange(uploadDate, context.dateRange)) {
      continue;
    }

    items.push({ ...item, upload_date: uploadDate });

    if (context.maxItems != null && context.maxItems > 0 && items.length >= context.maxItems) {
      break;
    }
  }

  return items;
}

async function probePageDate(url: string): Promise<string | null> {
  const html = await fetchText(url);
  return findPublicationDateInHtml(html) ?? uploadDateFromUrlPath(url);
}

export async function listGwernIndex(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(
    /href="(\/blog\/(\d{4})\/[^"]+)"[^>]*id="(\d{4})-(\d{2})-(\d{2})"[^>]*>([^<]+)<\/a>/g,
  )) {
    const path = match[1];
    const url = new URL(path, "https://gwern.net").href;
    const id = path.split("/").pop() ?? path;
    const title = match[6].trim();
    if (!title || seen.has(id)) {
      continue;
    }
    seen.add(id);

    items.push({
      id,
      title,
      url,
      upload_date: `${match[3]}${match[4]}${match[5]}`,
    });
  }

  return filterListedItems(context, items, false);
}

export async function listAnthropicEngineering(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const links = [...html.matchAll(/href="(\/engineering\/[a-z0-9-]+)"/g)].map((m) => m[1]);
  const dates = [
    ...html.matchAll(
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{1,2}), (202[0-9])/g,
    ),
  ].map((m) => parseFlexibleDate(`${m[1]} ${m[2]}, ${m[3]}`));

  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const [index, path] of links.entries()) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);

    const url = new URL(path, "https://www.anthropic.com").href;
    const id = path.split("/").pop() ?? path;
    const title = id.replace(/-/g, " ");
    items.push({
      id,
      title,
      url,
      upload_date: dates[index] ?? null,
    });
  }

  return filterListedItems(context, items, true);
}

export async function listOpenAiBlog(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const seen = new Set<string>();
  const items: ContentListItem[] = [];

  for (const match of html.matchAll(/href="(\/blog\/[a-z0-9-]+)"/g)) {
    const path = match[1];
    if (path.includes("/topic/") || seen.has(path)) {
      continue;
    }
    seen.add(path);

    const chunk = html.slice(match.index ?? 0, (match.index ?? 0) + 1500);
    const altMatch = /<img[^>]+alt="([^"]+)"/.exec(chunk);
    const id = path.split("/").pop() ?? path;
    items.push({
      id,
      title: altMatch?.[1]?.trim() || id.replace(/-/g, " "),
      url: new URL(path, "https://developers.openai.com").href,
    });
  }

  return filterListedItems(context, items, true);
}

export async function listFromFeed(
  context: ListingContext,
  feedUrl: string,
  options: { urlIncludes?: string } = {},
): Promise<ContentListItem[]> {
  let feedItems = await listFeedItems(feedUrl);
  if (options.urlIncludes) {
    feedItems = feedItems.filter((item) => item.url.includes(options.urlIncludes!));
  }
  const needsDateProbe = feedItems.some((item) => !item.upload_date);
  return filterListedItems(context, feedItems, needsDateProbe);
}

export async function listHamelIndex(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(
    /<span class="listing-date">([^<]+)<\/span>[\s\S]*?href="(\.\/blog\/posts\/([^/]+)\/[^"]+)"[^>]*>([^<]+)/g,
  )) {
    const uploadDate = parseShortUsDate(match[1]);
    const path = match[2];
    const slug = match[3];
    const title = match[4].trim();
    if (!uploadDate || !title || seen.has(slug)) {
      continue;
    }
    seen.add(slug);

    items.push({
      id: slug,
      title,
      url: new URL(path, context.sourceUrl).href,
      upload_date: uploadDate,
    });
  }

  return filterListedItems(context, items, false);
}

export async function listMachineTheoryJournal(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/href="\.\/(2026-\d{2}-\d{2}-[^"]+\.html)">([^<]*)</g)) {
    const filename = match[1];
    const url = new URL(filename, context.sourceUrl).href;
    const id = filename.replace(/\.html$/, "");
    const dateMatch = /^(2026)-(\d{2})-(\d{2})-/.exec(filename);
    if (!dateMatch || seen.has(id)) {
      continue;
    }
    seen.add(id);

    const title = match[2].trim() || id.replace(/^2026-\d{2}-\d{2}-/, "").replace(/-/g, " ");
    items.push({
      id,
      title,
      url,
      upload_date: `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`,
    });
  }

  return filterListedItems(context, items, false);
}

interface AsteriskIssueArticle {
  headline: string;
  url: string;
  datePublished: string;
}

function parseAsteriskIssueArticles(html: string): AsteriskIssueArticle[] {
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/i);
  if (!match) {
    return [];
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return [];
  }

  if (payload["@type"] !== "PublicationIssue") {
    return [];
  }

  const parts = payload.hasPart;
  if (!Array.isArray(parts)) {
    return [];
  }

  const articles: AsteriskIssueArticle[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }
    const article = part as Record<string, unknown>;
    if (article["@type"] !== "Article") {
      continue;
    }
    const headline = typeof article.headline === "string" ? article.headline.trim() : "";
    const url = typeof article.url === "string" ? article.url.trim() : "";
    const datePublished =
      typeof article.datePublished === "string" ? article.datePublished.trim() : "";
    if (!headline || !url || !datePublished) {
      continue;
    }
    articles.push({ headline, url, datePublished });
  }

  return articles;
}

function listAsteriskIssueNumbers(issuesIndexHtml: string): string[] {
  const seen = new Set<string>();
  const numbers: string[] = [];

  for (const match of issuesIndexHtml.matchAll(/href="https:\/\/asteriskmag\.com\/issues\/(\d+)"/g)) {
    const issueNumber = match[1];
    if (seen.has(issueNumber)) {
      continue;
    }
    seen.add(issueNumber);
    numbers.push(issueNumber);
  }

  return numbers.sort((a, b) => Number(b) - Number(a));
}

export async function listAsteriskIssues(context: ListingContext): Promise<ContentListItem[]> {
  const indexHtml = await fetchText(context.sourceUrl || "https://asteriskmag.com/issues");
  const issueNumbers = listAsteriskIssueNumbers(indexHtml);
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const [index, issueNumber] of issueNumbers.entries()) {
    if (context.requestDelayMs > 0 && index > 0) {
      await sleep(context.requestDelayMs);
    }

    const issueUrl = `https://asteriskmag.com/issues/${issueNumber}`;
    const issueHtml = await fetchText(issueUrl);
    const articles = parseAsteriskIssueArticles(issueHtml);

    for (const article of articles) {
      const uploadDate = parseFlexibleDate(article.datePublished.slice(0, 10));
      if (!uploadDate) {
        continue;
      }

      if (context.dateRange && !isWithinDateRange(uploadDate, context.dateRange)) {
        continue;
      }

      const slug = new URL(article.url).pathname.split("/").filter(Boolean).pop() ?? article.url;
      if (seen.has(slug)) {
        continue;
      }
      seen.add(slug);

      items.push({
        id: slug,
        title: article.headline,
        url: article.url,
        upload_date: uploadDate,
      });

      if (context.maxItems != null && context.maxItems > 0 && items.length >= context.maxItems) {
        return items;
      }
    }
  }

  items.sort((a, b) => (b.upload_date ?? "").localeCompare(a.upload_date ?? ""));
  return items;
}

export async function listSemianalysisArchives(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(
    /href="(https:\/\/semianalysis\.com\/(\d{4})\/(\d{2})\/(\d{2})\/[^"]+)"/g,
  )) {
    const url = match[1];
    const id = url.split("/").filter(Boolean).pop() ?? url;
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);

    items.push({
      id,
      title: id.replace(/-/g, " "),
      url,
      upload_date: `${match[2]}${match[3]}${match[4]}`,
    });
  }

  items.sort((a, b) => (b.upload_date ?? "").localeCompare(a.upload_date ?? ""));

  return filterListedItems(context, items, true);
}

export async function listStratecheryArchive(context: ListingContext): Promise<ContentListItem[]> {
  const year = context.dateRange?.since?.slice(0, 4) ?? new Date().getFullYear().toString();
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= 30; page += 1) {
    const pagePath = page === 1 ? `/${year}/` : `/${year}/page/${page}/`;
    const pageUrl = new URL(pagePath, "https://stratechery.com").href;
    let html: string;
    try {
      html = await fetchText(pageUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (page > 1 && message.includes("HTTP 404")) {
        break;
      }
      throw error;
    }
    let foundNew = 0;

    for (const match of html.matchAll(/href="(https:\/\/stratechery\.com\/\d{4}\/[^"?#]+)"/g)) {
      const articleUrl = match[1].replace(/\/$/, "");
      if (articleUrl.includes("/page/")) {
        continue;
      }

      const slug = articleUrl.split("/").filter(Boolean).pop() ?? articleUrl;
      if (seen.has(slug)) {
        continue;
      }
      seen.add(slug);

      items.push({
        id: slug,
        title: slug.replace(/-/g, " "),
        url: articleUrl,
      });
      foundNew += 1;
    }

    if (foundNew === 0) {
      break;
    }

    if (context.requestDelayMs > 0) {
      await sleep(context.requestDelayMs);
    }
  }

  items.sort((a, b) => (b.upload_date ?? "").localeCompare(a.upload_date ?? ""));

  return filterListedItems(context, items, true);
}

export async function listCollabfundAuthor(context: ListingContext): Promise<ContentListItem[]> {
  const html = await fetchText(context.sourceUrl);
  const items: ContentListItem[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(/href="(\/blog\/[^"?#]+)"[^>]*>([^<]+)</g)) {
    const path = match[1];
    if (path.includes("/authors/") || path === "/blog/") {
      continue;
    }

    const slug = path.replace(/\/$/, "").split("/").pop() ?? path;
    if (seen.has(slug)) {
      continue;
    }

    const title = match[2].trim();
    if (!title || title === "Read more" || title === "Collab Blog") {
      continue;
    }

    seen.add(slug);
    items.push({
      id: slug,
      title,
      url: new URL(path, "https://collabfund.com").href,
      upload_date: uploadDateFromUrlPath(path),
    });
  }

  return filterListedItems(context, items, true);
}

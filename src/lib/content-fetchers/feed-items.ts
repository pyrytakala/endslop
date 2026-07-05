import Parser from "rss-parser";

import { art19EpisodeUrl, itunesDurationToSeconds } from "./audio-transcribe.js";
import { rssPubDateToUploadDate, uploadDateFromUrlPath } from "./dates.js";
import type { ContentListItem } from "./types.js";

const parser = new Parser({
  customFields: {
    item: [["content:encoded", "contentEncoded"]],
  },
});

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function itemIdFromTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function itemIdFromUrl(url: string): string {
  if (!url.startsWith("http")) {
    return itemIdFromTitle(url);
  }
  const pathname = new URL(url).pathname;
  const slug = pathname.split("/").filter(Boolean).pop() ?? url;
  return slug.replace(/\.html$/i, "");
}

function feedItemsFromParsed(feed: Parser.Output<Record<string, unknown>>): ContentListItem[] {
  const items: ContentListItem[] = [];

  for (const entry of feed.items ?? []) {
    const title = entry.title?.trim();
    const enclosureUrl = (entry as { enclosure?: { url?: string } }).enclosure?.url;
    const link =
      entry.link?.trim() ||
      (typeof entry.guid === "string" ? entry.guid.trim() : "") ||
      enclosureUrl?.trim() ||
      "";
    if (!link || !title) {
      continue;
    }

    const encoded = (entry as { contentEncoded?: string }).contentEncoded;
    const bodySource = encoded ?? entry.content ?? null;
    const body = bodySource ? htmlToPlainText(bodySource) : null;
    const itunes = (entry as { itunes?: { episode?: string; duration?: string } }).itunes;
    const itunesEpisode = itunes?.episode;
    const audioUrl =
      enclosureUrl?.startsWith("http") && /\.(mp3|m4a)(\?|$)/i.test(enclosureUrl)
        ? enclosureUrl
        : undefined;
    const pageUrl =
      audioUrl && (!link.startsWith("http") || /\.(mp3|m4a)(\?|$)/i.test(link))
        ? (art19EpisodeUrl(audioUrl) ?? link)
        : link;

    items.push({
      id: itunesEpisode ?? itemIdFromUrl(pageUrl) ?? itemIdFromTitle(title),
      title,
      url: pageUrl,
      upload_date:
        rssPubDateToUploadDate(entry.pubDate ?? entry.isoDate) ?? uploadDateFromUrlPath(pageUrl),
      description: entry.contentSnippet ?? entry.content ?? null,
      body,
      duration_seconds: itunesDurationToSeconds(itunes?.duration),
      audioUrl,
    });
  }

  return items;
}

export async function listFeedItems(feedUrl: string): Promise<ContentListItem[]> {
  const feed = (await parser.parseURL(feedUrl)) as unknown as Parser.Output<Record<string, unknown>>;
  return feedItemsFromParsed(feed);
}

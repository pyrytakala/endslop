import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { pipelineLog, withPipelineTiming } from "../pipeline-log.js";
import { titleToFilename } from "../utils.js";
import type { VideoIndexEntry } from "../types.js";
import type { EssayListingKind } from "../sources-config.js";
import { countWords } from "../content-length.js";
import { extractArticleFromHtml, isArticleLongEnough } from "./article-extract.js";
import { parseFlexibleDate, uploadDateFromUrlPath, findPublicationDateInHtml } from "./dates.js";
import { fetchText } from "./http.js";
import {
  listAnthropicEngineering,
  listAsteriskIssues,
  listCollabfundAuthor,
  listFromFeed,
  listGwernIndex,
  listHamelIndex,
  listMachineTheoryJournal,
  listOpenAiBlog,
  listSemianalysisArchives,
  listStratecheryArchive,
  type ListingContext,
} from "./listings.js";
import type { ContentFetchContext, ContentFetcher, ContentListItem } from "./types.js";

async function resolveListing(context: ContentFetchContext): Promise<ContentListItem[]> {
  const listingContext: ListingContext = {
    sourceUrl: context.sourceUrl,
    dateRange: context.dateRange,
    requestDelayMs: context.requestDelayMs,
    maxItems: context.maxItems,
  };

  switch (context.listingKind) {
    case "gwern-index":
      return listGwernIndex(listingContext);
    case "anthropic-engineering":
      return listAnthropicEngineering(listingContext);
    case "openai-blog":
      return listOpenAiBlog(listingContext);
    case "hamel-index":
      return listHamelIndex(listingContext);
    case "machine-theory-journal":
      return listMachineTheoryJournal(listingContext);
    case "semianalysis-archives":
      return listSemianalysisArchives(listingContext);
    case "asterisk-issues":
      return listAsteriskIssues(listingContext);
    case "collabfund-author":
      return listCollabfundAuthor(listingContext);
    case "stratechery-archive":
      return listStratecheryArchive(listingContext);
    case "feed":
    default:
      if (!context.feedUrl) {
        throw new Error("RSS feed URL is required for feed listing");
      }
      return listFromFeed(listingContext, context.feedUrl, {
        urlIncludes: context.urlIncludes ?? undefined,
      });
  }
}

export const rssReadabilityFetcher: ContentFetcher = {
  kind: "rss-readability",

  async listItems(context: ContentFetchContext): Promise<ContentListItem[]> {
    const items = await withPipelineTiming(
      "essay-fetch",
      "list-catalog",
      {
        sourceId: context.sourceId,
        listingKind: context.listingKind ?? "feed",
        feedUrl: context.feedUrl ?? null,
      },
      () => resolveListing(context),
    );

    pipelineLog("essay-fetch", "list-complete", {
      sourceId: context.sourceId,
      count: items.length,
      dateRange: context.dateRange ?? null,
    });

    return items;
  },

  async fetchItem(
    item: ContentListItem,
    context: ContentFetchContext,
    usedNames: Set<string>,
  ): Promise<VideoIndexEntry> {
    const result: VideoIndexEntry = {
      id: item.id,
      title: item.title,
      url: item.url,
      upload_date: item.upload_date ?? null,
      channel: context.channelName ?? context.sourceTitle ?? context.sourceId,
      description: item.description ?? null,
    };

    try {
      let articleText: string | null = null;
      let articleTitle = item.title;
      let transcriptProvider = "readability";

      if (isArticleLongEnough(item.body)) {
        articleText = item.body!.trim();
        transcriptProvider = "rss-content";
      } else {
        const html = await withPipelineTiming(
          "essay-fetch",
          "fetch-essay",
          { sourceId: context.sourceId, essayId: item.id, url: item.url },
          () => fetchText(item.url),
        );

        const article = extractArticleFromHtml(html, item.url);
        if (!isArticleLongEnough(article?.text)) {
          throw new Error("article body too short or missing");
        }
        articleText = article!.text;
        articleTitle = article!.title || item.title;
        result.upload_date =
          item.upload_date ??
          findPublicationDateInHtml(html) ??
          uploadDateFromUrlPath(item.url) ??
          null;
      }

      const uploadDate = result.upload_date ?? item.upload_date ?? uploadDateFromUrlPath(item.url) ?? null;

      let filename = titleToFilename(articleTitle);
      if (usedNames.has(filename)) {
        filename = `${filename.replace(/\.txt$/, "")} [${item.id}].txt`;
      }
      usedNames.add(filename);

      const textPath = join(context.outputDir, filename);
      writeFileSync(textPath, articleText, "utf8");

      result.title = articleTitle;
      result.upload_date = uploadDate;
      result.transcript_status = "ok";
      result.transcript_provider = transcriptProvider;
      result.transcript_path = textPath;
      result.line_count = articleText.split(/\r?\n/).length;
      result.word_count = countWords(articleText);
      result.language_code = "en";
      result.available_langs = ["en"];
    } catch (error) {
      result.transcript_status = "failed";
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  },
};

export type { EssayListingKind };

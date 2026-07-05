import { join } from "node:path";

import { countWords } from "../content-length.js";
import { pipelineLog, withPipelineTiming } from "../pipeline-log.js";
import { titleToFilename } from "../utils.js";
import type { VideoIndexEntry } from "../types.js";
import { transcribeAudioUrl, writeTranscriptFile } from "./audio-transcribe.js";
import { listFromFeed } from "./listings.js";
import type { ContentFetchContext, ContentFetcher, ContentListItem } from "./types.js";

export const podcastRssAudioFetcher: ContentFetcher = {
  kind: "podcast-rss-audio",

  async listItems(context: ContentFetchContext): Promise<ContentListItem[]> {
    if (!context.feedUrl) {
      throw new Error("RSS feed URL is required for podcast audio listing");
    }

    const items = await withPipelineTiming(
      "podcast-fetch",
      "list-feed",
      { sourceId: context.sourceId, feedUrl: context.feedUrl },
      () =>
        listFromFeed(
          {
            sourceUrl: context.sourceUrl,
            dateRange: context.dateRange,
            requestDelayMs: context.requestDelayMs,
            maxItems: context.maxItems,
          },
          context.feedUrl!,
        ),
    );

    pipelineLog("podcast-fetch", "list-complete", {
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
      duration_seconds: item.duration_seconds ?? null,
    };

    try {
      if (!item.audioUrl) {
        throw new Error("missing podcast audio URL");
      }

      const transcriptText = await withPipelineTiming(
        "podcast-fetch",
        "transcribe-audio",
        { sourceId: context.sourceId, itemId: item.id, audioUrl: item.audioUrl },
        async () =>
          transcribeAudioUrl(item.audioUrl!, {
            sourceId: context.sourceId,
            itemId: item.id,
          }),
      );

      if (!transcriptText || countWords(transcriptText) < 50) {
        throw new Error("transcript too short or empty");
      }

      let filename = titleToFilename(item.title);
      if (usedNames.has(filename)) {
        filename = `${filename.replace(/\.txt$/, "")} [${item.id}].txt`;
      }
      usedNames.add(filename);

      const textPath = join(context.outputDir, filename);
      writeTranscriptFile(textPath, transcriptText);

      result.transcript_status = "ok";
      result.transcript_provider = "whisper";
      result.transcript_path = textPath;
      result.line_count = transcriptText.split(/\r?\n/).length;
      result.word_count = countWords(transcriptText);
      result.language_code = "en";
      result.available_langs = ["en"];
    } catch (error) {
      result.transcript_status = "failed";
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  },
};

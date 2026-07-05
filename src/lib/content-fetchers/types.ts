import type { DateRange, EssayListingKind } from "../sources-config.js";
import type { VideoIndexEntry } from "../types.js";

/** Listed item before text is downloaded. */
export interface ContentListItem {
  id: string;
  title: string;
  url: string;
  upload_date?: string | null;
  description?: string | null;
  body?: string | null;
  duration_seconds?: number | null;
  audioUrl?: string | null;
}

export interface ContentFetchContext {
  sourceId: string;
  sourceTitle?: string;
  sourceUrl: string;
  feedUrl?: string | null;
  listingKind?: EssayListingKind;
  channelName?: string;
  dateRange?: DateRange;
  outputDir: string;
  requestDelayMs: number;
  maxItems?: number | null;
  urlIncludes?: string;
  /** Slug/id → upload_date from a prior index (skips re-probing during listing). */
  knownUploadDates?: Record<string, string | null>;
}

export interface ContentFetcher {
  kind: string;
  listItems(context: ContentFetchContext): Promise<ContentListItem[]>;
  fetchItem(
    item: ContentListItem,
    context: ContentFetchContext,
    usedNames: Set<string>,
  ): Promise<VideoIndexEntry>;
}

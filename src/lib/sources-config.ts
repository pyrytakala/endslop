import { quarterlyPodcastSource, essaySource } from "./source-builders.js";

/**
 * Active sources shown on the site. For inclusion/exclusion notes, see source-registry.ts.
 */

export interface DateRange {
  since: string;
  until: string;
}

export type FetchKind = "youtube" | "essay";

export type EssayFetchAdapter = "paul-graham" | "rss-readability" | "podcast-rss-audio";

export type EssayListingKind =
  | "feed"
  | "gwern-index"
  | "anthropic-engineering"
  | "openai-blog"
  | "hamel-index"
  | "machine-theory-journal"
  | "semianalysis-archives"
  | "asterisk-issues"
  | "collabfund-author"
  | "stratechery-archive";

export interface SourceConfig {
  id: string;
  title: string;
  slug: string;
  channelUrl: string;
  fetchKind: FetchKind;
  fetchAdapter?: EssayFetchAdapter;
  essayFeedUrl?: string;
  essayListingKind?: EssayListingKind;
  essayChannelName?: string;
  essayMaxItems?: number;
  essayUrlIncludes?: string;
  contentKind: "conference" | "podcast" | "channel" | "essay";
  coverImage: string;
  itemLabel: string;
  pageTitle: string;
  dateRange?: DateRange;
  fetchWindow?: { days?: number; months?: number };
  maxVideos?: number;
  youtubeTitleIncludes?: string;
  maxDisplayAgeDays: number | null;
}

export const SOURCES: Record<string, SourceConfig> = {
  "ai-engineer-worlds-fair-2026": {
    id: "ai-engineer-worlds-fair-2026",
    title: "AI Engineer World's Fair 2026",
    slug: "ai-engineer-worlds-fair-2026",
    channelUrl: "https://www.youtube.com/@aiDotEngineer/videos",
    fetchKind: "youtube",
    contentKind: "conference",
    coverImage: "/images/covers/ai-engineer-worlds-fair-2026.jpg",
    itemLabel: "videos",
    pageTitle: "AI Engineer World's Fair 2026",
    fetchWindow: { days: 10 },
    maxDisplayAgeDays: 10,
  },
  "latent-space-pod-q2-2026": quarterlyPodcastSource({
    id: "latent-space-pod-q2-2026",
    name: "Latent Space Pod",
    channelHandle: "LatentSpacePod",
    coverImage: "/images/covers/latent-space-pod.png",
    year: 2026,
    quarter: 2,
  }),
  "no-priors-pod-q2-2026": quarterlyPodcastSource({
    id: "no-priors-pod-q2-2026",
    name: "No Priors Pod",
    channelHandle: "NoPriorsPodcast",
    coverImage: "/images/covers/no-priors-pod.png",
    year: 2026,
    quarter: 2,
  }),
  "twiml-ai-pod-q2-2026": quarterlyPodcastSource({
    id: "twiml-ai-pod-q2-2026",
    name: "The TWIML AI Podcast",
    channelHandle: "twimlai",
    coverImage: "/images/covers/twiml-ai-pod.png",
    year: 2026,
    quarter: 2,
  }),
  "cognitive-revolution-pod-q2-2026": quarterlyPodcastSource({
    id: "cognitive-revolution-pod-q2-2026",
    name: "The Cognitive Revolution Podcast",
    channelHandle: "CognitiveRevolutionPodcast",
    coverImage: "/images/covers/cognitive-revolution-pod.png",
    year: 2026,
    quarter: 2,
  }),
  "nvidia-q2-2026": quarterlyPodcastSource({
    id: "nvidia-q2-2026",
    name: "NVIDIA",
    channelHandle: "NVIDIA",
    coverImage: "/images/covers/nvidia.png",
    year: 2026,
    quarter: 2,
    contentKind: "channel",
  }),
  "a16z-q2-2026": quarterlyPodcastSource({
    id: "a16z-q2-2026",
    name: "a16z",
    channelHandle: "a16z",
    coverImage: "/images/covers/a16z.png",
    year: 2026,
    quarter: 2,
  }),
  "ml-street-talk-q2-2026": quarterlyPodcastSource({
    id: "ml-street-talk-q2-2026",
    name: "Machine Learning Street Talk",
    channelHandle: "MachineLearningStreetTalk",
    coverImage: "/images/covers/ml-street-talk.png",
    year: 2026,
    quarter: 2,
    halfYear: true,
  }),
  "huberman-lab-h1-2026": quarterlyPodcastSource({
    id: "huberman-lab-h1-2026",
    name: "Huberman Lab",
    channelHandle: "HubermanLab",
    coverImage: "/images/covers/huberman-lab.png",
    year: 2026,
    quarter: 2,
    halfYear: true,
  }),
  "paul-graham-essays-2020s": essaySource({
    id: "paul-graham-essays-2020s",
    name: "Paul Graham Essays",
    catalogUrl: "https://paulgraham.com/articles.html",
    coverImage: "/images/covers/paul-graham.png",
    dateRange: { since: "20200101", until: "20291231" },
    fetchAdapter: "paul-graham",
    channelName: "Paul Graham",
  }),
  "swyx-io-2026": essaySource({
    id: "swyx-io-2026",
    name: "swyx.io",
    catalogUrl: "https://swyx.io/rss.xml",
    feedUrl: "https://swyx.io/rss.xml",
    coverImage: "/images/covers/swyx-io.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "swyx.io",
  }),
  "gwern-blog-2025-2026": essaySource({
    id: "gwern-blog-2025-2026",
    name: "Gwern.net Blog",
    catalogUrl: "https://gwern.net/blog/index",
    coverImage: "/images/covers/gwern.png",
    dateRange: { since: "20250101", until: "20261231" },
    listingKind: "gwern-index",
    channelName: "Gwern",
  }),
  "simon-willison-h1-2026": essaySource({
    id: "simon-willison-h1-2026",
    name: "Simon Willison",
    catalogUrl: "https://simonwillison.net/atom/everything/",
    feedUrl: "https://simonwillison.net/atom/everything/",
    coverImage: "/images/covers/simon-willison.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "Simon Willison",
  }),
  "anthropic-engineering-h1-2026": essaySource({
    id: "anthropic-engineering-h1-2026",
    name: "Anthropic Engineering",
    catalogUrl: "https://www.anthropic.com/engineering",
    coverImage: "/images/covers/anthropic-engineering.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "anthropic-engineering",
    channelName: "Anthropic Engineering",
  }),
  "openai-developer-blog-h1-2026": essaySource({
    id: "openai-developer-blog-h1-2026",
    name: "OpenAI Developer Blog",
    catalogUrl: "https://developers.openai.com/blog",
    coverImage: "/images/covers/openai-developer-blog.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "openai-blog",
    channelName: "OpenAI Developer Blog",
  }),
  "stratechery-h1-2026": essaySource({
    id: "stratechery-h1-2026",
    name: "Stratechery",
    catalogUrl: "https://stratechery.com/2026/",
    coverImage: "/images/covers/stratechery.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "stratechery-archive",
    channelName: "Stratechery",
  }),
  "import-ai-h1-2026": essaySource({
    id: "import-ai-h1-2026",
    name: "Import AI",
    catalogUrl: "https://importai.substack.com/feed",
    feedUrl: "https://importai.substack.com/feed",
    coverImage: "/images/covers/import-ai.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "Import AI",
  }),
  "hamel-dev-h1-2026": essaySource({
    id: "hamel-dev-h1-2026",
    name: "Hamel Husain",
    catalogUrl: "https://hamel.dev/",
    coverImage: "/images/covers/hamel-dev.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "hamel-index",
    channelName: "Hamel Husain",
  }),
  "semianalysis-q2-2026": essaySource({
    id: "semianalysis-q2-2026",
    name: "SemiAnalysis",
    catalogUrl: "https://newsletter.semianalysis.com/",
    feedUrl: "https://newsletter.semianalysis.com/feed",
    coverImage: "/images/covers/semianalysis.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "SemiAnalysis",
  }),
  "bens-bites-q2-2026": essaySource({
    id: "bens-bites-q2-2026",
    name: "Ben's Bites",
    catalogUrl: "https://www.bensbites.com/feed",
    feedUrl: "https://www.bensbites.com/feed",
    coverImage: "/images/covers/bens-bites.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "Ben's Bites",
  }),
  "pragmatic-engineer-2026": essaySource({
    id: "pragmatic-engineer-2026",
    name: "The Pragmatic Engineer",
    catalogUrl: "https://blog.pragmaticengineer.com/rss/",
    feedUrl: "https://blog.pragmaticengineer.com/rss/",
    coverImage: "/images/covers/pragmatic-engineer.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "The Pragmatic Engineer",
  }),
  "construction-physics-q2-2026": essaySource({
    id: "construction-physics-q2-2026",
    name: "Construction Physics",
    catalogUrl: "https://www.construction-physics.com/feed",
    feedUrl: "https://www.construction-physics.com/feed",
    coverImage: "/images/covers/construction-physics.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "Construction Physics",
  }),
  "asterisk-issue-14-latest": essaySource({
    id: "asterisk-issue-14-latest",
    name: "Asterisk",
    catalogUrl: "https://asteriskmag.com/issues",
    coverImage: "/images/covers/asterisk.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "asterisk-issues",
    channelName: "Asterisk",
  }),
  "odd-lots-q2-2026": quarterlyPodcastSource({
    id: "odd-lots-q2-2026",
    name: "Odd Lots",
    channelUrl:
      "https://www.youtube.com/playlist?list=PLe4PRejZgr0MuA6M0zkZyy-99-qc87wKV",
    coverImage: "/images/covers/odd-lots.png",
    year: 2026,
    quarter: 2,
  }),
  "yc-startup-pod-q2-2026": quarterlyPodcastSource({
    id: "yc-startup-pod-q2-2026",
    name: "YC Startup Podcast",
    channelHandle: "YCombinator",
    coverImage: "/images/covers/y-combinator.png",
    year: 2026,
    quarter: 2,
  }),
  "my-first-million-q2-2026": quarterlyPodcastSource({
    id: "my-first-million-q2-2026",
    name: "My First Million",
    channelHandle: "MyFirstMillionPod",
    coverImage: "/images/covers/my-first-million.png",
    year: 2026,
    quarter: 2,
  }),
  "pmf-show-q2-2026": quarterlyPodcastSource({
    id: "pmf-show-q2-2026",
    name: "The PMF Show",
    channelHandle: "pmfshow",
    coverImage: "/images/covers/pmf-show.png",
    year: 2026,
    quarter: 2,
  }),
  "how-i-built-this-q2-2026": essaySource({
    id: "how-i-built-this-q2-2026",
    name: "How I Built This",
    catalogUrl: "https://rss.art19.com/how-i-built-this",
    feedUrl: "https://rss.art19.com/how-i-built-this",
    coverImage: "/images/covers/how-i-built-this.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "How I Built This",
    fetchAdapter: "podcast-rss-audio",
    contentKind: "podcast",
    itemLabel: "episodes",
  }),
  "lennys-podcast-q2-2026": quarterlyPodcastSource({
    id: "lennys-podcast-q2-2026",
    name: "Lenny's Podcast",
    channelHandle: "LennysPodcast",
    coverImage: "/images/covers/lennys-podcast.png",
    year: 2026,
    quarter: 2,
  }),
  "founders-podcast-q2-2026": quarterlyPodcastSource({
    id: "founders-podcast-q2-2026",
    name: "Founders Podcast",
    channelHandle: "founderspodcast1",
    coverImage: "/images/covers/founders-podcast.png",
    year: 2026,
    quarter: 2,
  }),
  "peter-attia-q2-2026": quarterlyPodcastSource({
    id: "peter-attia-q2-2026",
    name: "Peter Attia MD",
    channelHandle: "PeterAttiaMD",
    coverImage: "/images/covers/peter-attia.png",
    year: 2026,
    quarter: 2,
  }),
  "modern-wisdom-q2-2026": quarterlyPodcastSource({
    id: "modern-wisdom-q2-2026",
    name: "Modern Wisdom",
    channelUrl: "https://www.youtube.com/channel/UCIaH-gZIVC432YRjNVvnyCA/videos",
    coverImage: "/images/covers/modern-wisdom.png",
    year: 2026,
    quarter: 2,
  }),
  "greg-isenberg-q2-2026": quarterlyPodcastSource({
    id: "greg-isenberg-q2-2026",
    name: "Greg Isenberg",
    channelHandle: "GregIsenberg",
    coverImage: "/images/covers/greg-isenberg.png",
    year: 2026,
    quarter: 2,
    contentKind: "channel",
  }),
  "iltb-podcast-q2-2026": quarterlyPodcastSource({
    id: "iltb-podcast-q2-2026",
    name: "Invest Like the Best",
    channelHandle: "ILTB_Podcast",
    coverImage: "/images/covers/iltb-podcast.png",
    year: 2026,
    quarter: 2,
  }),
  "cal-newport-2026": quarterlyPodcastSource({
    id: "cal-newport-2026",
    name: "Deep Questions with Cal Newport",
    channelUrl: "https://www.youtube.com/channel/UCIhJnsJ0IHlVNnYfp-gw_5Q/videos",
    coverImage: "/images/covers/cal-newport.png",
    year: 2026,
    quarter: 2,
  }),
  "kenji-lopez-alt-2026": quarterlyPodcastSource({
    id: "kenji-lopez-alt-2026",
    name: "J. Kenji López-Alt",
    channelUrl: "https://www.youtube.com/channel/UCqqJQ_cXSat0KIAVfIfKkVA/videos",
    coverImage: "/images/covers/kenji-lopez-alt.png",
    year: 2026,
    quarter: 2,
    contentKind: "channel",
  }),
  "morgan-housel-2026": essaySource({
    id: "morgan-housel-2026",
    name: "Morgan Housel",
    catalogUrl: "https://collabfund.com/blog/authors/morgan/",
    coverImage: "/images/covers/morgan-housel.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "collabfund-author",
    channelName: "Morgan Housel",
  }),
  "ramit-sethi-2026": quarterlyPodcastSource({
    id: "ramit-sethi-2026",
    name: "I Will Teach You To Be Rich",
    channelUrl: "https://www.youtube.com/channel/UC7ZddA__ewP3AtDefjl_tWg/videos",
    coverImage: "/images/covers/ramit-sethi.png",
    year: 2026,
    quarter: 2,
  }),
  "ten-percent-happier-2026": quarterlyPodcastSource({
    id: "ten-percent-happier-2026",
    name: "Ten Percent Happier",
    channelUrl: "https://www.youtube.com/channel/UCb3AWCFuxotrXmgqUHQdwyg/videos",
    coverImage: "/images/covers/ten-percent-happier.png",
    year: 2026,
    quarter: 2,
  }),
  "happiness-lab-2026": quarterlyPodcastSource({
    id: "happiness-lab-2026",
    name: "The Happiness Lab",
    channelUrl: "https://www.youtube.com/channel/UCFfUSTVKFCfXl6PVyG08zxg/videos",
    coverImage: "/images/covers/happiness-lab.png",
    year: 2026,
    quarter: 2,
  }),
  "good-inside-2026": quarterlyPodcastSource({
    id: "good-inside-2026",
    name: "Good Inside",
    channelUrl: "https://www.youtube.com/channel/UCQcifo_12x84Uji6h1TVmKg/videos",
    coverImage: "/images/covers/good-inside.png",
    year: 2026,
    quarter: 2,
  }),
  "raising-good-humans-2026": quarterlyPodcastSource({
    id: "raising-good-humans-2026",
    name: "Raising Good Humans",
    channelUrl: "https://www.youtube.com/channel/UCnvXghklCyl2wAmv450OLDg/videos",
    coverImage: "/images/covers/raising-good-humans.png",
    year: 2026,
    quarter: 2,
  }),
  "emily-oster-2026": essaySource({
    id: "emily-oster-2026",
    name: "ParentData",
    catalogUrl: "https://parentdata.org/feed/",
    feedUrl: "https://parentdata.org/feed/",
    coverImage: "/images/covers/emily-oster.png",
    dateRange: { since: "20260101", until: "20261231" },
    listingKind: "feed",
    channelName: "ParentData",
    contentKind: "podcast",
    itemLabel: "episodes",
  }),
  "barbell-medicine-2026": quarterlyPodcastSource({
    id: "barbell-medicine-2026",
    name: "Barbell Medicine",
    channelUrl: "https://www.youtube.com/channel/UCMcGFPjX2aQy31KYdEvT2-Q/videos",
    coverImage: "/images/covers/barbell-medicine.png",
    year: 2026,
    quarter: 2,
  }),
  "david-burns-2026": quarterlyPodcastSource({
    id: "david-burns-2026",
    name: "Feeling Great",
    channelUrl: "https://www.youtube.com/channel/UCX9nw7Y0FJcDb-QfYWSjwIQ/videos",
    coverImage: "/images/covers/david-burns.png",
    year: 2026,
    quarter: 2,
  }),
  "tim-ferriss-2026": quarterlyPodcastSource({
    id: "tim-ferriss-2026",
    name: "The Tim Ferriss Show",
    channelUrl: "https://www.youtube.com/channel/UCznv7Vf9nBdJYvBagFdAHWw/videos",
    coverImage: "/images/covers/tim-ferriss.png",
    year: 2026,
    quarter: 2,
  }),
  "ali-abdaal-2026": quarterlyPodcastSource({
    id: "ali-abdaal-2026",
    name: "Ali Abdaal",
    channelUrl: "https://www.youtube.com/channel/UCoOae5nYA7VqaXzerajD0lg/videos",
    coverImage: "/images/covers/ali-abdaal.png",
    year: 2026,
    quarter: 2,
    contentKind: "channel",
  }),
};

export const DEFAULT_SOURCE_ID = "ai-engineer-worlds-fair-2026";

export function getSource(sourceId?: string | null): SourceConfig {
  const id = sourceId?.trim() || DEFAULT_SOURCE_ID;
  const source = SOURCES[id];
  if (!source) {
    const available = Object.keys(SOURCES).join(", ");
    throw new Error(`Unknown source "${id}". Available: ${available}`);
  }
  return source;
}

export function listSources(): SourceConfig[] {
  return Object.values(SOURCES);
}

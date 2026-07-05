/**
 * Dev-only catalog of which content sources are included or deliberately excluded.
 * Not surfaced in the UI — update this when adding or declining a source.
 *
 * Runtime config lives in `sources-config.ts`; this file is the decision log.
 */

export type IncludedSourceEntry = {
  status: "included";
  id: string;
  note?: string;
};

export type ExcludedSourceEntry = {
  status: "excluded";
  id: string;
  label: string;
  reason: string;
  channelHandle?: string;
};

export type SourceRegistryEntry = IncludedSourceEntry | ExcludedSourceEntry;

/** Inclusion/exclusion decisions for AI starred sources. */
export const SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    status: "included",
    id: "ai-engineer-worlds-fair-2026",
    note: "Conference; 10-day display window after upload.",
  },
  {
    status: "included",
    id: "latent-space-pod-q2-2026",
  },
  {
    status: "included",
    id: "no-priors-pod-q2-2026",
  },
  {
    status: "included",
    id: "twiml-ai-pod-q2-2026",
  },
  {
    status: "included",
    id: "cognitive-revolution-pod-q2-2026",
  },
  {
    status: "included",
    id: "nvidia-q2-2026",
    note: "YouTube channel; scored with talk prompt.",
  },
  {
    status: "included",
    id: "a16z-q2-2026",
  },
  {
    status: "included",
    id: "ml-street-talk-q2-2026",
    note: "H1 2026 (Q2 had <10 episodes).",
  },
  {
    status: "included",
    id: "paul-graham-essays-2020s",
    note: "Essay fetch via paulgraham.com HTML extractor.",
  },
  {
    status: "included",
    id: "huberman-lab-h1-2026",
    note: "H1 2026 (~49 episodes; Q2 alone had 26).",
  },
  { status: "included", id: "swyx-io-2026", note: "Blog via RSS + Readability." },
  { status: "included", id: "gwern-blog-2025-2026", note: "Gwern blog index parser." },
  { status: "included", id: "simon-willison-h1-2026" },
  { status: "included", id: "anthropic-engineering-h1-2026" },
  { status: "included", id: "openai-developer-blog-h1-2026" },
  { status: "included", id: "stratechery-h1-2026" },
  { status: "included", id: "import-ai-h1-2026" },
  { status: "included", id: "hamel-dev-h1-2026" },
  {
    status: "excluded",
    id: "machine-theory-journal-h1-2026",
    label: "Machine Theory Journal",
    reason: "2026 journal entries are short tweets/posts; none meet the 750-word minimum.",
  },
  { status: "included", id: "semianalysis-q2-2026", note: "Archives scraper; paywalled posts may be missing." },
  { status: "included", id: "bens-bites-q2-2026" },
  { status: "included", id: "pragmatic-engineer-2026" },
  { status: "included", id: "construction-physics-q2-2026" },
  { status: "included", id: "asterisk-issue-14-latest", note: "2026 issues via issue-page JSON-LD (hasPart articles)." },
  { status: "included", id: "odd-lots-q2-2026", note: "YouTube playlist." },
  { status: "included", id: "yc-startup-pod-q2-2026" },
  { status: "included", id: "my-first-million-q2-2026" },
  { status: "included", id: "pmf-show-q2-2026" },
  { status: "included", id: "how-i-built-this-q2-2026", note: "Podcast RSS audio transcribed via Whisper." },
  { status: "included", id: "lennys-podcast-q2-2026" },
  {
    status: "excluded",
    id: "nateliason-q2-2026",
    label: "Nat Eliason",
    reason: "2026 RSS only has short book announcements; no full essays. YouTube inactive since 2023.",
  },
  { status: "included", id: "founders-podcast-q2-2026" },
  { status: "included", id: "peter-attia-q2-2026" },
  { status: "included", id: "modern-wisdom-q2-2026", note: "Chris Williamson channel (by ID)." },
  { status: "included", id: "greg-isenberg-q2-2026" },
  { status: "included", id: "iltb-podcast-q2-2026" },
  { status: "included", id: "cal-newport-2026", note: "Deep Questions — attention, deep work, digital minimalism." },
  { status: "included", id: "kenji-lopez-alt-2026", note: "Food science / first-principles cooking on YouTube." },
  { status: "included", id: "morgan-housel-2026", note: "Collab Fund essays by Morgan Housel only." },
  { status: "included", id: "ramit-sethi-2026", note: "Personal finance systems and money psychology." },
  { status: "included", id: "ten-percent-happier-2026", note: "Meditation and emotional skills for skeptics." },
  { status: "included", id: "happiness-lab-2026", note: "Yale wellbeing science with Laurie Santos." },
  { status: "included", id: "good-inside-2026", note: "Dr. Becky Kennedy — parenting and emotional regulation." },
  { status: "included", id: "raising-good-humans-2026", note: "Dr. Aliza Pressman — evidence-based parenting." },
  { status: "included", id: "emily-oster-2026", note: "ParentData newsletter/podcast via parentdata.org RSS." },
  { status: "included", id: "barbell-medicine-2026", note: "Evidence-based strength training and pain/health." },
  { status: "included", id: "david-burns-2026", note: "David Burns CBT / Feeling Great live therapy sessions." },
  { status: "included", id: "tim-ferriss-2026", note: "Long-form interviews; quality varies by guest." },
  { status: "included", id: "ali-abdaal-2026", note: "Productivity, learning, and creator/builder content." },
  {
    status: "excluded",
    id: "esther-perel-where-should-we-begin",
    label: "Where Should We Begin? (Esther Perel)",
    reason: "Relationship therapy format; lower practical utility for the site's SV tech/entrepreneur audience.",
  },
  {
    status: "excluded",
    id: "gottman-small-things-often",
    label: "Small Things Often (Gottman Institute)",
    reason: "Short-form episodes unlikely to meet the 750-word minimum; relationship niche.",
  },
  {
    status: "excluded",
    id: "relationship-alive-terry-real",
    label: "Relationship Alive (Terry Real / Neil Sattin)",
    reason: "Relationship/interview niche; lower fit vs. parenting and CBT sources already added.",
  },
  {
    status: "excluded",
    id: "bogleheads",
    label: "Bogleheads wiki",
    reason: "Reference wiki/forum, not a scorable content stream.",
  },
  {
    status: "excluded",
    id: "matthew-walker-sleep",
    label: "Matthew Walker",
    reason: "Sleep coverage already available via Peter Attia and Huberman Lab on the site.",
  },
  {
    status: "excluded",
    id: "lex-fridman-pod",
    label: "Lex Fridman Podcast",
    channelHandle: "lexfridman",
    reason:
      "Will not add — most episodes exceed the 3h scoring limit (see scoring-limits.ts).",
  },
];

export function listIncludedSourceIds(): string[] {
  return SOURCE_REGISTRY.filter((entry) => entry.status === "included").map(
    (entry) => entry.id,
  );
}

export function listExcludedSources(): ExcludedSourceEntry[] {
  return SOURCE_REGISTRY.filter(
    (entry): entry is ExcludedSourceEntry => entry.status === "excluded",
  );
}

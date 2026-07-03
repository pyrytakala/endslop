import "./styles.css";
import type { RankedVideo, RankingsPayload, Tag } from "./types";
import { shouldDisplayVideo } from "./lib/source-filter.js";
import { parseUploadDate } from "./lib/video-age.js";
import { isScoredRanking, selectTopPicks } from "./lib/top-picks.js";
import { isTooLongForScoring } from "./lib/scoring-limits.js";
import { positiveDimensionTags } from "./lib/dimension-tags.js";

const SOURCE_ID = document.body.dataset.sourceId ?? "ai-engineer-worlds-fair-2026";
const ITEM_LABEL = document.body.dataset.itemLabel ?? "videos";
const DISPLAY_FILTER = {
  maxDisplayAgeDays: document.body.dataset.maxDisplayAgeDays
    ? Number(document.body.dataset.maxDisplayAgeDays)
    : null,
  dateRange:
    document.body.dataset.dateSince && document.body.dataset.dateUntil
      ? {
          since: document.body.dataset.dateSince,
          until: document.body.dataset.dateUntil,
        }
      : undefined,
};

const RANKINGS_URL = import.meta.env.DEV
  ? `/api/rankings/${SOURCE_ID}`
  : `${import.meta.env.BASE_URL}data/${SOURCE_ID}/rankings.json`;

function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function formatAbsoluteDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(uploadDate: string | null | undefined): string | null {
  const date = parseUploadDate(uploadDate);
  if (!date) {
    return null;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }

  const years = Math.floor(diffDays / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function formatScore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return (Number(value) / 10).toFixed(1);
}

const SCORE_COMPONENTS = [
  { key: "substance", label: "Substance", weight: 3 },
  { key: "evidence", label: "Evidence", weight: 2 },
  { key: "specificity", label: "Specificity", weight: 1.5 },
  { key: "insight_density", label: "Insight", weight: 2.5 },
  { key: "non_promotion", label: "Non-promo", weight: 1 },
] as const;

const SCORE_WEIGHT_TOTAL = SCORE_COMPONENTS.reduce((sum, component) => sum + component.weight, 0);

function shouldShowVideo(uploadDate: string | null | undefined): boolean {
  return shouldDisplayVideo(uploadDate, DISPLAY_FILTER);
}

function formatWeightPercent(weight: number): string {
  return `${Math.round((weight / SCORE_WEIGHT_TOTAL) * 100)}%`;
}

function formatWeightLabel(weight: number): string {
  return `× ${formatWeightPercent(weight)}`;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0 || Number.isNaN(seconds)) {
    return null;
  }

  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

let openScoreCard: HTMLElement | null = null;

function closeScoreBreakdown(): void {
  if (!openScoreCard) {
    return;
  }

  const scoreBtn = openScoreCard.querySelector<HTMLButtonElement>(".score");
  const breakdown = openScoreCard.querySelector<HTMLElement>(".score-breakdown");
  scoreBtn?.setAttribute("aria-expanded", "false");
  if (breakdown) {
    breakdown.hidden = true;
  }
  openScoreCard = null;
}

function toggleScoreBreakdown(
  card: HTMLElement,
  scoreBtn: HTMLButtonElement,
  breakdown: HTMLElement,
): void {
  if (openScoreCard && openScoreCard !== card) {
    closeScoreBreakdown();
  }

  const opening = breakdown.hidden;
  breakdown.hidden = !opening;
  scoreBtn.setAttribute("aria-expanded", opening ? "true" : "false");
  openScoreCard = opening ? card : null;
}

function renderScoreBreakdown(breakdown: HTMLElement, video: RankedVideo): void {
  breakdown.replaceChildren();

  const title = document.createElement("p");
  title.className = "score-breakdown-title";
  title.textContent = "Score breakdown";
  breakdown.appendChild(title);

  let subtotal = 0;
  for (const component of SCORE_COMPONENTS) {
    const value = video[component.key];
    const row = document.createElement("div");
    row.className = "score-breakdown-row";

    const label = document.createElement("span");
    label.className = "score-breakdown-label";
    label.textContent = component.label;

    const score = document.createElement("span");
    score.className = "score-breakdown-value";
    const weight = document.createElement("span");
    weight.className = "score-breakdown-weight";
    const product = document.createElement("span");
    product.className = "score-breakdown-product";

    if (value == null || Number.isNaN(value)) {
      score.textContent = "—";
      weight.textContent = formatWeightLabel(component.weight);
      product.textContent = "—";
    } else {
      const contribution = Number(value) * component.weight;
      subtotal += contribution;
      score.textContent = Number(value).toFixed(1);
      weight.textContent = formatWeightLabel(component.weight);
      product.textContent = `= ${formatScore(contribution)}`;
    }

    row.append(label, score, weight, product);
    breakdown.appendChild(row);
  }

  const base = video.composite_base ?? video.composite ?? subtotal;
  const total = document.createElement("div");
  total.className = "score-breakdown-total";
  total.innerHTML = `<span>Total</span><span>${formatScore(base)}</span>`;
  breakdown.appendChild(total);

  const likeAdjustment = video.like_adjustment;
  if (likeAdjustment != null && Math.abs(Number(likeAdjustment)) > 0.01) {
    const adjust = document.createElement("div");
    adjust.className = "score-breakdown-adjust";
    const formatted = formatScore(likeAdjustment);
    const sign = Number(likeAdjustment) > 0 ? "+" : "";
    adjust.innerHTML = `<span>Like adjustment</span><span>${sign}${formatted}</span>`;
    breakdown.appendChild(adjust);

    const finalRow = document.createElement("div");
    finalRow.className = "score-breakdown-total";
    finalRow.innerHTML = `<span>Final</span><span>${formatScore(video.composite)}</span>`;
    breakdown.appendChild(finalRow);
  }

  breakdown.hidden = true;
}

function setupScoreButton(
  card: HTMLElement,
  scoreBtn: HTMLButtonElement,
  breakdown: HTMLElement,
  video: RankedVideo,
): void {
  renderScoreBreakdown(breakdown, video);
  scoreBtn.textContent = formatScore(video.composite);
  scoreBtn.setAttribute("aria-label", `Score ${formatScore(video.composite)}. Show breakdown`);

  scoreBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleScoreBreakdown(card, scoreBtn, breakdown);
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (!target.closest(".score") && !target.closest(".score-breakdown")) {
    closeScoreBreakdown();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeScoreBreakdown();
  }
});

const LEGACY_TAG_LABELS: Record<string, string> = {
  "Strong substance": "substance",
  "Strong evidence": "evidence",
  "Strong specificity": "specificity",
  "Strong insight": "insight",
};

function tagDisplayLabel(label: string): string {
  return LEGACY_TAG_LABELS[label] ?? label;
}

function tagIconKind(label: string): string {
  const display = tagDisplayLabel(label);
  if (display === "Non-promo") {
    return "neutral";
  }
  return display;
}

const TAG_ICON_SVGS: Record<string, string> = {
  substance:
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  evidence: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  specificity:
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  insight:
    '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13.5 11H20a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 10.5 14z"/>',
  neutral:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
};

function createTagIcon(kind: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("tag-icon");
  svg.innerHTML = TAG_ICON_SVGS[kind] || TAG_ICON_SVGS.substance;
  return svg;
}

function positiveTags(video: RankedVideo): Tag[] {
  const tags = video.tags ?? positiveDimensionTags(video);
  return tags.filter((tag) => (tag.tone || "positive") === "positive");
}

function renderTags(container: HTMLElement, tags: Tag[]): void {
  container.replaceChildren();

  for (const tag of tags) {
    const kind = tagIconKind(tag.label);
    const el = document.createElement("span");
    el.className = "tag positive";
    el.appendChild(createTagIcon(kind));
    const label = document.createElement("span");
    label.className = "tag-label";
    label.textContent = tagDisplayLabel(tag.label);
    el.appendChild(label);
    container.appendChild(el);
  }

  container.hidden = container.childElementCount === 0;
}

function groupCardsByRow(cards: HTMLElement[]): HTMLElement[][] {
  const rows: HTMLElement[][] = [];
  for (const card of cards) {
    const top = card.offsetTop;
    const row = rows.find((group) => Math.abs(group[0].offsetTop - top) < 2);
    if (row) {
      row.push(card);
    } else {
      rows.push([card]);
    }
  }
  return rows;
}

function balanceCardRows(): void {
  for (const grid of document.querySelectorAll<HTMLElement>(".grid")) {
    const cards = [...grid.querySelectorAll<HTMLElement>(".card")];
    cards.forEach((card) => {
      card.style.height = "";
    });

    const collapsed = cards.filter((card) => !card.classList.contains("is-expanded"));
    const expandedTops = new Set(
      cards.filter((card) => card.classList.contains("is-expanded")).map((card) => card.offsetTop),
    );

    for (const row of groupCardsByRow(collapsed)) {
      if (expandedTops.has(row[0]?.offsetTop ?? -1)) {
        continue;
      }

      const tallest = Math.max(...row.map((card) => card.offsetHeight));
      for (const card of row) {
        card.style.height = `${tallest}px`;
      }
    }
  }

  refreshAllSummaryStates();
}

function refreshAllSummaryStates(): void {
  for (const wrap of document.querySelectorAll<HTMLElement>(".summary-wrap:not([hidden])")) {
    updateSummaryToggleState(wrap);
  }
}

let expandedVideoId: string | null = null;

function collapseExpandedCard(): void {
  if (!expandedVideoId) {
    return;
  }

  const card = document.querySelector<HTMLElement>(`.card[data-video-id="${expandedVideoId}"]`);
  if (card) {
    card.classList.remove("is-expanded");
    card.style.height = "";
    const wrap = card.querySelector<HTMLElement>(".summary-wrap");
    if (wrap) {
      updateSummaryToggleState(wrap);
    }
  }
  expandedVideoId = null;
  balanceCardRows();
}

function expandCard(card: HTMLElement, videoId: string): void {
  collapseExpandedCard();
  card.classList.add("is-expanded");
  card.style.height = "";
  expandedVideoId = videoId;
  const wrap = card.querySelector<HTMLElement>(".summary-wrap");
  if (wrap) {
    updateSummaryToggleState(wrap);
  }
  balanceCardRows();
}

function updateSummaryToggleState(wrap: HTMLElement): void {
  const card = wrap.closest<HTMLElement>(".card");
  if (!card) {
    return;
  }

  const panel = wrap.querySelector<HTMLElement>(".summary-panel");
  const moreBtn = wrap.querySelector<HTMLButtonElement>(".summary-more");
  const lessBtn = card.querySelector<HTMLButtonElement>(".summary-less");
  const expanded = card.classList.contains("is-expanded");

  if (!panel || !moreBtn || !lessBtn) {
    return;
  }

  if (expanded) {
    wrap.classList.add("has-overflow");
    moreBtn.hidden = true;
    lessBtn.hidden = false;
    return;
  }

  const needsToggle = panel.scrollHeight > panel.clientHeight + 1;
  wrap.classList.toggle("has-overflow", needsToggle);
  moreBtn.hidden = !needsToggle;
  lessBtn.hidden = true;
}

function setupSummaryInteractions(card: HTMLElement, wrap: HTMLElement, videoId: string): void {
  const panel = wrap.querySelector<HTMLElement>(".summary-panel");
  const moreBtn = wrap.querySelector<HTMLButtonElement>(".summary-more");
  const lessBtn = card.querySelector<HTMLButtonElement>(".summary-less");
  if (!panel || !moreBtn || !lessBtn) {
    return;
  }

  const expand = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    if (card.classList.contains("is-expanded")) {
      return;
    }
    expandCard(card, videoId);
  };

  const collapse = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    card.classList.remove("is-expanded");
    if (expandedVideoId === videoId) {
      expandedVideoId = null;
    }
    updateSummaryToggleState(wrap);
    balanceCardRows();
  };

  panel.addEventListener("click", expand);
  moreBtn.addEventListener("click", expand);
  lessBtn.addEventListener("click", collapse);
}

function renderSummary(wrap: HTMLElement, bullets: string[] | undefined): void {
  const list = wrap.querySelector<HTMLElement>(".summary");
  if (!list) {
    return;
  }
  list.replaceChildren();
  for (const bullet of bullets || []) {
    const item = document.createElement("li");
    item.textContent = bullet;
    list.appendChild(item);
  }
}

function populateExcludedCard(card: HTMLElement, video: RankedVideo): void {
  const duration = card.querySelector<HTMLElement>(".duration");
  const thumbLink = card.querySelector<HTMLAnchorElement>(".thumb-link");
  const thumb = card.querySelector<HTMLImageElement>(".thumb");
  const titleLink = card.querySelector<HTMLAnchorElement>(".title-link");
  const summaryWrap = card.querySelector<HTMLElement>(".summary-wrap");
  const published = card.querySelector<HTMLTimeElement>(".published");

  if (!thumbLink || !thumb || !duration || !titleLink || !published || !video.url) {
    return;
  }

  card.dataset.videoId = video.id;

  thumb.src = thumbnailUrl(video.id);
  thumb.alt = video.title;
  thumbLink.href = video.url;

  const durationLabel = formatDuration(video.duration_seconds);
  if (durationLabel) {
    duration.textContent = durationLabel;
    duration.hidden = false;
  } else {
    duration.textContent = "";
    duration.hidden = true;
  }

  titleLink.href = video.url;
  titleLink.title = video.title;
  titleLink.textContent = video.title;

  if (summaryWrap) {
    renderSummary(summaryWrap, video.summary_bullets);
    summaryWrap.hidden = !(video.summary_bullets || []).length;
    setupSummaryInteractions(card, summaryWrap, video.id);
  }

  const uploadDate = parseUploadDate(video.upload_date);
  if (uploadDate) {
    published.hidden = false;
    published.dateTime = video.upload_date ?? "";
    published.title = formatAbsoluteDate(uploadDate);
    published.textContent = formatRelativeDate(video.upload_date);
  } else {
    published.hidden = true;
  }
}

function excludedTalks(payload: RankingsPayload): {
  tooLong: RankedVideo[];
  other: RankedVideo[];
} {
  const inRange = (videos: RankedVideo[]) =>
    videos.filter((video) => shouldShowVideo(video.upload_date));

  if (payload.too_long != null || payload.other != null) {
    return {
      tooLong: inRange(payload.too_long ?? []),
      other: inRange(payload.other ?? []),
    };
  }

  const visible = inRange(payload.rankings || []);
  const picks = new Set(visiblePicks(payload).map((video) => video.id));
  const scored = visible.filter(isScoredRanking);
  const tooLong = visible.filter((video) => isTooLongForScoring(video.duration_seconds));

  return {
    tooLong,
    other: scored.filter((video) => !picks.has(video.id)),
  };
}

function renderExcludedSection(
  container: HTMLElement,
  heading: string,
  videos: RankedVideo[],
  template: HTMLTemplateElement,
  description?: string,
): void {
  if (videos.length === 0) {
    return;
  }

  const section = document.createElement("section");
  section.className = "content-section";

  const title = document.createElement("h2");
  title.className = "section-heading";
  title.textContent = heading;
  section.appendChild(title);

  if (description) {
    const lede = document.createElement("p");
    lede.className = "section-lede";
    lede.textContent = description;
    section.appendChild(lede);
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-excluded";

  for (const video of videos) {
    const node = template.content.cloneNode(true) as DocumentFragment;
    const card = node.querySelector<HTMLElement>(".card");
    if (!card) {
      continue;
    }
    populateExcludedCard(card, video);
    grid.appendChild(node);
  }

  section.appendChild(grid);
  container.appendChild(section);

  requestAnimationFrame(() => {
    requestAnimationFrame(balanceCardRows);
  });

  for (const img of grid.querySelectorAll<HTMLImageElement>(".thumb")) {
    if (!img.complete) {
      img.addEventListener("load", balanceCardRows, { once: true });
    }
  }
}

function renderExcludedSections(payload: RankingsPayload): void {
  const container = document.getElementById("extra-sections");
  const template = document.getElementById("excluded-card-template") as HTMLTemplateElement | null;
  if (!container || !template) {
    return;
  }

  container.replaceChildren();

  const { tooLong, other } = excludedTalks(payload);

  renderExcludedSection(
    container,
    "Very long talks",
    tooLong,
    template,
    "These talks are very long and have not been scored.",
  );
  renderExcludedSection(
    container,
    "Other talks",
    other,
    template,
    "These talks are part of the same group and can be strong too—they just didn't make the top picks this time.",
  );
}

function populateCard(
  card: HTMLElement,
  video: RankedVideo,
  options: {
    rank?: number;
  },
): void {
  const rank = card.querySelector<HTMLElement>(".rank");
  const duration = card.querySelector<HTMLElement>(".duration");
  const thumbLink = card.querySelector<HTMLAnchorElement>(".thumb-link");
  const thumb = card.querySelector<HTMLImageElement>(".thumb");
  const thumbTags = card.querySelector<HTMLElement>(".thumb-tags");
  const titleLink = card.querySelector<HTMLAnchorElement>(".title-link");
  const summaryWrap = card.querySelector<HTMLElement>(".summary-wrap");
  const published = card.querySelector<HTMLTimeElement>(".published");
  const score = card.querySelector<HTMLButtonElement>(".score");
  const scoreBreakdown = card.querySelector<HTMLElement>(".score-breakdown");

  if (
    !rank ||
    !thumbLink ||
    !thumb ||
    !duration ||
    !thumbTags ||
    !titleLink ||
    !summaryWrap ||
    !published ||
    !score ||
    !scoreBreakdown ||
    !video.url
  ) {
    return;
  }

  card.dataset.videoId = video.id;
  rank.textContent = `#${options.rank ?? video.rank}`;
  renderTags(thumbTags, positiveTags(video));
  setupScoreButton(card, score, scoreBreakdown, video);

  thumb.src = thumbnailUrl(video.id);
  thumb.alt = video.title;
  thumbLink.href = video.url;

  const durationLabel = formatDuration(video.duration_seconds);
  if (durationLabel) {
    duration.textContent = durationLabel;
    duration.hidden = false;
  } else {
    duration.textContent = "";
    duration.hidden = true;
  }

  titleLink.href = video.url;
  titleLink.title = video.title;
  titleLink.textContent = video.title;

  renderSummary(summaryWrap, video.summary_bullets);
  summaryWrap.hidden = !(video.summary_bullets || []).length;
  setupSummaryInteractions(card, summaryWrap, video.id);

  const uploadDate = parseUploadDate(video.upload_date);
  if (uploadDate) {
    published.hidden = false;
    published.dateTime = video.upload_date ?? "";
    published.title = formatAbsoluteDate(uploadDate);
    published.textContent = formatRelativeDate(video.upload_date);
  } else {
    published.hidden = true;
  }
}

async function loadRankings(): Promise<RankingsPayload> {
  const response = await fetch(RANKINGS_URL);
  if (!response.ok) {
    throw new Error(`Failed to load rankings (${response.status})`);
  }
  return response.json() as Promise<RankingsPayload>;
}

function visiblePicks(payload: RankingsPayload): RankedVideo[] {
  const inRange = (payload.rankings || []).filter((video) =>
    shouldShowVideo(video.upload_date),
  );
  const picks = inRange.filter(isScoredRanking);
  if (picks.length > 0) {
    return picks;
  }
  return selectTopPicks(inRange);
}

function renderMeta(payload: RankingsPayload): void {
  const meta = document.getElementById("meta");
  if (!meta) {
    return;
  }

  const picks = visiblePicks(payload);
  const scoredCount = payload.scored_count ?? picks.length;

  if (scoredCount > picks.length) {
    meta.textContent = `${picks.length} top ${ITEM_LABEL} (from ${scoredCount} scored)`;
  } else {
    meta.textContent = `${picks.length} top ${ITEM_LABEL}`;
  }
}

function renderCards(payload: RankingsPayload): void {
  const grid = document.getElementById("grid");
  const template = document.getElementById("card-template") as HTMLTemplateElement | null;
  if (!grid || !template) {
    return;
  }

  grid.replaceChildren();

  const picks = visiblePicks(payload);

  picks.forEach((video, index) => {
    const node = template.content.cloneNode(true) as DocumentFragment;
    const card = node.querySelector<HTMLElement>(".card");
    if (!card) {
      return;
    }

    populateCard(card, video, { rank: index + 1 });
    grid.appendChild(node);
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(balanceCardRows);
  });

  for (const img of grid.querySelectorAll<HTMLImageElement>(".thumb")) {
    if (!img.complete) {
      img.addEventListener("load", balanceCardRows, { once: true });
    }
  }
}

function renderError(message: string): void {
  const grid = document.getElementById("grid");
  if (!grid) {
    return;
  }
  grid.replaceChildren();
  const error = document.createElement("div");
  error.className = "error";
  error.textContent = message;
  grid.appendChild(error);
}

loadRankings()
  .then((payload) => {
    renderMeta(payload);
    renderCards(payload);
    renderExcludedSections(payload);
  })
  .catch((error: Error) => {
    const meta = document.getElementById("meta");
    if (meta) {
      meta.textContent = "Could not load rankings";
    }
    renderError(error.message);
  });

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(balanceCardRows, 100);
});

import "./styles.css";
import type { RankedVideo, RankingsPayload, Tag } from "./types";

const RANKINGS_URL = import.meta.env.DEV
  ? "/api/rankings"
  : `${import.meta.env.BASE_URL}data/rankings.json`;

function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function parseUploadDate(uploadDate: string | null | undefined): Date | null {
  if (!uploadDate || String(uploadDate).length !== 8) {
    return null;
  }

  const value = String(uploadDate);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const date = new Date(year, month, day);

  return Number.isNaN(date.getTime()) ? null : date;
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

function formatWeightPercent(weight: number): string {
  return `${Math.round((weight / SCORE_WEIGHT_TOTAL) * 100)}%`;
}

function formatWeightLabel(weight: number): string {
  return `× ${formatWeightPercent(weight)}`;
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
      product.textContent = `= ${contribution.toFixed(1)}`;
    }

    row.append(label, score, weight, product);
    breakdown.appendChild(row);
  }

  const base = video.composite_base ?? video.composite ?? subtotal;
  const total = document.createElement("div");
  total.className = "score-breakdown-total";
  total.innerHTML = `<span>Total</span><span>${Number(base).toFixed(1)} / 100</span>`;
  breakdown.appendChild(total);

  const likeAdjustment = video.like_adjustment;
  if (likeAdjustment != null && Math.abs(Number(likeAdjustment)) > 0.01) {
    const adjust = document.createElement("div");
    adjust.className = "score-breakdown-adjust";
    const sign = Number(likeAdjustment) > 0 ? "+" : "";
    adjust.innerHTML = `<span>Like adjustment</span><span>${sign}${Number(likeAdjustment).toFixed(1)}</span>`;
    breakdown.appendChild(adjust);

    const finalRow = document.createElement("div");
    finalRow.className = "score-breakdown-total";
    finalRow.innerHTML = `<span>Final</span><span>${formatScore(video.composite)}</span>`;
    breakdown.appendChild(finalRow);
  }

  if (video.tags?.length) {
    const tagsSection = document.createElement("div");
    tagsSection.className = "score-breakdown-tags";

    const tagsEl = document.createElement("div");
    tagsEl.className = "tags";
    renderTags(tagsEl, video.tags);
    tagsSection.appendChild(tagsEl);
    breakdown.appendChild(tagsSection);
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

const TAG_ICON_KINDS: Record<string, string> = {
  "Very strong substance": "substance",
  "Strong evidence": "evidence",
  "Very specific": "specificity",
  "High insight density": "insight",
  "Not promotional": "neutral",
  "Weak substance": "weak",
  "Weak evidence": "weak",
  "Hand-wavy": "vague",
  "Low insight density": "sparse",
  "High promo": "promo",
};

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
  weak: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
  vague:
    '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  sparse: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  promo:
    '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
};

function createTagIcon(kind: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("tag-icon");
  svg.innerHTML = TAG_ICON_SVGS[kind] || TAG_ICON_SVGS.substance;
  return svg;
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
  const cards = [...document.querySelectorAll<HTMLElement>(".card")];
  cards.forEach((card) => {
    card.style.height = "";
    card.classList.remove("is-measuring");
  });

  const collapsed = cards.filter((card) => !card.classList.contains("is-expanded"));
  collapsed.forEach((card) => card.classList.add("is-measuring"));

  for (const row of groupCardsByRow(collapsed)) {
    const tallest = Math.max(...row.map((card) => card.offsetHeight));
    for (const card of row) {
      card.style.height = `${tallest}px`;
    }
  }

  collapsed.forEach((card) => card.classList.remove("is-measuring"));
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

function renderTags(container: HTMLElement, tags: Tag[]): void {
  container.replaceChildren();
  for (const tag of tags || []) {
    const kind = TAG_ICON_KINDS[tag.label] || "substance";
    const el = document.createElement("span");
    el.className = `tag ${tag.tone || "positive"}`;
    el.appendChild(createTagIcon(kind));
    const label = document.createElement("span");
    label.className = "tag-label";
    label.textContent = tag.label;
    el.appendChild(label);
    container.appendChild(el);
  }
  container.hidden = container.childElementCount === 0;
}

async function loadRankings(): Promise<RankingsPayload> {
  const response = await fetch(RANKINGS_URL);
  if (!response.ok) {
    throw new Error(`Failed to load rankings (${response.status})`);
  }
  return response.json() as Promise<RankingsPayload>;
}

function renderMeta(payload: RankingsPayload): void {
  const meta = document.getElementById("meta");
  if (!meta) {
    return;
  }
  const count = payload.ranked_count ?? payload.rankings?.length ?? 0;
  meta.textContent = `${count} talks ranked by quality`;
}

function renderCards(payload: RankingsPayload): void {
  const grid = document.getElementById("grid");
  const template = document.getElementById("card-template") as HTMLTemplateElement | null;
  if (!grid || !template) {
    return;
  }

  grid.replaceChildren();

  for (const video of payload.rankings || []) {
    const node = template.content.cloneNode(true) as DocumentFragment;
    const card = node.querySelector<HTMLElement>(".card");
    const rank = node.querySelector<HTMLElement>(".rank");
    const thumbLink = node.querySelector<HTMLAnchorElement>(".thumb-link");
    const thumb = node.querySelector<HTMLImageElement>(".thumb");
    const titleLink = node.querySelector<HTMLAnchorElement>(".title-link");
    const summaryWrap = node.querySelector<HTMLElement>(".summary-wrap");
    const published = node.querySelector<HTMLTimeElement>(".published");
    const score = node.querySelector<HTMLButtonElement>(".score");
    const scoreBreakdown = node.querySelector<HTMLElement>(".score-breakdown");

    if (
      !card ||
      !rank ||
      !thumbLink ||
      !thumb ||
      !titleLink ||
      !summaryWrap ||
      !published ||
      !score ||
      !scoreBreakdown ||
      !video.url
    ) {
      continue;
    }

    card.dataset.videoId = video.id;
    rank.textContent = `#${video.rank}`;
    thumb.src = thumbnailUrl(video.id);
    thumb.alt = video.title;
    thumbLink.href = video.url;
    titleLink.href = video.url;
    titleLink.title = video.title;
    titleLink.textContent = video.title;

    renderSummary(summaryWrap, video.summary_bullets);
    summaryWrap.hidden = !(video.summary_bullets || []).length;
    setupSummaryInteractions(card, summaryWrap, video.id);

    const uploadDate = parseUploadDate(video.upload_date);
    if (uploadDate) {
      published.dateTime = video.upload_date ?? "";
      published.title = formatAbsoluteDate(uploadDate);
      published.textContent = formatRelativeDate(video.upload_date);
    } else {
      published.hidden = true;
    }

    setupScoreButton(card, score, scoreBreakdown, video);

    grid.appendChild(node);
  }

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

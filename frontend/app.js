function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function parseUploadDate(uploadDate) {
  if (!uploadDate || String(uploadDate).length !== 8) {
    return null;
  }

  const value = String(uploadDate);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));
  const date = new Date(year, month, day);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatAbsoluteDate(date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(uploadDate) {
  const date = parseUploadDate(uploadDate);
  if (!date) {
    return null;
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "today";
  }
  if (diffDays === 1) {
    return "yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
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

function formatScore(value) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${Number(value).toFixed(1)}/100`;
}

function verdictClass(verdict) {
  return (verdict || "").toLowerCase();
}

function renderTags(container, tags) {
  container.replaceChildren();
  for (const tag of tags || []) {
    const el = document.createElement("span");
    el.className = `tag ${tag.tone || "positive"}`;
    el.textContent = tag.label;
    container.appendChild(el);
  }
}

async function loadRankings() {
  const response = await fetch("/api/rankings");
  if (!response.ok) {
    throw new Error(`Failed to load rankings (${response.status})`);
  }
  return response.json();
}

function renderMeta(payload) {
  const meta = document.getElementById("meta");
  const count = payload.ranked_count ?? payload.rankings?.length ?? 0;
  meta.textContent = `${count} talks ranked by quality score`;
}

function renderCards(payload) {
  const grid = document.getElementById("grid");
  const template = document.getElementById("card-template");
  grid.replaceChildren();

  for (const video of payload.rankings || []) {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".card");
    const rank = node.querySelector(".rank");
    const thumbLink = node.querySelector(".thumb-link");
    const thumb = node.querySelector(".thumb");
    const titleLink = node.querySelector(".title-link");
    const published = node.querySelector(".published");
    const tagsEl = node.querySelector(".tags");
    const score = node.querySelector(".score");
    const verdict = node.querySelector(".verdict");

    rank.textContent = `#${video.rank}`;
    thumb.src = thumbnailUrl(video.id);
    thumb.alt = video.title;
    thumbLink.href = video.url;
    titleLink.href = video.url;
    titleLink.textContent = video.title;

    const uploadDate = parseUploadDate(video.upload_date);
    if (uploadDate) {
      published.dateTime = video.upload_date;
      published.title = formatAbsoluteDate(uploadDate);
      published.textContent = formatRelativeDate(video.upload_date);
    } else {
      published.hidden = true;
    }

    renderTags(tagsEl, video.tags);
    score.textContent = formatScore(video.composite);
    verdict.textContent = video.verdict || "—";
    verdict.classList.add(verdictClass(video.verdict));

    grid.appendChild(node);
  }
}

function renderError(message) {
  const grid = document.getElementById("grid");
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
  .catch((error) => {
    document.getElementById("meta").textContent = "Could not load rankings";
    renderError(error.message);
  });

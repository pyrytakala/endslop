"""Lightweight YouTube metadata helpers that don't require API keys."""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone

import requests

UPLOAD_DATE_RE = re.compile(r'"uploadDate":"([^"]+)"')
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
)


def upload_date_from_iso(value: str | None) -> str | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.astimezone(timezone.utc).strftime("%Y%m%d")


def fetch_youtube_upload_date(
    video_id: str,
    *,
    session: requests.Session | None = None,
    request_delay: float = 0.0,
) -> str | None:
    """Return YYYYMMDD upload date from a public YouTube watch page."""
    if request_delay > 0:
        time.sleep(request_delay)

    client = session or requests
    response = client.get(
        f"https://www.youtube.com/watch?v={video_id}",
        timeout=30,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()

    match = UPLOAD_DATE_RE.search(response.text)
    if not match:
        return None
    return upload_date_from_iso(match.group(1))

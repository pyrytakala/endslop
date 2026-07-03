"""Supadata API client for YouTube channel videos, metadata, and transcripts."""

from __future__ import annotations

import os
from pathlib import Path

import requests


class SupadataError(Exception):
    pass


def load_env() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


class SupadataClient:
    base_url = "https://api.supadata.ai/v1"

    def __init__(self, api_key: str | None = None) -> None:
        load_env()
        self.api_key = (api_key or os.getenv("SUPADATA_API_KEY", "")).strip()
        if not self.api_key:
            raise SupadataError("SUPADATA_API_KEY is required in .env")

    def _request(self, method: str, path: str, **kwargs) -> dict:
        response = requests.request(
            method,
            f"{self.base_url}{path}",
            headers={"x-api-key": self.api_key},
            timeout=60,
            **kwargs,
        )

        if response.status_code != 200:
            try:
                payload = response.json()
                message = payload.get("message") or payload.get("error") or response.text
            except ValueError:
                message = response.text
            raise SupadataError(f"HTTP {response.status_code}: {message}")

        return response.json()

    def list_channel_videos(
        self,
        channel_url: str,
        limit: int,
        video_type: str = "video",
    ) -> list[str]:
        payload = self._request(
            "GET",
            "/youtube/channel/videos",
            params={"id": channel_url, "type": video_type, "limit": limit},
        )
        return list(payload.get("videoIds") or [])[:limit]

    def get_metadata(self, video_id: str) -> dict:
        url = f"https://www.youtube.com/watch?v={video_id}"
        return self._request("GET", "/metadata", params={"url": url})

    def get_transcript(self, video_id: str) -> tuple[str, dict]:
        url = f"https://www.youtube.com/watch?v={video_id}"
        payload = self._request(
            "GET",
            "/transcript",
            params={"url": url, "text": "false", "mode": "native", "lang": "en"},
        )

        content = payload.get("content")
        if isinstance(content, list):
            lines = [chunk.get("text", "").strip() for chunk in content if chunk.get("text")]
            text = plain_text_from_string("\n".join(lines))
        elif isinstance(content, str) and content.strip():
            text = plain_text_from_string(content)
        else:
            raise SupadataError("empty transcript")

        return text, {
            "language_code": payload.get("lang"),
            "available_langs": payload.get("availableLangs") or [],
        }


def plain_text_from_string(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines) + ("\n" if lines else "")


def metadata_to_index_fields(payload: dict) -> dict:
    stats = payload.get("stats") or {}
    media = payload.get("media") or {}
    author = payload.get("author") or {}

    created_at = payload.get("createdAt")
    upload_date = created_at[:10].replace("-", "") if created_at else None

    return {
        "title": payload.get("title"),
        "view_count": stats.get("views"),
        "like_count": stats.get("likes"),
        "comment_count": stats.get("comments"),
        "upload_date": upload_date,
        "duration_seconds": media.get("duration"),
        "channel": author.get("displayName"),
        "description": payload.get("description"),
    }

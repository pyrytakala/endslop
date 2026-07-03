#!/usr/bin/env python3
"""Fetch YouTube transcripts and metadata via Supadata only."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

from supadata_client import SupadataClient, SupadataError, metadata_to_index_fields


DEFAULT_CHANNEL_URL = "https://www.youtube.com/@aiDotEngineer/videos"
DEFAULT_OUTPUT_DIR = Path("transcripts")
DEFAULT_LIMIT = 10
DEFAULT_REQUEST_DELAY = 1.0
INVALID_FILENAME_CHARS = re.compile(r"[/\\]")


def title_to_filename(title: str) -> str:
    name = INVALID_FILENAME_CHARS.sub("-", title or "untitled").strip()
    return f"{name or 'untitled'}.txt"


def save_transcript(
    output_dir: Path,
    title: str,
    video_id: str,
    transcript_text: str,
    used_names: set[str],
) -> Path:
    filename = title_to_filename(title)
    if filename in used_names:
        stem = filename.removesuffix(".txt")
        filename = f"{stem} [{video_id}].txt"
    used_names.add(filename)

    text_path = output_dir / filename
    text_path.write_text(transcript_text)
    return text_path


def process_video(
    client: SupadataClient,
    video_id: str,
    output_dir: Path,
    used_names: set[str],
    request_delay: float,
) -> dict:
    metadata_payload = client.get_metadata(video_id)
    fields = metadata_to_index_fields(metadata_payload)
    title = fields.get("title") or video_id

    result = {
        "id": video_id,
        "title": title,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        **fields,
    }

    try:
        transcript_text, transcript_meta = client.get_transcript(video_id)
        text_path = save_transcript(output_dir, title, video_id, transcript_text, used_names)
        result.update(
            {
                "transcript_status": "ok",
                "transcript_provider": "supadata",
                "transcript_path": str(text_path),
                "line_count": len(transcript_text.splitlines()),
                **transcript_meta,
            }
        )
    except SupadataError as exc:
        result["transcript_status"] = "failed"
        result["error"] = str(exc)

    if request_delay > 0:
        time.sleep(request_delay)

    return result


def retry_missing_transcripts(
    client: SupadataClient,
    output_dir: Path,
    request_delay: float,
    *,
    refresh_all: bool = False,
) -> int:
    index_path = output_dir / "index.json"
    if not index_path.exists():
        print(f"Missing index file: {index_path}", file=sys.stderr)
        return 1

    payload = json.loads(index_path.read_text())
    videos = payload.get("videos") or []
    if refresh_all:
        pending = videos
        print(f"Refreshing {len(pending)} transcripts...\n")
    else:
        pending = [video for video in videos if video.get("transcript_status") != "ok"]
        if not pending:
            print("All transcripts already downloaded.")
            return 0
        print(f"Retrying {len(pending)} missing transcripts...\n")

    for index, video in enumerate(pending, start=1):
        print(f"[{index}/{len(pending)}] {video['title']} ({video['id']})")
        try:
            transcript_text, transcript_meta = client.get_transcript(video["id"])
            text_path = output_dir / title_to_filename(video["title"])
            text_path.write_text(transcript_text)
            video["transcript_status"] = "ok"
            video["transcript_provider"] = "supadata"
            video["transcript_path"] = str(text_path)
            video["line_count"] = len(transcript_text.splitlines())
            video.update(transcript_meta)
            video.pop("error", None)
            print("  -> ok")
        except SupadataError as exc:
            video["transcript_status"] = "failed"
            video["error"] = str(exc)
            print(f"  -> failed: {exc}")

        if request_delay > 0 and index < len(pending):
            time.sleep(request_delay)

    index_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    ok_count = sum(1 for video in videos if video.get("transcript_status") == "ok")
    print(f"\nDone. {ok_count}/{len(videos)} transcripts available in {output_dir}/")
    return 0 if ok_count else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch YouTube transcripts and metadata via Supadata."
    )
    parser.add_argument(
        "--channel-url",
        default=DEFAULT_CHANNEL_URL,
        help=f"Channel videos URL (default: {DEFAULT_CHANNEL_URL})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Number of videos to fetch (default: {DEFAULT_LIMIT})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory to write transcripts (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--request-delay",
        type=float,
        default=DEFAULT_REQUEST_DELAY,
        help=f"Seconds to wait between videos (default: {DEFAULT_REQUEST_DELAY})",
    )
    parser.add_argument(
        "--retry-transcripts",
        action="store_true",
        help="Only fetch missing transcripts using existing transcripts/index.json",
    )
    parser.add_argument(
        "--refresh-transcripts",
        action="store_true",
        help="Re-download all transcript files from Supadata using existing index.json",
    )
    args = parser.parse_args()

    try:
        client = SupadataClient()
    except SupadataError as exc:
        print(exc, file=sys.stderr)
        return 1

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.retry_transcripts or args.refresh_transcripts:
        return retry_missing_transcripts(
            client,
            output_dir,
            args.request_delay,
            refresh_all=args.refresh_transcripts,
        )

    print(f"Listing up to {args.limit} videos from {args.channel_url} via Supadata...")
    try:
        video_ids = client.list_channel_videos(args.channel_url, args.limit)
    except SupadataError as exc:
        print(exc, file=sys.stderr)
        return 1

    if not video_ids:
        print("No videos found.", file=sys.stderr)
        return 1

    print(f"Found {len(video_ids)} videos. Fetching metadata and transcripts...\n")

    results: list[dict] = []
    used_names: set[str] = set()

    for index, video_id in enumerate(video_ids, start=1):
        print(f"[{index}/{len(video_ids)}] {video_id}")
        result = process_video(
            client,
            video_id,
            output_dir,
            used_names,
            request_delay=args.request_delay if index < len(video_ids) else 0,
        )
        results.append(result)
        print(
            f"  -> {result.get('title')}\n"
            f"     transcript: {result['transcript_status']}, "
            f"views: {result.get('view_count')}, "
            f"likes: {result.get('like_count')}"
        )

    index_path = output_dir / "index.json"
    index_path.write_text(
        json.dumps(
            {
                "source": "supadata",
                "channel_url": args.channel_url,
                "video_count": len(results),
                "videos": results,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )

    ok_count = sum(1 for result in results if result["transcript_status"] == "ok")
    print(f"\nDone. Saved {ok_count}/{len(results)} transcripts to {output_dir}/")
    print(f"Metadata: {index_path}")

    return 0 if ok_count else 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Fetch YouTube transcripts and metadata via a configurable provider."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

from transcript_providers import (
    TranscriptProvider,
    TranscriptProviderError,
    default_provider_name,
    get_provider,
)
from youtube_metadata import fetch_youtube_upload_date


DEFAULT_CHANNEL_URL = "https://www.youtube.com/@aiDotEngineer/videos"
DEFAULT_OUTPUT_DIR = Path("transcripts")
DEFAULT_MONTHS = 2
DEFAULT_PROBE_LIMIT = 500
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


def find_existing_transcript(output_dir: Path, title: str, video_id: str) -> Path | None:
    candidates = [
        output_dir / title_to_filename(title),
        output_dir / f"{title_to_filename(title).removesuffix('.txt')} [{video_id}].txt",
    ]
    for path in output_dir.glob("*.txt"):
        if f"[{video_id}]" in path.name:
            candidates.append(path)

    for path in candidates:
        if path.is_file() and path.stat().st_size > 0:
            return path
    return None


def process_video(
    provider: TranscriptProvider,
    video_id: str,
    output_dir: Path,
    used_names: set[str],
    request_delay: float,
    *,
    metadata_payload: dict | None = None,
) -> dict:
    metadata_payload = metadata_payload or provider.get_metadata(video_id)
    fields = provider.metadata_to_index_fields(metadata_payload)
    if not fields.get("upload_date"):
        try:
            fields["upload_date"] = fetch_youtube_upload_date(video_id)
        except Exception:
            pass
    title = fields.get("title") or video_id

    result = {
        "id": video_id,
        "title": title,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        **fields,
    }

    try:
        existing_path = find_existing_transcript(output_dir, title, video_id)
        if existing_path:
            transcript_text = existing_path.read_text()
            transcript_meta: dict = {"language_code": None, "available_langs": []}
            text_path = existing_path
        else:
            transcript_text, transcript_meta = provider.get_transcript(video_id)
            text_path = save_transcript(output_dir, title, video_id, transcript_text, used_names)
        result.update(
            {
                "transcript_status": "ok",
                "transcript_provider": provider.name,
                "transcript_path": str(text_path),
                "line_count": len(transcript_text.splitlines()),
                **transcript_meta,
            }
        )
    except TranscriptProviderError as exc:
        result["transcript_status"] = "failed"
        result["error"] = str(exc)

    if request_delay > 0:
        time.sleep(request_delay)

    return result


def retry_missing_transcripts(
    provider: TranscriptProvider,
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
        print(f"Refreshing {len(pending)} transcripts via {provider.name}...\n")
    else:
        pending = [video for video in videos if video.get("transcript_status") != "ok"]
        if not pending:
            print("All transcripts already downloaded.")
            return 0
        print(f"Retrying {len(pending)} missing transcripts via {provider.name}...\n")

    for index, video in enumerate(pending, start=1):
        print(f"[{index}/{len(pending)}] {video['title']} ({video['id']})")
        try:
            transcript_text, transcript_meta = provider.get_transcript(video["id"])
            text_path = output_dir / title_to_filename(video["title"])
            text_path.write_text(transcript_text)
            video["transcript_status"] = "ok"
            video["transcript_provider"] = provider.name
            video["transcript_path"] = str(text_path)
            video["line_count"] = len(transcript_text.splitlines())
            video.update(transcript_meta)
            video.pop("error", None)
            print("  -> ok")
        except TranscriptProviderError as exc:
            video["transcript_status"] = "failed"
            video["error"] = str(exc)
            print(f"  -> failed: {exc}")

        if request_delay > 0 and index < len(pending):
            time.sleep(request_delay)

    payload["provider"] = provider.name
    index_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    ok_count = sum(1 for video in videos if video.get("transcript_status") == "ok")
    print(f"\nDone. {ok_count}/{len(videos)} transcripts available in {output_dir}/")
    return 0 if ok_count else 1


def backfill_upload_dates(output_dir: Path, request_delay: float) -> int:
    index_path = output_dir / "index.json"
    if not index_path.exists():
        print(f"Missing index file: {index_path}", file=sys.stderr)
        return 1

    payload = json.loads(index_path.read_text())
    videos = payload.get("videos") or []
    pending = [video for video in videos if not video.get("upload_date")]
    if not pending:
        print("All videos already have upload dates.")
        return 0

    print(f"Backfilling upload dates for {len(pending)} videos...\n")

    import requests

    session = requests.Session()
    updated = 0
    for index, video in enumerate(pending, start=1):
        video_id = video["id"]
        print(f"[{index}/{len(pending)}] {video['title']} ({video_id})")
        try:
            upload_date = fetch_youtube_upload_date(
                video_id,
                session=session,
                request_delay=request_delay if index > 1 else 0.0,
            )
        except Exception as exc:
            print(f"  -> failed: {exc}")
            continue

        if not upload_date:
            print("  -> failed: upload date not found")
            continue

        video["upload_date"] = upload_date
        updated += 1
        print(f"  -> {upload_date}")

    payload["videos"] = videos
    index_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"\nDone. Updated {updated}/{len(pending)} videos in {index_path}")
    return 0 if updated else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch YouTube transcripts and metadata via a transcript provider."
    )
    parser.add_argument(
        "--provider",
        default=None,
        help=(
            "Transcript provider to use "
            f"(default: {default_provider_name()} from env/available keys). "
            "Choices: supadata, transcriptapi"
        ),
    )
    parser.add_argument(
        "--channel-url",
        default=DEFAULT_CHANNEL_URL,
        help=f"Channel videos URL (default: {DEFAULT_CHANNEL_URL})",
    )
    parser.add_argument(
        "--months",
        type=float,
        default=DEFAULT_MONTHS,
        help=f"Fetch videos published within this many months (default: {DEFAULT_MONTHS})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional cap on number of videos to fetch after date filtering",
    )
    parser.add_argument(
        "--probe-limit",
        type=int,
        default=DEFAULT_PROBE_LIMIT,
        help=f"Max channel videos to inspect when filtering by date (default: {DEFAULT_PROBE_LIMIT})",
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
        help="Re-download all transcript files using existing index.json",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable transcript provider API response cache",
    )
    parser.add_argument(
        "--backfill-upload-dates",
        action="store_true",
        help="Fill missing upload_date values in transcripts/index.json from YouTube",
    )
    args = parser.parse_args()

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.backfill_upload_dates:
        return backfill_upload_dates(output_dir, args.request_delay)

    try:
        provider = get_provider(args.provider, use_cache=not args.no_cache)
    except TranscriptProviderError as exc:
        print(exc, file=sys.stderr)
        return 1

    if args.retry_transcripts or args.refresh_transcripts:
        return retry_missing_transcripts(
            provider,
            output_dir,
            args.request_delay,
            refresh_all=args.refresh_transcripts,
        )

    months_label = f"{args.months:g} month{'s' if args.months != 1 else ''}"
    print(
        f"Listing videos from {args.channel_url} published within the past "
        f"{months_label} via {provider.name}..."
    )
    try:
        video_ids = provider.list_channel_videos_since(
            args.channel_url,
            months=args.months,
            probe_limit=args.probe_limit,
            max_videos=args.limit,
            request_delay=args.request_delay,
        )
    except TranscriptProviderError as exc:
        print(exc, file=sys.stderr)
        return 1

    if not video_ids:
        print("No videos found in the requested date window.", file=sys.stderr)
        return 1

    print(f"Found {len(video_ids)} videos in window. Fetching transcripts...\n")

    results: list[dict] = []
    used_names: set[str] = set()

    for index, (video_id, metadata_payload) in enumerate(video_ids, start=1):
        print(f"[{index}/{len(video_ids)}] {video_id}")
        result = process_video(
            provider,
            video_id,
            output_dir,
            used_names,
            request_delay=args.request_delay if index < len(video_ids) else 0,
            metadata_payload=metadata_payload,
        )
        results.append(result)
        print(
            f"  -> {result.get('title')}\n"
            f"     transcript: {result['transcript_status']}, "
            f"views: {result.get('view_count')}, "
            f"upload_date: {result.get('upload_date')}"
        )

    index_path = output_dir / "index.json"
    index_path.write_text(
        json.dumps(
            {
                "provider": provider.name,
                "channel_url": args.channel_url,
                "months": args.months,
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

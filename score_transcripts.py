#!/usr/bin/env python3
"""Score conference talk transcripts using Fireworks and rank by quality."""

from __future__ import annotations

import os
import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

from supadata_client import load_env
from dimension_tags import dimension_tags
from ranking_adjustments import apply_like_rank_adjustment, index_videos_by_id


DEFAULT_INDEX_PATH = Path("transcripts/index.json")
DEFAULT_PROMPT_PATH = Path("scoring_prompt.txt")
DEFAULT_OUTPUT_DIR = Path("scores")
DEFAULT_MODEL = "accounts/fireworks/models/deepseek-v4-flash"
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

COMPOSITE_RE = re.compile(
    r"(?:COMPOSITE:.*?([\d.]+)\s*/\s*100|Total\s*=\s*([\d.]+)\s*/\s*100)",
    re.IGNORECASE | re.DOTALL,
)
VERDICT_RE = re.compile(
    r"(?:\*\*)?Verdict:(?:\*\*)?\s*(WATCH|SKIM|SKIP)",
    re.IGNORECASE,
)
CONFIDENCE_RE = re.compile(r"Confidence:\s*(?:\*\*)?(High|Med|Low)", re.IGNORECASE)
DIMENSION_RES = {
    "substance": re.compile(
        r"^-\s*(?:\*\*)?Substance:(?:\*\*)?\s*.+?(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "evidence": re.compile(
        r"^-\s*(?:\*\*)?Evidence:(?:\*\*)?\s*.+?(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "specificity": re.compile(
        r"^-\s*(?:\*\*)?Specificity:(?:\*\*)?\s*.+?(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "insight_density": re.compile(
        r"^-\s*(?:\*\*)?Insight density:(?:\*\*)?\s*.+?(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
    "non_promotion": re.compile(
        r"^-\s*(?:\*\*)?Non-promotion:(?:\*\*)?\s*.+?(?:\*\*)?(\d+(?:\.\d+)?)(?:\*\*)?\s*$",
        re.IGNORECASE | re.MULTILINE,
    ),
}


def extract_speakers(title: str, description: str | None = None) -> str:
    if " - " in title:
        return title.rsplit(" - ", 1)[1].strip()
    if description:
        speakers_match = re.search(r"Speakers?:\s*\n(?:-\s*(.+?)(?:\n|$))+", description, re.IGNORECASE)
        if speakers_match:
            names = re.findall(r"-\s*(.+?)(?:\n|$)", description)
            if names:
                return "; ".join(name.strip() for name in names[:3])
    return "Unknown"


def load_prompt_template(path: Path) -> str:
    return path.read_text()


def build_prompt(template: str, title: str, speakers: str, transcript: str) -> str:
    return (
        template.replace("{title}", title)
        .replace("{speakers}", speakers)
        .replace("{transcript}", transcript)
    )


def score_transcript(
    api_key: str,
    model: str,
    prompt: str,
    *,
    max_tokens: int = 4096,
    temperature: float = 0.2,
) -> str:
    response = requests.post(
        FIREWORKS_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        },
        timeout=300,
    )

    if response.status_code != 200:
        raise RuntimeError(f"Fireworks HTTP {response.status_code}: {response.text}")

    payload = response.json()
    return payload["choices"][0]["message"]["content"]


def parse_score_response(text: str) -> dict:
    result: dict = {"raw_response": text}

    composite_match = COMPOSITE_RE.search(text)
    if composite_match:
        value = composite_match.group(1) or composite_match.group(2)
        if value:
            result["composite"] = float(value)

    if "composite" not in result:
        composite_line = re.search(r"^-\s*(?:\*\*)?COMPOSITE:(?:\*\*)?.*$", text, re.MULTILINE | re.IGNORECASE)
        if composite_line:
            following = text[composite_line.end() : composite_line.end() + 400]
            totals = re.findall(r"([\d.]+)\s*/\s*100", following)
            if totals:
                result["composite"] = float(totals[-1])

    verdict_match = VERDICT_RE.search(text)
    if verdict_match:
        result["verdict"] = verdict_match.group(1).upper()

    confidence_match = CONFIDENCE_RE.search(text)
    if confidence_match:
        result["confidence"] = confidence_match.group(1).capitalize()

    for name, pattern in DIMENSION_RES.items():
        match = pattern.search(text)
        if match:
            result[name] = float(match.group(1))

    claim_match = re.search(
        r"Central claim\(s\):\s*(.+?)(?=\n-\s*Substance:|\nSubstance:|\Z)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if claim_match:
        result["central_claims"] = claim_match.group(1).strip()

    return result


def safe_filename(title: str, video_id: str) -> str:
    name = re.sub(r"[/\\]", "-", title).strip() or video_id
    return f"{name} [{video_id}]"


def load_videos(index_path: Path) -> list[dict]:
    payload = json.loads(index_path.read_text())
    videos = payload.get("videos") or []
    return [video for video in videos if video.get("transcript_status") == "ok"]


def write_rankings(
    output_dir: Path,
    model: str,
    prompt_path: Path,
    results: list[dict],
    index_path: Path,
    *,
    max_like_adjustment: float = 3.0,
) -> list[dict]:
    index_by_id = index_videos_by_id(json.loads(index_path.read_text()))
    ranked = apply_like_rank_adjustment(
        results,
        index_by_id,
        max_adjustment=max_like_adjustment,
    )

    for rank, result in enumerate(ranked, start=1):
        result["rank"] = rank
        result["tags"] = dimension_tags(result)

    rankings_path = output_dir / "rankings.json"
    rankings_path.write_text(
        json.dumps(
            {
                "model": model,
                "prompt_path": str(prompt_path),
                "video_count": len(results),
                "ranked_count": len(ranked),
                "rankings": ranked,
                "failures": [result for result in results if result.get("status") != "ok"],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )

    print("\nRankings (best first):\n")
    for result in ranked:
        print(
            f"{result['rank']:>2}. {result['composite']:.1f}/100  "
            f"{result.get('verdict', '?'):<4}  {result['title']}"
        )

    print(f"\nSaved detailed scores to {output_dir}/")
    print(f"Rankings: {rankings_path}")
    return ranked


def reparse_rankings(
    index_path: Path,
    output_dir: Path,
    model: str,
    prompt_path: Path,
) -> int:
    videos = load_videos(index_path)
    results: list[dict] = []

    for video in videos:
        score_path = output_dir / f"{safe_filename(video['title'], video['id'])}.txt"
        if not score_path.exists():
            results.append(
                {
                    "id": video["id"],
                    "title": video["title"],
                    "url": video.get("url"),
                    "status": "failed",
                    "error": f"missing score file: {score_path}",
                }
            )
            continue

        parsed = parse_score_response(score_path.read_text())
        results.append(
            {
                "id": video["id"],
                "title": video["title"],
                "speakers": extract_speakers(video["title"], video.get("description")),
                "url": video.get("url"),
                "status": "ok",
                "score_path": str(score_path),
                **{key: value for key, value in parsed.items() if key != "raw_response"},
            }
        )

    ranked = write_rankings(
        output_dir,
        model,
        prompt_path,
        results,
        index_path,
    )
    return 0 if ranked else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Score talk transcripts and rank by quality.")
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX_PATH)
    parser.add_argument("--prompt", type=Path, default=DEFAULT_PROMPT_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--request-delay", type=float, default=1.0)
    parser.add_argument(
        "--reparse",
        action="store_true",
        help="Rebuild rankings.json from existing score files without calling the API",
    )
    args = parser.parse_args()

    load_env()
    api_key = os.environ.get("FIREWORKS_API_KEY", "").strip()

    if args.reparse:
        return reparse_rankings(args.index, args.output_dir, args.model, args.prompt)
    if not api_key:
        print("FIREWORKS_API_KEY is required in .env", file=sys.stderr)
        return 1

    if not args.index.exists():
        print(f"Missing index: {args.index}", file=sys.stderr)
        return 1
    if not args.prompt.exists():
        print(f"Missing prompt: {args.prompt}", file=sys.stderr)
        return 1

    template = load_prompt_template(args.prompt)
    videos = load_videos(args.index)
    if not videos:
        print("No scored transcripts found in index.", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []

    print(f"Scoring {len(videos)} talks with {args.model}...\n")

    for index, video in enumerate(videos, start=1):
        title = video["title"]
        video_id = video["id"]
        transcript_path = Path(video["transcript_path"])

        print(f"[{index}/{len(videos)}] {title}")

        if not transcript_path.exists():
            print(f"  -> skipped: missing transcript at {transcript_path}")
            continue

        transcript = transcript_path.read_text()
        speakers = extract_speakers(title, video.get("description"))
        prompt = build_prompt(template, title, speakers, transcript)

        try:
            response_text = score_transcript(api_key, args.model, prompt)
            parsed = parse_score_response(response_text)
        except Exception as exc:  # noqa: BLE001
            print(f"  -> failed: {exc}")
            results.append(
                {
                    "id": video_id,
                    "title": title,
                    "url": video.get("url"),
                    "status": "failed",
                    "error": str(exc),
                }
            )
            continue

        stem = safe_filename(title, video_id)
        score_path = args.output_dir / f"{stem}.txt"
        score_path.write_text(response_text)

        entry = {
            "id": video_id,
            "title": title,
            "speakers": speakers,
            "url": video.get("url"),
            "status": "ok",
            "score_path": str(score_path),
            **{key: value for key, value in parsed.items() if key != "raw_response"},
        }
        results.append(entry)

        composite = entry.get("composite")
        verdict = entry.get("verdict", "?")
        print(f"  -> composite: {composite if composite is not None else '?'} | {verdict}")

        if args.request_delay > 0 and index < len(videos):
            time.sleep(args.request_delay)

    ranked = write_rankings(
        args.output_dir,
        args.model,
        args.prompt,
        results,
        args.index,
    )
    return 0 if ranked else 1


if __name__ == "__main__":
    raise SystemExit(main())

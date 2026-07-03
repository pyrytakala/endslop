#!/usr/bin/env python3
"""Serve the talk rankings frontend and rankings API."""

from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from dimension_tags import dimension_tags
from ranking_adjustments import apply_like_rank_adjustment, index_videos_by_id


ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"
RANKINGS_PATH = ROOT / "scores" / "rankings.json"
INDEX_PATH = ROOT / "transcripts" / "index.json"


class FrontendHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self) -> None:
        if self.path == "/api/rankings":
            self._serve_rankings()
            return
        if self.path == "/":
            self.path = "/index.html"
        super().do_GET()

    def _serve_rankings(self) -> None:
        if not RANKINGS_PATH.exists():
            self.send_error(404, "rankings.json not found — run score_transcripts.py first")
            return

        payload = json.loads(RANKINGS_PATH.read_text())
        if INDEX_PATH.exists() and payload.get("rankings"):
            index_by_id = index_videos_by_id(json.loads(INDEX_PATH.read_text()))
            ranked = apply_like_rank_adjustment(payload["rankings"], index_by_id)
            for rank, video in enumerate(ranked, start=1):
                video["rank"] = rank
                if "tags" not in video:
                    video["tags"] = dimension_tags(video)
            payload["rankings"] = ranked
            payload["ranked_count"] = len(ranked)
        else:
            for video in payload.get("rankings") or []:
                if "tags" not in video:
                    video["tags"] = dimension_tags(video)
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the talk rankings frontend.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    if not FRONTEND_DIR.is_dir():
        raise SystemExit(f"Missing frontend directory: {FRONTEND_DIR}")
    if not RANKINGS_PATH.exists():
        print(f"Warning: {RANKINGS_PATH} not found. Run score_transcripts.py first.")

    server = ThreadingHTTPServer((args.host, args.port), FrontendHandler)
    url = f"http://{args.host}:{args.port}"
    print(f"Serving rankings UI at {url}")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

# content-ranker

Rank conference talks by transcript quality. Fetches YouTube transcripts via Supadata, scores them with Fireworks, and serves a small rankings frontend.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill in API keys in .env
```

## Usage

```bash
# Fetch transcripts from a YouTube channel
python fetch_transcripts.py

# Score transcripts and write rankings
python score_transcripts.py

# Serve the rankings UI
python serve_frontend.py
```

The frontend reads `scores/rankings.json` and `transcripts/index.json`, which are generated locally and not committed.

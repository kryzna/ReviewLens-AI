# ReviewLens AI

Paste a review URL or upload a CSV/JSONL file — get an AI-powered Q&A interface grounded in those reviews.

## Features

- **URL ingest**: Trustpilot, Apple App Store, Google Play
- **File upload**: CSV or JSONL (up to 500 reviews)
- **Scoped Q&A**: every answer cites specific reviews via `[r:id]` chips
- **Scope guard**: refuses off-topic questions; styled with amber refusal bubble
- **Session history**: persisted in SQLite, survives restarts

## Quick start

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `DB_PATH` | No | SQLite path (default: `./data/reviewlens.db`) |

## File upload format

**CSV** — required columns: `text`. Optional: `author`, `rating`, `date`, `source_url`, `verified`.

```csv
author,rating,date,text
Alice,5,2024-01-15,Great product
Bob,2,2024-02-01,Stopped working after update
```

**JSONL** — one JSON object per line, same fields:

```jsonl
{"author":"Alice","rating":5,"date":"2024-01-15","text":"Great product"}
{"author":"Bob","rating":2,"text":"Stopped working after update"}
```

Sample fixtures in `fixtures/`.

## Trustpilot scraping

Uses headless Chromium (Playwright) to bypass Cloudflare. Requires Chrome or Chromium installed:

- **macOS**: `brew install --cask google-chrome`
- **Linux**: `apt install chromium-browser` or `snap install chromium`
- **Docker/Fly**: Chromium bundled in image via `apk add chromium`

Falls back to plain HTTP fetch if Chromium not found — likely blocked by Cloudflare. If blocked, use file upload instead.

> **ToS note**: Trustpilot's Terms of Service prohibit automated scraping. Use for personal/research purposes only.

## Deploy to Fly.io

```bash
fly auth login
fly launch --no-deploy          # creates app + volume
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

App runs at `https://<app-name>.fly.dev`. No authentication — anyone with the URL can read all sessions and chat history.

## Privacy

Sessions and chat history are stored unencrypted in SQLite on the Fly volume. Do not ingest reviews containing personal data you are not authorized to process.

## Limitations (non-goals)

- No auth / access control
- No multi-platform per session
- No streaming responses
- No search within reviews
- Single-region single-VM; not designed for concurrent load

## Running tests

```bash
npm test
```

16 unit tests covering scrapers, citation parsing, and ingest normalization.

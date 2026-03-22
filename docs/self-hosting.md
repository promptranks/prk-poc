# Self-Hosting Guide

## Prerequisites

- Docker & Docker Compose v2+
- 2GB RAM minimum
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com/))

## Quick Start

```bash
git clone https://github.com/promptranks/prk-poc.git
cd prk-poc
cp .env.example .env
```

Edit `.env` and set:
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` — API key for your chosen LLM provider
- `LLM_EXECUTOR_MODEL` / `LLM_JUDGE_MODEL` — model with provider prefix (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4-6`)
- `POSTGRES_PASSWORD` — change from default
- `SECRET_KEY` — generate with `openssl rand -hex 32`

```bash
docker compose up -d
docker compose exec api python scripts/seed-questions.py
```

Open `http://localhost:3000`.

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Web (React) | 3000 | Frontend |
| API (FastAPI) | 8000 | Backend |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Sessions, cache |

## Environment Variables

See [.env.example](../.env.example) for all available configuration options.

### Required
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` — LLM provider API key (set whichever you use)
- `SECRET_KEY` — JWT signing key

### Optional
- `LLM_EXECUTOR_MODEL` — Model for running user prompts (default: `openai/gpt-4o`)
- `LLM_JUDGE_MODEL` — Model for scoring outputs (default: `openai/gpt-4o`)
- `QUICK_ASSESSMENT_TIME_LIMIT` — Quick mode timer in seconds (default: 900)

## Data Persistence

PostgreSQL data is stored in a Docker volume (`prk-poc-pgdata`). To back up:

```bash
docker compose exec postgres pg_dump -U promptranks promptranks > backup.sql
```

## Updating

```bash
git pull origin main
docker compose build
docker compose up -d
docker compose exec api python scripts/seed-questions.py
```

## Troubleshooting

**API won't start**: Check `docker compose logs api` — usually a missing env var.

**LLM calls fail**: Verify your API key is valid and has credits. Check model name includes provider prefix (e.g., `openai/gpt-4o`).

**Database errors**: Run `docker compose down -v` to reset (destroys data).

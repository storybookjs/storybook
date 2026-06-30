# Agent Evaluation Suite

Test AI coding agents to measure what actually works.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API keys (see comments in `.env.example` for options):
   - **Choose ONE agent key**: `AI_GATEWAY_API_KEY` (for Vercel agents), `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`
   - **Choose ONE sandbox option**: `VERCEL_TOKEN`, `VERCEL_OIDC_TOKEN`, or use Docker (set `sandbox: 'docker'` in config)

## Running Evals

### Preview (no cost)

See what will run without making API calls:

```bash
npx @vercel/agent-eval cc --dry
```

### Run Experiments

Run the Claude Code experiment:

```bash
npx @vercel/agent-eval cc
```

Run the Codex experiment:

```bash
npx @vercel/agent-eval codex
```

### View Results

Launch the web-based results viewer:

```bash
npx @vercel/agent-eval playground
```

Open [http://localhost:3000](http://localhost:3000) to browse results.


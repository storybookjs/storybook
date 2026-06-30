# Agent Evaluation Suite

Test AI coding agents to measure what actually works.

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
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
pnpm eval:dry
```

### Run Experiments

Run all configured experiments:

```bash
pnpm eval
```

Run a single experiment:

```bash
pnpm exec agent-eval cc
```

Pull requests with the `ci:eval` label run all experiments in CI.

### View Results

```bash
pnpm playground
```

Open [http://localhost:3000](http://localhost:3000) to browse results.

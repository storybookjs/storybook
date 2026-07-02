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
   - **Agent keys**: `ANTHROPIC_API_KEY` is required for the Claude Code experiments, which use the direct Anthropic API. `AI_GATEWAY_API_KEY` is required for failure classification. `OPENAI_API_KEY` is required for the Codex experiments, which use the direct Codex API.
   - **Sandbox access**: this suite is configured with `sandbox: 'auto'`, which uses Vercel Sandbox when access-token credentials (`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, and `VERCEL_TOKEN`) are present and falls back to local Docker otherwise. Set `sandbox: 'docker'` to force Docker-only experiments.

## Running Evals

Commands below assume you are in `agent-eval/`. From the repository root, prefix
them with `pnpm --dir agent-eval`, for example `pnpm --dir agent-eval run
eval:dry`.

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
pnpm exec agent-eval cc-mcp-opus-high
```

Pull requests with the `ci:eval` label run all experiments in CI.

By default only the first core eval (`801-create-component-no-launch-config`)
runs. Set `EVAL_EXTRA_EVALS=1` to run the full hand-crafted 8xx eval line, or
`EVAL_ONLY=<name>[,<name>]` to debug specific core evals one at a time:

```bash
EVAL_EXTRA_EVALS=1 pnpm eval
EVAL_ONLY=803-edit-component pnpm eval
```

The 9xx evals (ports from the old `/eval` system) never run automatically; see
`lib/experiment.ts`.

Experiments named `<agent>-<integration>-<model>-<effort>` pin their model and
effort explicitly. Non-default model tiers (currently `cc-plugin-sonnet-medium` and `cc-mcp-sonnet-medium`)
run zero evals unless `EVAL_EXTRA_MODELS=1` is set, so labeled CI runs only pay
for the default-model experiments:

```bash
EVAL_EXTRA_MODELS=1 pnpm exec agent-eval cc-plugin-sonnet-medium
```

Sandbox setup resolves the Storybook npm dist-tag at run time and pins the
exact version it finds into the sandbox `package.json`, so each result snapshot
records which version the run used. By default it pins the `next` tag and keeps
the local `@storybook/addon-mcp`/`@storybook/mcp` builds from this checkout.
Set `EVAL_STORYBOOK_LATEST=1` to pin the `latest` tag instead — including the
published `@storybook/addon-mcp` and `@storybook/mcp` in place of the local
builds — to check whether a behavior change (e.g. in the documentation tooling)
regressed since the last stable release:

```bash
EVAL_STORYBOOK_LATEST=1 pnpm eval
```

In CI, the `ci:extra-evals`, `ci:extra-models`, and `ci:storybook-latest` PR
labels set the matching flag on labeled `ci:eval` runs, and manual
`workflow_dispatch` runs of the `Agent eval` workflow can enable them through
the `extra_evals`, `extra_models`, and `storybook_latest` inputs, or target
specific evals through the `eval_only` input.

CI uses Vercel Sandbox through access-token credentials (`VERCEL_PROJECT_ID`,
`VERCEL_TEAM_ID`, and `VERCEL_TOKEN`). Do not store a static
`VERCEL_OIDC_TOKEN` in GitHub secrets; development OIDC tokens expire and
Vercel-issued OIDC is only refreshed automatically inside Vercel-managed
runtime/build contexts.

Configured experiments:

- `cc-mcp-opus-high`: Claude Code (Opus at high effort) through the `claude-code` agent (direct Anthropic API, requires `ANTHROPIC_API_KEY`) with project-local Storybook MCP config in `.mcp.json`.
- `codex-mcp-gpt-5.5-medium`: Codex (gpt-5.5 at medium reasoning effort) with project-local Storybook MCP config in `.codex/config.toml`.
- `cc-plugin-opus-high`: Claude Code (Opus at high effort) through the `claude-code` agent (direct Anthropic API, requires `ANTHROPIC_API_KEY`) with Storybook plugin skills copied to `.claude/skills`.
- `cc-plugin-sonnet-medium`: Claude Code (Sonnet at medium effort) plugin variant; runs zero evals unless `EVAL_EXTRA_MODELS=1` is set.
- `cc-mcp-sonnet-medium`: Claude Code (Sonnet at medium effort) MCP variant; runs zero evals unless `EVAL_EXTRA_MODELS=1` is set.
- `codex-plugin-gpt-5.5-medium`: Codex (gpt-5.5 at medium reasoning effort) with Storybook plugin skills copied to `.agents/skills`.

## Shared Templates

Fixtures can opt into a shared starter project with package metadata:

```json
{
	"evals": {
		"template": "reshaped-storybook"
	}
}
```

Templates live in `agent-eval/templates/<template-name>` and are copied into the
sandbox during setup before the agent runs. They intentionally stay visible in
saved result project snapshots so eval runs are easy to inspect.

This keeps prompt variants small: each variant keeps its own `PROMPT.md`,
`EVAL.ts`, and metadata `package.json`, while shared app files stay in the
template.

Templates can use local built Storybook MCP packages with npm `file:`
dependencies, for example `file:./local-packages/addon-mcp`. The setup step
copies `packages/addon-mcp/dist` and `packages/mcp/dist` from this checkout into
the sandbox before the sandbox runs `npm install`. CI builds those packages
before running evals; run `pnpm --filter @storybook/addon-mcp... run build`
locally after changing those packages.

The MCP experiments configure each agent through its project-local MCP file:
Claude Code gets `.mcp.json`, and Codex gets `.codex/config.toml`. The plugin
experiments do not write MCP config; they copy the Storybook plugin skills into
the agent's project skill directory instead. The template is responsible for
starting Storybook before the agent runs; `reshaped-storybook` does this from
`postinstall` so it runs after sandbox dependencies are installed.

Codex experiments use the direct `codex` agent with `OPENAI_API_KEY`. The
`codex-mcp` experiment cannot use `vercel-ai-gateway/codex` until the Gateway
path handles Codex's Responses namespace tool shape reliably. See
https://github.com/openai/codex/issues/26234.

### View Results

```bash
pnpm playground
```

Open [http://localhost:3000](http://localhost:3000) to browse results.

### Deploy Results Playground

The `Agent eval` GitHub Actions workflow deploys the playground to Vercel
project `storybook-evals` after eval results have been written to
`agent-eval/results`.

- Pull requests from the main repository with the `ci:eval` label create
  preview deployments.
- Manual runs on non-`main` branches create preview deployments.
- Manual runs on `main` create production deployments.

The workflow deploys from the same runner that produced `agent-eval/results`,
so failed evals can still publish a playground with partial results. The final
workflow status still fails when the eval, build, or deploy step fails.

The workflow links the Vercel project at runtime instead of committing
`.vercel/project.json`. It uses the same Vercel access token for the Sandbox
evals and the Vercel CLI preview deployment, but those are separate steps:
Sandbox auth happens in `pnpm eval`, while the preview playground deployment
runs `vercel link`, `vercel pull`, `vercel build`, and
`vercel deploy --prebuilt`.

Configure these GitHub secrets before enabling the workflow:

- `VERCEL_TOKEN`: Vercel access token with Sandbox and deploy access to the Storybook team.
- `VERCEL_TEAM_ID`: Vercel team ID or slug for the Storybook account.
- `VERCEL_PROJECT_ID`: Vercel project ID used by Vercel Sandbox access-token auth.

The thin app wrapper in `agent-eval/app` re-exports routes from
`@vercel/agent-eval-playground` so Next.js can discover them from this package.
Run `pnpm playground:check-routes` after upgrading the playground package.

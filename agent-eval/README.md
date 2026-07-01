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
   - **Sandbox access**: by default the experiments use `sandbox: 'auto'`. Set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` to use Vercel Sandbox; leave `VERCEL_TOKEN` unset to fall back to Docker.

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
pnpm exec agent-eval cc-mcp
```

Pull requests with the `ci:eval` label run all experiments in CI.

CI uses Vercel Sandbox only when the repository has `VERCEL_TOKEN`,
`VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` configured. Do not store a static
`VERCEL_OIDC_TOKEN` in GitHub secrets; development OIDC tokens expire and
Vercel-issued OIDC is only refreshed automatically inside Vercel-managed
runtime/build contexts.

Configured experiments:

- `cc-mcp`: Claude Code with project-local Storybook MCP config in `.mcp.json`.
- `codex-mcp`: Codex with project-local Storybook MCP config in `.codex/config.toml`.
- `cc-plugin`: Claude Code with Storybook plugin skills copied to `.claude/skills`.
- `codex-plugin`: Codex with Storybook plugin skills copied to `.agents/skills`.

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

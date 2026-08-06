# Agent Evaluation Suite

Runs coding agents (Claude Code and Codex) against fixture projects in sandboxes and asserts that they follow the Storybook workflows this repo ships: writing stories, previewing or reviewing them, and running story tests through the MCP server or the plugin skills.

- [Agent Evaluation Suite](#agent-evaluation-suite)
  - [Setup](#setup)
  - [Known Failures](#known-failures)
  - [Running Evals](#running-evals)
    - [View Results](#view-results)
  - [Writing Evals](#writing-evals)
    - [What makes a good eval](#what-makes-a-good-eval)
  - [Run Configurations](#run-configurations)
    - [Preview (no cost)](#preview-no-cost)
    - [Run Experiments](#run-experiments)
  - [Shared Templates](#shared-templates)
    - [Download CI Results](#download-ci-results)
    - [Deploy Results Playground](#deploy-results-playground)

## Setup

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and add your API keys (see comments in `.env.example` for options):
   - **Agent keys**: `ANTHROPIC_API_KEY` is required for the Claude Code experiments and for failure classification, both of which use the direct Anthropic API. `OPENAI_API_KEY` is required for the Codex experiments, which use the direct Codex API.
   - **Sandbox access**: this suite is configured with `sandbox: 'auto'`, which uses Vercel Sandbox when access-token credentials (`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, and `VERCEL_TOKEN`) are present and falls back to local Docker otherwise. Set `sandbox: 'docker'` to force Docker-only experiments.

## Known Failures

Accepted skips (known failures and context gates) use `test.skipIf` with a comment above the assertion in `EVAL.ts` (observed behavior, evidence, re-enable condition). When you add one, update this index:

| Eval                                                                                        | Cell                    | Gap                                       | Re-enable when                                               |
| ------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| [`801`](./evals/801-create-component-no-launch-config/EVAL.ts)                              | codex + mcp             | Intermittent skip of `get-documentation`  | Codex MCP reliably uses docs tools                           |
| [`802`](./evals/802-create-component/EVAL.ts) / [`803`](./evals/803-edit-component/EVAL.ts) | codex                   | Skips docs tools                          | Docs assertion passes on three consecutive scheduled CI runs |
| [`807`](./evals/807-docs-request/EVAL.ts)                                                   | claude-code + mcp       | Answers via `find` + Read, not docs tools | Product routes question tasks into MCP tools                 |
| [`808`](./evals/808-shared-infra-fallback/EVAL.ts)                                          | codex + mcp + review on | Often zero MCP calls after token edit     | Review-on workflow reaches Codex at turn start               |

## Running Evals

Evals can be executed manually, but also run automatically in CI. Be conscious of the token cost when running evals.

| Goal                      | Command / trigger                                                         | Approx. cost |
| ------------------------- | ------------------------------------------------------------------------- | ------------ |
| Preview matrix (no API)   | `yarn workspace agent-eval run eval:dry`                                  | Free         |
| One eval × one experiment | `EVAL_ONLY=<eval> yarn workspace agent-eval exec agent-eval <experiment>` | USD 0.30–2   |
| Default smoke test        | `yarn workspace agent-eval run eval`                                      | USD 1–3      |
| Full set                  | `EVAL_EXTRA_EVALS=1 yarn workspace agent-eval run eval`                   | USD 30–45    |
| CI, smoke test            | With label `ci:eval`                                                      | USD 1–3      |
| CI, full set              | With label `ci:eval` + `ci:extra-evals`                                   | USD 30–45    |
| CI, extra models          | With label `ci:eval` + `ci:extra-evals` + `ci:extra-models`               | USD 30–80    |

View local results with `yarn workspace agent-eval run playground`, or use the Vercel URL for CI runs. Note that a failed CI may still have published a playground with (perhaps partial) results.

### View Results

For local runs, use the below agent-eval script and open [http://localhost:3000](http://localhost:3000) to browse results.

```bash
yarn workspace agent-eval run playground
```

For CI runs, find the output of the `Agent eval` GitHub Action job, which contains the Vercel-hosted playground URL.

## Writing Evals

1. Copy a sibling under `evals/` (`PROMPT.md`, `EVAL.ts`, `package.json` with `"evals": { "template": "…" }`).
2. Structure `EVAL.ts` like other 8xx evals.
3. Register the folder name in `lib/experiment.ts`.
4. Check with `eval:dry`, then `EVAL_ONLY=<name>` on one experiment.

Accepted skips (known failures and context gates) use `test.skipIf` with a comment above the assertion (observed behavior, evidence, re-enable condition). If you add one, update the [Known Failures index](./README.md#known-failures).

### What makes a good eval

- **Clear claim:** Specify one workflow behavior under test (stated in `PROMPT.md` / top of `EVAL.ts`). Clarify which dimensions you care about.
- **Real workflow:** Describe a deliverable outcome involving Storybook functionality, not trivia the model could answer from memory.
- **Directionally clear:** Stick with mostly mechanical checks (files, tool/skill calls, story tests, review/preview). If you add a model judge, treat it as soft until it has a clear rubric.
- **Hard to game:** Include false-pass guards so skipping the intended path cannot still go green (see `805`, `810`, `811`). Use `test.skipIf` or fail loudly instead of ending with a silent no-op.
- **Skip instead of erase:** Document accepted gaps in [Known Failures](./README.md#known-failures) instead of deleting the assertion, when a desired outcome consistently fails.

## Run Configurations

Run the commands below from the repository root with `yarn workspace agent-eval run <script>`.

### Preview (no cost)

See what will run without making API calls:

```bash
yarn workspace agent-eval run eval:dry
```

### Run Experiments

Run all configured experiments:

```bash
yarn workspace agent-eval run eval
```

Run a single experiment:

```bash
yarn workspace agent-eval exec agent-eval cc-mcp-opus-high
```

Pull requests with the `ci:eval` label run experiments in CI (on label apply, not on every later push). The `ci:eval` / `ci:extra-*` / `ci:storybook-latest` / `ci:review` labels are applied by **humans only**. Labeled runs are expensive, so an AI agent must never add them (nor start `workflow_dispatch` eval runs). A successful run adds `evals:ok`; new commits clear that proof so Danger can block merge while `ci:eval` is set without `evals:ok`. Re-run by removing and re-adding `ci:eval`, or via workflow_dispatch. Agents validate locally instead: only the specific evals affected by the change (or the eval being fixed), one experiment at a time, via `EVAL_ONLY`: never a full line, never multiple experiments in parallel.

A scheduled weekly run (Monday 08:00 UTC) always executes the full 8xx/82x line on `next` with default-model experiments, deploys the playground to the Vercel production target, and posts a summary to Slack `#team-storybook`. It does not enable `EVAL_EXTRA_MODELS`, `EVAL_STORYBOOK_LATEST`, or `EVAL_REVIEW` (use `workflow_dispatch` for those). Manual `workflow_dispatch` runs on `next` also notify Slack.

Slack notify needs the repo secret `SLACK_AGENT_EVAL_WEBHOOK_URL`: create an [Incoming Webhook](https://api.slack.com/messaging/webhooks) into `#team-storybook` and store the URL as that secret. If the secret is missing, the job warns and continues.

By default only the first core eval (`801-create-component-no-launch-config`) runs. Set `EVAL_EXTRA_EVALS=1` to run the full hand-crafted line: the 8xx workflow evals on every experiment plus the lifecycle 82x evals (`storybook-init`/`storybook-upgrade` scenarios) on the plugin experiments; or `EVAL_ONLY=<name>[,<name>]` to debug specific evals one at a time:

```bash
EVAL_EXTRA_EVALS=1 yarn workspace agent-eval run eval
EVAL_ONLY=803-edit-component yarn workspace agent-eval run eval
```

A full `EVAL_EXTRA_EVALS=1` run (12 workflow evals × 4 experiments + 3 lifecycle evals × 2 plugin experiments) costs roughly **$30–45** in agent tokens at current per-run averages ($0.30–0.80 per workflow eval, $1–2 per lifecycle eval). The budget guardrail is **$75 per full run**. Check the usage metadata in the results playground before growing the eval set past it (see [storybookjs/mcp#324](https://github.com/storybookjs/mcp/pull/324)).

The 9xx evals (ports from the old `/eval` system) never run automatically; see `lib/experiment.ts`.

Experiments named `<agent>-<integration>-<model>-<effort>` pin their model and effort explicitly. Non-default model tiers (currently `cc-plugin-sonnet-medium` and `cc-mcp-sonnet-medium`) run zero evals unless `EVAL_EXTRA_MODELS=1` is set, so labeled CI runs only pay for the default-model experiments:

```bash
EVAL_EXTRA_MODELS=1 yarn workspace agent-eval exec agent-eval cc-plugin-sonnet-medium
```

Sandbox setup resolves the Storybook npm dist-tag at run time and pins the exact version it finds into the sandbox `package.json`, so each result snapshot records which version the run used. By default it pins the `next` tag and keeps the local `@storybook/addon-mcp`/`@storybook/mcp` builds from this checkout. Set `EVAL_STORYBOOK_LATEST=1` to pin the `latest` tag instead, including the published `@storybook/addon-mcp` and `@storybook/mcp` in place of the local builds, to check whether a behavior change (e.g. in the documentation tooling) regressed since the last stable release:

```bash
EVAL_STORYBOOK_LATEST=1 yarn workspace agent-eval run eval
```

Review mode follows the integration. The plugin experiments always run, and assert, the review workflow (display-review published, review section in the final response), because review is on by default for the `storybook ai` CLI channel the plugins use. The MCP experiments run review-off by default (preview-stories links, no display-review), matching direct MCP clients where the `experimentalReview` feature flag is opt-in. Set `EVAL_REVIEW=1` to enable the flag in every sandbox Storybook and flip the MCP assertions to the review workflow too:

```bash
EVAL_REVIEW=1 yarn workspace agent-eval run eval
```

In CI, opt-in labels compose with `ci:eval` (same flags exist on `workflow_dispatch`):

| Label / input                              | Effect                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `ci:extra-evals` / `extra_evals`           | Full 8xx (+ 82x on plugins) instead of the default single smoke eval             |
| `ci:extra-models` / `extra_models`         | Also run non-default model experiments (e.g. sonnet-medium)                      |
| `ci:storybook-latest` / `storybook_latest` | Pin npm `latest` (incl. published MCP packages) instead of `next` + local builds |
| `ci:review` / `review`                     | Force `experimentalReview` on and assert the review workflow for MCP cells too   |

`eval_only` (dispatch only) targets specific eval names. All of these are human-triggered spend decisions; agents never apply the labels or dispatch the workflow.

CI uses Vercel Sandbox through access-token credentials (`VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, and `VERCEL_TOKEN`). Do not store a static `VERCEL_OIDC_TOKEN` in GitHub secrets; development OIDC tokens expire and Vercel-issued OIDC is only refreshed automatically inside Vercel-managed runtime/build contexts.

Configured experiments (Claude Code experiments use the direct Anthropic API via `ANTHROPIC_API_KEY`; Codex experiments use the direct Codex API via `OPENAI_API_KEY`):

- `cc-mcp-opus-high`: Claude Code (Opus at high effort) with project-local Storybook MCP config in `.mcp.json`.
- `cc-plugin-opus-high`: Claude Code (Opus at high effort) with Storybook plugin skills copied to `.claude/skills`.
- `codex-mcp-gpt-5.5-medium`: Codex (gpt-5.5 at medium reasoning effort) with project-local Storybook MCP config in `.codex/config.toml`.
- `codex-plugin-gpt-5.5-medium`: Codex (gpt-5.5 at medium reasoning effort) with Storybook plugin skills copied to `.agents/skills`.
- `cc-mcp-sonnet-medium` / `cc-plugin-sonnet-medium`: Claude Code (Sonnet at medium effort) variants; they run zero evals unless `EVAL_EXTRA_MODELS=1` is set.

## Shared Templates

Fixtures can opt into a shared starter project with package metadata:

```json
{
	"evals": {
		"template": "reshaped-storybook"
	}
}
```

Templates live in `agent-eval/templates/<template-name>` and are copied into the sandbox during setup before the agent runs. They intentionally stay visible in saved result project snapshots so eval runs are easy to inspect.

Three templates exist today:

- `reshaped-storybook`: the design-system shape: Reshaped components, full Storybook (`next`) with the local addon builds, MSW, and the vitest story test setup.
- `vite-app`: a minimal React + Vite app with **no Storybook at all**. The lifecycle fixtures use it directly (820 init) or layer an old Storybook on top (821/822 upgrades and 823 setup-on-outdated, which also set `evals.pinStorybook: false` so the harness keeps their intentionally outdated versions); 812 layers a full Storybook `next` setup with zero stories on top.
- `monorepo`: an npm-workspaces repo where the runnable Storybook lives in the `packages/ui` leaf, so evals can cover agents working inside a workspace package. Storybook pinning and the local `file:` build detection cover workspace package.json files too.

This keeps prompt variants small: each variant keeps its own `PROMPT.md`, `EVAL.ts`, and metadata `package.json`, while shared app files stay in the template.

Templates can use local built Storybook MCP packages with npm `file:` dependencies, for example `file:./local-packages/addon-mcp`. The setup step copies `code/addons/mcp/dist` and `code/lib/mcp/dist` from this checkout into the sandbox before the sandbox runs `npm install`. CI builds those packages before running evals; run `yarn nx run-many -t compile --projects mcp,addon-mcp` locally after changing those packages.

The MCP experiments configure each agent through its project-local MCP file: Claude Code gets `.mcp.json`, and Codex gets `.codex/config.toml`. The plugin experiments do not write MCP config; they copy the Storybook plugin skills into the agent's project skill directory instead. The template is responsible for starting Storybook before the agent runs; `reshaped-storybook` does this from `postinstall` so it runs after sandbox dependencies are installed.

Codex experiments use the direct `codex` agent with `OPENAI_API_KEY`. The `codex-mcp` experiment cannot use `vercel-ai-gateway/codex` until the Gateway path handles Codex's Responses namespace tool shape reliably. See https://github.com/openai/codex/issues/26234.

### Download CI Results

Pull the eval results produced by recent CI runs into the local `agent-eval/results` directory, so they can be browsed in the local playground and inspected by analysis tooling:

```bash
yarn workspace agent-eval run results:download        # latest 20 agent-eval-results artifacts
yarn workspace agent-eval run results:download 5      # or any count between 1 and 100
```

Requires an authenticated GitHub CLI (`gh auth login`) and a `tar` binary (preinstalled on macOS and Linux). Result snapshots are keyed by experiment name and run timestamp, so artifacts from multiple CI runs merge into `agent-eval/results` without colliding, and re-running the command is idempotent. Each artifact is roughly 20–40 MB extracted.

### Deploy Results Playground

The `Agent eval` GitHub Actions workflow deploys the playground to Vercel project `storybook-evals` after eval results have been written to `agent-eval/results`.

- Pull requests from the main repository with the `ci:eval` label create preview deployments.
- Manual runs on non-`main` branches create preview deployments.
- Manual runs on `main` create production deployments.

The workflow deploys from the same runner that produced `agent-eval/results`, so failed evals can still publish a playground with partial results. The final workflow status still fails when the eval, build, or deploy step fails.

The workflow links the Vercel project at runtime instead of committing `.vercel/project.json`. It uses the same Vercel access token for the Sandbox evals and the Vercel CLI preview deployment, but those are separate steps: Sandbox auth happens in `yarn workspace agent-eval run eval`, while the preview playground deployment runs `vercel link`, `vercel pull`, `vercel build`, and `vercel deploy --prebuilt`.

Configure these GitHub secrets before enabling the workflow:

- `VERCEL_TOKEN`: Vercel access token with Sandbox and deploy access to the Storybook team.
- `VERCEL_TEAM_ID`: Vercel team ID or slug for the Storybook account.
- `VERCEL_PROJECT_ID`: Vercel project ID used by Vercel Sandbox access-token auth.

The thin app wrapper in `agent-eval/app` re-exports routes from `@vercel/agent-eval-playground` so Next.js can discover them from this package. Run `yarn workspace agent-eval run playground:check-routes` after upgrading the playground package.

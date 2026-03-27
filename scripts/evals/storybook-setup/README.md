# Storybook Setup Eval Harness

This harness evaluates post-`storybook init` setup prompts against real React/Vite repositories.

It is intentionally closer to the `storybookjs/mcp` eval suite than to a one-off benchmark script:

- real benchmark definitions
- prompt variants
- normalized agent/model adapters
- one trial directory per run
- structured JSON artifacts for later comparison

The main difference is that this harness starts from a freshly cloned real repository, removes any existing Storybook state, runs `npx storybook@latest init --yes`, checkpoints that exact baseline, and only then runs the setup prompt through an agent.

## Why this shape

The current design follows a few principles that are now standard in stronger agent-eval systems:

- Keep tasks representative and end-to-end rather than synthetic.
- Use deterministic execution-based checks wherever possible.
- Preserve the exact starting state so you can compare a real baseline against the agent run.
- Treat public benchmark contamination as a risk, so prefer fresh real repos over static gold-patch tasks.

This is aligned with:

- Terminal-Bench’s task + execution harness model: [docs](https://www.tbench.ai/docs)
- OpenAI’s analysis of benchmark contamination and narrow/wide tests in SWE-bench Verified: [article](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)
- Anthropic’s guidance on representative, high-signal technical evaluations: [article](https://www.anthropic.com/engineering/AI-resistant-technical-evaluations)
- SWE-Skills-Bench’s fixed-commit, acceptance-criteria, deterministic-verification setup: [paper](https://arxiv.org/abs/2603.15401)

## Benchmarks

The default benchmark set currently contains:

- `mealdrop`
- `edgy`
- `wikitok`
- `baklava`
- `echarts-react`
- `evergreen-ci`

Each benchmark stores:

- repository URL
- optional branch override
- optional nested `projectDir`
- a short description
- tags for filtering and later analysis

## Agents and tiers

The harness currently supports:

- `claude-code`
- `codex-cli`

And normalizes them into three tiers:

- `opus`
- `sonnet`
- `haiku`

Those tiers map to provider-specific models:

- Claude: `claude-opus-4.6`, `claude-sonnet-4.6`, `claude-haiku-4.5`
- Codex: `gpt-5.4`, `gpt-5-codex`, `gpt-5-codex-mini`

You can also override the exact model slug with `--model`.

## Trial lifecycle

Each `run` trial does this:

1. Clone the benchmark repo into a dedicated trial directory.
2. Remove existing Storybook files, sample stories, Storybook deps, and Storybook scripts.
3. Install repository dependencies with the repo’s package manager.
4. Run `npx storybook@latest init --yes` in the benchmark’s target directory.
5. Run one more package-manager install so the post-init dependency graph is actually materialized.
6. Commit that post-init state as the local baseline checkpoint.
7. Generate the prompt with benchmark context and candidate component suggestions.
8. Execute the setup prompt through Claude Code or Codex.
9. Grade the final repo with:
   - `storybook build`
   - ghost-stories before/after metrics in isolated grading copies
   - diff-based Storybook file summaries
   - setup-pattern detection

The default artifact root is `../storybook-setup-evals/`.

## Commands

List the configured benchmarks, variants, and model options:

```bash
yarn --cwd scripts eval:storybook-setup list
```

Prepare a benchmark but stop before the agent run:

```bash
yarn --cwd scripts eval:storybook-setup run \
  --benchmark mealdrop \
  --agent codex-cli \
  --prepare-only
```

Run a full Codex trial:

```bash
yarn --cwd scripts eval:storybook-setup run \
  --benchmark edgy \
  --agent codex-cli \
  --tier sonnet \
  --variant baseline
```

Run a full Claude trial:

```bash
yarn --cwd scripts eval:storybook-setup run \
  --benchmark baklava \
  --agent claude-code \
  --tier opus \
  --variant strict-self-heal
```

## Output format

Each trial writes a structured `result.json` artifact with:

- benchmark metadata
- prompt variant metadata
- agent/model/tier metadata
- environment details
- cleanup/install/init/post-init-install records
- baseline commit hash
- candidate component list
- agent execution summary
- changed-file summary
- Storybook-file diff summary
- detected setup patterns
- Storybook build result
- ghost-stories before/after result
- artifact paths

High-value fields for prompt experiments include:

- `execution.validationCommands`
- `changes.storybookFiles`
- `changes.setupPatterns`
- `grading.ghostStories.before.summary.successRateWithoutEmptyRender`
- `grading.ghostStories.after.summary.successRateWithoutEmptyRender`
- `execution.costUsd`
- `execution.turns`

## Notes

- The ghost-stories grading step is intentionally best-effort. It runs in isolated grading copies and may skip when the benchmark environment cannot support the required Vitest/browser setup.
- `storybook build` is treated as the hard pass/fail setup check because it validates the actual Storybook config left by the agent.
- The prompt variants are deliberately file-based so future experiments can add or remove hints without changing the runner.

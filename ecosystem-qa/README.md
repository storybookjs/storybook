# Ecosystem QA

An agent upgrades a real project to a Storybook prerelease, runs a fixed set of checks, and reports findings.
The harness prepares the run, times it, captures evidence and parses the agent's answer.
It never decides whether something is a bug; the agent does, following `prompts/upgrade.md`.

```
catalog.json ──> run.ts ──> results/<repo>/<os>/<engine>/result.json ──> collect.ts ──> proposals.json ──> file.ts
                  │ clone, Sandcastle,                                    │ fingerprint,                     │ --dry: Step Summary
                  │ agent in a sandbox                                    │ dedupe, qa:known                 │ else: issue or comment
```

The checks the agent must report live in `checks.ts`.
The same list renders into the prompt and validates the agent's answer, so the agent cannot invent a check id.

## Run it locally

Install from the repo root with `yarn install`.
Then run one repo from the repo root:

```sh
ANTHROPIC_API_KEY=... node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.0 \
  --engine claude --sandbox seatbelt --out ecosystem-qa/results/mealdrop/macos/claude
```

Pick the sandbox for your machine:

- `--sandbox seatbelt` on macOS.
- `--sandbox bwrap` on Linux.
- `--sandbox docker` on Linux with the image built first: `docker build --build-arg AGENT_UID=$(id -u) --build-arg AGENT_GID=$(id -g) -t sb-ecosystem-qa ecosystem-qa`.
- `--sandbox none` runs the agent on the host with your environment, so use it only for a trusted owned repo.

Codex runs read `CODEX_API_KEY` and default to `gpt-6.1-sol`; pass `--model` to change it.
Claude's cost comes from its own result line.
Codex, and a Claude run that ended without one, is priced from the price table in `agent-eval/lib/usage.ts`, which both harnesses share; a run priced that way says so in its summary.
The repo is cloned to `ecosystem-qa/work/<id>` by default, and the run stops if that directory already exists.

Then collect and look at the proposals without filing anything:

```sh
node ecosystem-qa/collect.ts --results ecosystem-qa/results --version 11.0.0-beta.0 --out ecosystem-qa/results/proposals.json --repo storybookjs/storybook
node ecosystem-qa/file.ts --proposals ecosystem-qa/results/proposals.json --repo storybookjs/storybook --dry
```

`collect.ts` calls `gh search issues`, so it needs a logged-in `gh`.

To exercise collect and file without an agent or an API key, use the fake engine.
It writes a canned result with one finding and a real PNG and GIF made by the evidence tools:

```sh
ECOSYSTEM_QA_FAKE=1 node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.0 \
  --engine fake --sandbox none --out ecosystem-qa/results/mealdrop/macos/claude
```

## Run it in CI

Start the `Ecosystem QA` workflow by hand and pick the repo, version, engines and operating systems.
Linux runs the agent in `docker()`; Windows runs it with `noSandbox()`, and the API key is the only secret in that job.
Each runner uploads `qa-result-<os>-<engine>` with `result.json`, the run log, the raw agent stream, the session, the evidence and the cycle branch bundle.
Its Step Summary shows the status, wall time, tokens, dollars and free disk.

## Where results land

`<out>/result.json` is the record of one run, and every later stage reads only these files.
Next to it are `run.log`, `agent-stream.jsonl` (the token counts come from here), `session.jsonl`, `evidence/` and `cycle.bundle` when the agent committed.
Dollars come from Claude's result line or the shared price table; a model missing from the table gives `usd: null`.

## Dry mode

Dry mode is the default.
The filer writes each proposal, with its full issue body and the evidence it would upload, to the Step Summary and changes nothing.
Without dry mode it pushes the evidence to the `qa-assets` branch with the job token, pushes the cycle branch to the catalog repo with `ECOSYSTEM_QA_PUSH_TOKEN` from the `ecosystem-qa` environment, and files the issue in milestone 11.
A fingerprint that is already on an issue becomes a comment, and one on a `qa:known` issue is suppressed.
It checks first that the milestone is open and every label exists, and files nothing otherwise.
A proposal that fails does not stop the others; the job writes a filed and failed table to the Step Summary and fails at the end.
Rerunning the job is safe: a filed fingerprint and a repeated comment are skipped, and evidence already on `qa-assets` makes no new commit.

# Ecosystem QA

An agent upgrades a real project to a Storybook prerelease, runs a fixed set of checks, and reports findings.
The harness prepares the run, times it, captures evidence and parses the agent's answer.
It never decides whether something is a bug; the agent does, following `prompts/upgrade.md`.

```
catalog.json ──> run.ts ──> results/<repo>/<os>/<engine>/result.json ──> collect.ts ──> proposals.json ──> file.ts
                  │ clone, Sandcastle,                                    │ fingerprint,                     │ --dry: Step Summary
                  │ agent in a sandbox                                    │ dedupe, qa:known                 │ else: issue or comment
```

The full manual QA checklist for Storybook 11 is `references/basic-qa.md`, derived from this repo's migration guide, changelog, docs and E2E specs; humans use it in a bug bash.
The checks the agent can run live in `checks.ts`; the checklist's Agent column maps each row to its id, or says which monorepo test already proves it or why a person has to judge it, and `lib/checks.test.ts` keeps the two in sync.
The same list renders into the prompt and validates the agent's answer, so the agent cannot invent a check id.

## Why a third agent harness

The repo already runs agents in two places.
[`scripts/eval/`](../scripts/eval/README.md) grades how well an agent sets up Storybook and writes stories in benchmark repos, running the agent CLI in a worktree on the host and publishing draft PRs.
[`agent-eval/`](../agent-eval/README.md) asserts that agents follow this repo's Storybook workflows on fixture projects, in a Vercel Sandbox or Docker through `@vercel/agent-eval`.
Neither fits an upgrade sweep over real projects.
The sweep has to cover Windows, which a Linux container cannot, so there the agent runs on the GitHub runner host.
A local run of an untrusted repo needs a native sandbox, bwrap on Linux or seatbelt on macOS, which Sandcastle provides next to Docker.
The answer is a schema-checked JSON object, and Sandcastle sends a malformed one back to the agent up to twice.
Each run keeps the agent session, so a finding can be reopened with `claude --resume`.

## Run it locally

Install from the repo root with `yarn install`.
Then run one repo from the repo root:

```sh
ANTHROPIC_API_KEY=... node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.0 \
  --engine claude --sandbox seatbelt --out ecosystem-qa/results/mealdrop/macos/claude
```

Pick the sandbox for your machine:

- `--sandbox docker` wherever Docker runs, with the image built first: `docker build --build-arg AGENT_UID=$(id -u) --build-arg AGENT_GID=$(id -g) -t sb-ecosystem-qa ecosystem-qa`. This is the one sandbox that covers every check, and the one CI uses.
- `--sandbox seatbelt` on macOS covers the upgrade, build and CLI checks only. Its profile denies Chromium the Mach port it registers at launch, so screenshots and HMR checks come back `skip`, and the agent's shells inherit launchd's 256 open-file limit, which breaks the file watcher.
- `--sandbox bwrap` on Linux.
- `--sandbox none` runs the agent on the host with your environment. `run.ts` refuses it for a repo that is not `owned`, except on Windows for a repo the catalog marks `windows`: there no sandbox exists, and the mark is the reviewed list of exceptions.

To bill your Claude subscription instead of an API key, run `claude setup-token` once and pass the result as `CLAUDE_CODE_OAUTH_TOKEN` in place of `ANTHROPIC_API_KEY`; the native sandboxes hide the login in `~/.claude`, so the token is the only way in.
Codex runs read `CODEX_API_KEY` and default to `gpt-6.1-sol`; pass `--model` to change it.
The default for Claude is Haiku 5.5 at low effort: on mealdrop it found every known finding of the extended tier in two runs for about $0.50 and 18 minutes, where Sonnet 5.5 at medium took $1.01 and 25 minutes for the same five, and Opus 5.5 at low $1.71. Pass `--model` and `--effort` to compare.
Claude's cost comes from its own result line.
Codex, and a Claude run that ended without one, is priced from the price table in `agent-eval/lib/usage.ts`, which both harnesses share; a run priced that way says so in its summary.
A model missing from that table gives `usd: null`.
The repo is cloned under the temp directory (`<tmpdir>/ecosystem-qa/work/<id>`) by default, outside the monorepo so no monorepo config file sits above it, and the run stops if that directory already exists. Pass `--clone-dir` to put it elsewhere.

Then collect and look at the proposals without filing anything:

```sh
node ecosystem-qa/collect.ts --results ecosystem-qa/results --version 11.0.0-beta.0 --out ecosystem-qa/results/proposals.json --repo storybookjs/storybook
node ecosystem-qa/file.ts --proposals ecosystem-qa/results/proposals.json --repo storybookjs/storybook --dry
```

Only the workflow is dry by default, through its `dry` input. The filer itself files for real unless `--dry` is passed, so keep the flag on a local run.

`collect.ts` calls `gh search issues`, so it needs a logged-in `gh`.

To exercise collect and file without an agent or an API key, add `--fake`.
It writes a canned result with one finding and a real PNG and GIF made by the evidence tools, recorded as `fake: true` at no cost:

```sh
ECOSYSTEM_QA_FAKE=1 node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.0 \
  --engine claude --fake --sandbox none --out ecosystem-qa/results/mealdrop/macos/claude
```

## Run it in CI

Start the `Ecosystem QA` workflow by hand and pick the repo, version, engines and operating systems.
Linux runs the agent in `docker()`; Windows runs it with `noSandbox()`, and the API key is the only secret in that job.
The agent keys live in the `ecosystem-qa` environment, and the push token in `ecosystem-qa-file`, which only the filing job enters.
Each runner uploads `qa-result-<os>-<engine>` with `result.json`, the run log, the raw agent stream, the session, the evidence and the cycle branch bundle.
`run.ts` writes the status, wall time, tokens, dollars, free disk and every check to the Step Summary.

A pull request that touches `ecosystem-qa/` or the workflow runs only the smoke job: typecheck, tests and a fake run through collect and a dry filing, with no environment and no secrets.

## Where results land

`<out>/result.json` is the record of one run, and every later stage reads only these files.
Next to it are `run.log`, `agent-stream.jsonl` (the token counts come from here), `session.jsonl`, `evidence/` and `cycle.bundle` when the agent committed.

## Dry mode

Dry mode is the default.
The filer writes each proposal, with its full issue body and the evidence it would upload, to the Step Summary and changes nothing.
Without dry mode it pushes the evidence to the `qa-assets` branch with the job token, pushes the upgraded state to the catalog repo with `ECOSYSTEM_QA_PUSH_TOKEN` from the `ecosystem-qa-file` environment, and files the issue in milestone 11.
The upgraded state lands under `refs/qa/`, never as a branch: a branch push would start the catalog repo's own workflows and run the agent's commits with that repo's secrets before anyone read the diff.
The issue body carries the fetch command, and the one push that turns the ref into a branch once a person has looked at it.
A fingerprint that is already on an issue becomes a comment, and one on a `qa:known` issue is suppressed.
It checks first that the milestone is open and every label exists, and files nothing otherwise.
A proposal that fails does not stop the others; the job writes a filed and failed table to the Step Summary and fails at the end.
Rerunning the job is safe: a filed fingerprint and a repeated comment are skipped, and evidence already on `qa-assets` makes no new commit.

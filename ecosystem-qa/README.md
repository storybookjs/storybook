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

- `--sandbox docker` wherever Docker runs, with the image built first: `docker build --build-arg AGENT_UID=$(id -u) --build-arg AGENT_GID=$(id -g) -t sb-ecosystem-qa ecosystem-qa`. This is the one sandbox that covers every check, and the one CI uses. The image carries `n`, a C/C++ compiler and `mise`, and before the install the runner switches to the Node version the project asks for and writes what happened as the first line of `install.log`. Only this sandbox can switch Node: with any other, a catalog entry's `node` is ignored and the runner prints a warning. A failed install does not end the run: the exit status and log go to the evidence directory, and the agent repairs the environment before it starts. The runner limits this run's container to 85% of the Docker daemon's memory and writes what it did to `memory-limit.txt` in the evidence directory, so a build that takes everything is ended inside the container and the agent sees exit status 137; without the limit the host starves, and a GitHub runner then ends the job with "lost communication" and no result.
- `--sandbox seatbelt` on macOS covers the upgrade, build and CLI checks only. Its profile denies Chromium the Mach port it registers at launch, so screenshots and HMR checks come back `skip`, and the agent's shells inherit launchd's 256 open-file limit, which breaks the file watcher.
- `--sandbox bwrap` on Linux.
- `--sandbox none` runs the agent on the host with your environment, so use it only for a trusted owned repo. The release-age gates below are off here too, so an install the agent runs on your machine skips the project's own gate. The Windows cells in CI use this mode, on a runner that is discarded after the job.

Every sandbox runs the agent with the release-age gates of yarn, pnpm and npm set to zero, because the prerelease under test is only days old and the sandbox exists to run fresh packages.

To bill your Claude subscription instead of an API key, run `claude setup-token` once and pass the result as `CLAUDE_CODE_OAUTH_TOKEN` in place of `ANTHROPIC_API_KEY`; the native sandboxes hide the login in `~/.claude`, so the token is the only way in.
Codex runs read `CODEX_API_KEY` and default to `gpt-6.1-sol`; pass `--model` to change it.
The default for Claude is Haiku 5.5 at low effort: on mealdrop it found every known finding of the extended tier in two runs for about $0.50 and 18 minutes, where Sonnet 5.5 at medium took $1.01 and 25 minutes for the same five, and Opus 5.5 at low $1.71. Pass `--model` and `--effort` to compare.
Claude's cost comes from its own result line.
Codex, and a Claude run that ended without one, is priced from the price table in `agent-eval/lib/usage.ts`, which both harnesses share; a run priced that way says so in its summary.
A model missing from that table gives `usd: null`.
The repo is cloned under the temp directory (`<tmpdir>/ecosystem-qa/work/<id>`) by default, outside the monorepo so no monorepo config file sits above it, and the run stops if that directory already exists. Pass `--clone-dir` to put it elsewhere.
Tier 1 entries are forks under `storybook-tmp` whose `qa/base` branch is pinned at an upstream commit, and the runner fetches that start commit only, without its history.

Then collect and look at the proposals without filing anything:

```sh
node ecosystem-qa/collect.ts --results ecosystem-qa/results --version 11.0.0-beta.0 --out ecosystem-qa/results/proposals.json --repo storybookjs/storybook
node ecosystem-qa/file.ts --proposals ecosystem-qa/results/proposals.json --repo storybookjs/storybook --dry
```

Only the workflow is dry by default, through its `dry` input. The filer itself files for real unless `--dry` is passed, so keep the flag on a local run.

`collect.ts` lists the issues that carry the `internal-qa` label, so it needs a logged-in `gh`.

### Group findings by root cause

`group.ts` asks Claude which fingerprints of a collect share a root cause, and which listed QA issue each group resembles, and writes the answer as `groups.json`:

```sh
node ecosystem-qa/group.ts --results ecosystem-qa/results --version 11.0.0-beta.0 --repo storybookjs/storybook --out ecosystem-qa/results/groups.json
node ecosystem-qa/collect.ts --results ecosystem-qa/results --version 11.0.0-beta.0 --out ecosystem-qa/results/proposals.json --repo storybookjs/storybook --groups ecosystem-qa/results/groups.json
```

It is one Messages API request with a schema-checked answer and no tools, so text the agents wrote inside a third-party repository can at worst produce a wrong grouping.
A wrong grouping is not harmless: it reports a finding on the issue of another one, so the dry run lists every member of a group.
It cannot silence a finding: a group is suppressed only when each member's own fingerprint is on a known issue.
The model only says which fingerprints belong together; none of its text reaches an issue, and `collect.ts` checks the file again before it uses it.
It sends the titles, actual results and error texts of the findings, capped, to the Anthropic API.
Of the QA issues it sends the titles, and for an open issue the harness filed also the start of its bug description and the findings already merged into it: a title names one symptom, and a later run words the same defect differently. Sightings that were added as comments are not sent.
It reads `ANTHROPIC_API_KEY`; the subscription token from `claude setup-token` that agent runs accept does not work for the Messages API.
The key is optional on a local run: without it nothing is grouped, each fingerprint stays on its own, and `collect.ts` makes one proposal per fingerprint.
In GitHub Actions a missing key is an error, because a sweep that files ungrouped creates one issue per fingerprint.
A key that is set but rejected is an error everywhere.
With at most one fingerprint it never calls the API.
`collect.ts` works without it: leave out `--groups`, or pass a `groups.json` written by hand.

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

The collect job runs `group.ts` with the key from the `ecosystem-qa` environment, then collects with its `groups.json` and uploads both files as `qa-proposals`.
To collect again without running any agent, set `from_runs` to a comma-separated list of earlier run ids: the job fetches their `qa-result-*` artifacts with `fetch-runs.ts`, the run that started last winning where two hold the same repo, OS and engine, and groups and collects those.
It takes only runs of this workflow that were started by hand, on the default branch or on the branch the collecting run itself runs on, and stops before it downloads anything when one of the ids is anything else.
Any run of the repository can upload an artifact with the name of a result, also the run of a pull request from a fork, and the filing job pushes and files what the results say.
It uploads them again as `qa-earlier-results`, so the filing job finds their evidence and cycle bundles.
To split a wrong merge, or to collect when the model is unavailable, paste a `groups.json` document into `groups`; the job uses it instead of asking the model.
Two requests over the same findings can group a borderline pair differently, so start the run that files with the `groups.json` of the dry run you reviewed.

A pull request that touches `ecosystem-qa/` or the workflow runs only the smoke job: typecheck, tests and a fake run through collect and a dry filing, with no environment and no secrets.

## Where results land

`<out>/result.json` is the record of one run, and every later stage reads only these files.
Next to it are `run.log`, `agent-stream.jsonl` (the token counts come from here), `session.jsonl`, `evidence/` and `cycle.bundle` when the agent committed.
A run needs an output directory of its own: `run.ts` stops when `--out` holds anything, so that the log, the agent stream and the evidence of an earlier run are never read as this run's.
When the sandbox fails after the agent has finished, for example because its worktree cannot be deleted, the runner reads the answer from `run.log`.
The record then has status `ok` and names the sandbox error in `recoveredFrom`.
A run whose agent did not finish is never read this way.

## Dry mode

Dry mode is the default.
The filer writes each proposal, with its full issue body and the evidence it would upload, to the Step Summary and changes nothing.
Without dry mode it pushes the evidence to the `qa-assets` branch with the job token, pushes the upgraded state to the catalog repo with the push token of the target's org, and files the issue in milestone 11.
That is `ECOSYSTEM_QA_PUSH_TOKEN` for `storybookjs` and `ECOSYSTEM_QA_PUSH_TOKEN_STORYBOOK_TMP` for `storybook-tmp`, both from the `ecosystem-qa-file` environment.
The upgraded state lands under `refs/qa/`, never as a branch: a branch push would start the catalog repo's own workflows and run the agent's commits with that repo's secrets before anyone read the diff.
The issue body carries the fetch command, and the one push that turns the ref into a branch once a person has looked at it.
The collector proposes one finding per root cause: `--groups groups.json` lists which fingerprints belong together, and without it every fingerprint is its own group.
A group only decides which fingerprints merge; the proposal takes its text and evidence from the group's first member and lists the others under "Also seen as".
A wrong merge is split by editing `groups.json` and collecting again, without rerunning the sweep.
To leave a finding out because it is not a bug to file, give its group a `skip` with the reason in `groups.json`: nothing is filed for it, and the dry run and the Step Summary show the reason.
Only a person can skip a group, the model's answer has no such field.
A group with a fingerprint on an open issue becomes a comment there.
A group is suppressed only when every one of its fingerprints is on a `qa:known` issue, or on an issue that was fixed after the tested prerelease was published: a grouping can merge findings, it can never hide one.
When only some of them are, the whole group is reported, so the other findings appear on the open issue or in a new one.
A group that matches an issue only by similarity (`existingIssue`) becomes a comment on it while it is open, even when that issue is `qa:known`, because only an exact fingerprint suppresses.
A fingerprint that an open issue already carries stays on that issue: the collector rejects a grouping that puts it in a group with a fingerprint of another open issue, or in a group that names another issue, and says which group to split.
The metadata of an issue lists every fingerprint of its group, so a later sweep finds it by any of them.
Only the metadata block that ends an issue body or a comment counts: the same digits in the text above it tie nothing to the issue, because that text can come from an agent and every fingerprint is public.
To tie a fingerprint to an issue by hand, add it to the `fingerprints:` line of the block in the issue body.
A comment lists the fingerprints of its group the same way, and the collector reads the comments that the workflow account wrote on each listed issue, so a fingerprint that joined an issue through a comment is found too.
A comment by anyone else never ties a fingerprint to an issue.
An issue closed as completed after the tested prerelease was published counts as known for that version, because the fix is not in it yet; the collector reads the publish date from the `v<version>` release of `--repo`.
Silence needs the fingerprint here too.
A group that only resembles such an issue, or of which only some findings are on it, becomes a comment on that closed issue: the comment says that the tested version does not have the fix yet, and it ties the group's fingerprints to the issue, so the next sweep of that version is silent by the rule above.
An issue closed before that, or closed for any other reason, does not count: the bug came back, so it is filed again with a link to the closed issue.
An issue counts as already filed only while it carries the `internal-qa` label.
It checks first that the milestone is open and every label exists, and files nothing otherwise.
A proposal that fails does not stop the others; the job writes a filed and failed table to the Step Summary and fails at the end.
Rerunning the job is safe: an issue it already created and a repeated comment are skipped, and evidence already on `qa-assets` makes no new commit.
When an open issue with one of a proposal's fingerprints appeared after the collect, for example from another sweep, no second issue is created: what that issue lacks goes on it as a comment.
Filing the same results again from another run, for example with `from_runs`, is safe too.
A sighting is one finding of a group in one agent run: its fingerprint with that run's repo, commit, system, engine and version, whichever run collected it.
The metadata of an issue or comment lists the keys of its sightings, and a proposal adds a comment only when the issue lacks at least one of them.
So the same findings in another order, or split into other groups, add nothing, and a finding that a new repo reports gets its comment.
A later agent run of the same repo has another commit, so it is a new sighting and gets its comment.
A run in which the agent committed nothing looks like the run before it on the same start commit, so it is not reported again.
An issue or comment written before sightings had keys is compared as a whole, by its fingerprints, version, repo, commit, systems, engines and models.
Such a block names one repo and commit, so it stands only for a proposal from a single run.
A group that spans several runs is reported once more on such an issue, which is safer than losing a sighting.

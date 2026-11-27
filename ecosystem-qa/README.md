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

- `--sandbox docker` wherever Docker runs, with the image built first: `docker build --build-arg AGENT_UID=$(id -u) --build-arg AGENT_GID=$(id -g) -t sb-ecosystem-qa ecosystem-qa`. This is the one sandbox that covers every check, and the one CI uses. The image carries `n`, a C/C++ compiler, `mise`, and the Playwright MCP server, which Claude Code and Codex load from their user config, so the agent can click and type in a page and save its screenshots to `browser/` in the evidence directory. The browser server blocks direct requests to a host other than `localhost` and `127.0.0.1`. It follows a redirect from `localhost` to another host and lets a WebSocket to another host through, so it is no security boundary. The image denies the agent the browser tools that run a script in the page or install a browser. Claude Code in the sandbox also starts the MCP servers that the tested project names in its own configuration, such as a `.mcp.json`, so that list covers the browser server of the image only. It keeps an agent from a mistake and does not contain a project. Before the install the runner switches to the Node version the project asks for and writes what happened as the first line of `install.log`. Only this sandbox can switch Node: with any other, a catalog entry's `node` is ignored and the runner prints a warning. A failed install does not end the run: the exit status and log go to the evidence directory, and the agent repairs the environment before it starts. The runner limits this run's container to 85% of the Docker daemon's memory and writes what it did to `memory-limit.txt` in the evidence directory, so a build that takes everything is ended inside the container and the agent sees exit status 137; without the limit the host starves, and a GitHub runner then ends the job with "lost communication" and no result.
- `--sandbox seatbelt` on macOS covers the upgrade, build and CLI checks only. Its profile denies Chromium the Mach port it registers at launch, so screenshots and HMR checks come back `skip`, and the agent's shells inherit launchd's 256 open-file limit, which breaks the file watcher.
- `--sandbox bwrap` on Linux.
- `--sandbox none` runs the agent on the host with your environment. `run.ts` refuses it for a repo that is not `owned`, except on Windows for a repo the catalog marks `windows`: there no sandbox exists, and the mark is the reviewed list of exceptions. The release-age gates below are off here too, so an install the agent runs on your machine skips the project's own gate. The Windows cells in CI use this mode, on a runner that is discarded after the job.

Every sandbox runs the agent with the release-age gates of yarn, pnpm and npm set to zero, because the prerelease under test is only days old and the sandbox exists to run fresh packages.

To bill your Claude subscription instead of an API key, run `claude setup-token` once and pass the result as `CLAUDE_CODE_OAUTH_TOKEN` in place of `ANTHROPIC_API_KEY`; the native sandboxes hide the login in `~/.claude`, so the token is the only way in.
Codex runs read `CODEX_API_KEY` and default to `gpt-6.1-sol`; pass `--model` to change it.
The default for Claude is Haiku 5.5 at low effort: on mealdrop it found every known finding of the extended tier in two runs for about $0.50 and 18 minutes, where Sonnet 5.5 at medium took $1.01 and 25 minutes for the same five, and Opus 5.5 at low $1.71. Pass `--model` and `--effort` to compare.
Claude's cost comes from its own result line.
Codex, and a Claude run that ended without one, is priced from the price table in `agent-eval/lib/usage.ts`, which both harnesses share; a run priced that way says so in its summary.
A model missing from that table gives `usd: null`.
The agent judges a break against the migration guide of the version under test: `run.ts` loads `MIGRATION.md` at the tag `v<version>` of storybookjs/storybook, so a sweep from a branch behind `next` does not read an old guide.
A version without such a tag, a canary for example, gets the guide of this checkout, and `migrationGuide` in `result.json` says which one was read.
A run of a build reads the guide at the commit of the build.
The repo is cloned under the temp directory (`<tmpdir>/ecosystem-qa/work/<id>`) by default, outside the monorepo so no monorepo config file sits above it, and the run stops if that directory already exists. Pass `--clone-dir` to put it elsewhere.
Tier 1 entries, and tier 2 entries with a `pushTo`, are forks under `storybook-tmp` whose `qa/base` branch is pinned at an upstream commit, and the runner fetches that start commit only, without its history.
An entry without `pushTo` that is not owned is a repo that a QA plan discovered: its `ref` is a full upstream commit, it never runs on Windows, and nothing is pushed for it, so the upgraded state of such a run stays in the `cycle.bundle` of its artifact.
Every entry carries `tags`: the framework package, its builder, the Storybook major and the feature addons of its Storybook directory, as `pin.ts` prints them for the pinned commit.

To pin a repo, probe it without cloning anything:

```sh
node ecosystem-qa/pin.ts dnum-mi/vue-dsfr >> pins.jsonl
```

It prints one line of JSON with the commit, the package manager, each Storybook directory with its version range, framework packages and feature addons, the stars, the last push and the archived flag.
GitHub truncates the file tree of a very large repository, and then `--dir` names the Storybook directory to read.
With a line in `pins.jsonl` for every tier 2 entry, `ecosystem-qa/tools/fork-tier2.sh pins.jsonl` forks each one with a `pushTo` into `storybook-tmp` and creates its `qa/base` at the commit of its line, and `--dry` before the file prints the calls without making any write.
Run it twice and the second run changes nothing; it stops where a `qa/base` exists at another commit, because it never moves one.

Then collect and look at the proposals without filing anything:

```sh
node ecosystem-qa/collect.ts --results ecosystem-qa/results --version 11.0.0-beta.0 --out ecosystem-qa/results/proposals.json --repo storybookjs/storybook
node ecosystem-qa/file.ts --proposals ecosystem-qa/results/proposals.json --repo storybookjs/storybook --dry
```

Only the workflow is dry by default, through its `dry` input. The filer itself files for real unless `--dry` is passed, so keep the flag on a local run.

`collect.ts` and the dry run of `file.ts` list the issues that carry the `internal-qa` label, so they need a logged-in `gh`.

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
Without a fingerprint it never calls the API.
`collect.ts` works without it: leave out `--groups`, or pass a `groups.json` written by hand.

To exercise collect and file without an agent or an API key, add `--fake`.
It writes a canned result with one finding and a real PNG and GIF made by the evidence tools, recorded as `fake: true` at no cost:

```sh
ECOSYSTEM_QA_FAKE=1 node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.0 \
  --engine claude --fake --sandbox none --out ecosystem-qa/results/mealdrop/macos/claude
```

## Write a QA plan

A QA plan names what a sweep tests beyond the fixed checks: the changes of a release line, each with the repos to try it on, the steps and the expected outcome.
It is one Markdown file in `ecosystem-qa/plans/`, named after its line, such as `11.0.md`, and a person reviews and merges it like code.
The window it was written from is committed next to it as `11.0.window.json`, and the smoke job checks every plan with `--window` against the window file next to it and fails a plan that has none, so a plan PR in which a row was deleted or moved by hand fails without a call to GitHub.
An agent writes it with the `/qa-plan` skill in `.agents/skills/qa-plan/`, which runs the commands below and opens the plan PR.

```
window.ts ──> window.json ──> qa-plan.ts render ──> plans/<line>.md ──> qa-plan.ts check
   │ PRs whose merge commit    │ + draft.json:          │ edited by hand     │ format, rules,
   │ is between two tags       │ entries, decisions     │                    │ catalog, window
```

`window.ts` lists every PR whose merge commit is in `next` between two tags, whatever branch the PR was merged into, so a PR merged into the branch of another PR is in the window too.
When that branch was rebased or squashed before its PR merged, the merge commit of the PR merged into it is not in `next`, so `window.ts` also keeps a PR whose base is the head branch of a kept PR from this repository and that was merged before that PR:

```sh
node ecosystem-qa/window.ts --from v10.6.0 --to v11.0.0-beta.3 --out ecosystem-qa/plans/11.0.window.json
```

For each PR it records the QA status from its labels, the area that the title prefix names, the manual testing section of its body, and the issues the PR closes or names, with their parent issue and whether they have a heading for QA or testing.
It records nothing about who wrote a PR, so it needs no special token: any token that can read this public repository writes the same window.
It keeps a PR only when it was merged at most 30 days before the first tag, and it leaves out the release PRs, whose base is `next-release` or `latest-release`.
So a PR merged into the branch of another PR more than 30 days before the first tag is dropped even when that branch reaches `next` inside the window, which happens when a long-lived stack merges late.
It reads GitHub, fetches a tag that the local repository lacks, and writes nothing but the file of `--out`, whose directory it creates.

`qa-plan.ts render` writes the plan from the window and a JSON draft, and `check` validates it:

```sh
node ecosystem-qa/qa-plan.ts render --window ecosystem-qa/plans/11.0.window.json --draft draft.json --out ecosystem-qa/plans/11.0.md
node ecosystem-qa/qa-plan.ts check ecosystem-qa/plans/11.0.md --window ecosystem-qa/plans/11.0.window.json
```

The draft is optional, and every key of it too: `entries`, `discovered`, `decisions` by PR number, `groups`, and `groupOf`, which puts a PR marked `qa:skip` into a group by PR number.
Without a draft, render writes a skeleton in which every PR is undecided.
The draft is not committed, so `draft` writes it again from a plan and its window, to change decisions or render the plan on a newer window, and exits 1 when render would not write that plan from that window:

```sh
node ecosystem-qa/qa-plan.ts draft ecosystem-qa/plans/11.0.md --window ecosystem-qa/plans/11.0.window.json --out draft.json
```

The plan holds only what a person decides, in the order a reviewer reads it:

| Section | One row for each | Columns |
| --- | --- | --- |
| Field table | field | Line, version, window start and end, entries per run |
| `## Changes to test` | entry | Entry (`Probe:` for a probe, slug and title), Batch, Repos, PRs (their count) |
| `## PRs that need manual QA` | check | Check, Why the sweep cannot test it, PRs |
| `## PRs that need no QA` | reason | Reason, PRs |
| `## Groups of PRs marked qa:skip` | group | Group, Source, Decision, PRs |
| `## Discovered repos` | repo | see below |
| `## Steps` | entry | the block of lines below |

A decision is one of three kinds:

| Kind | In a PR table | In a group's Decision cell | In the draft |
| --- | --- | --- | --- |
| The sweep tests it | the PRs of the entries | `` `slug`, `other-slug` `` | `{ "entries": ["slug"] }` |
| A person tests it by hand | a row of `## PRs that need manual QA` | `manual: <check> Why: <why the sweep cannot test it>` | `{ "manual": "<check>", "why": "<why>" }` |
| It needs no QA | a row of `## PRs that need no QA` | `none: <reason>` | `{ "none": "<reason>" }` |

A PR marked `qa:needed` or without a QA label is decided by its place: the PRs of one or more entries test it, or one row of one of the two tables names its manual check or its reason.
A PR that the entries test only in part is in their PRs and in one row of manual QA, whose check covers the rest; in the draft its decision is the manual one.
A group that the entries test only in part names them before its manual check, as `` `slug`; manual for the rest: <check> Why: <why> ``, and as `{ "entries": ["slug"], "manual": "<check>", "why": "<why>" }` in the draft, which a PR outside a group never takes.
A decision holds ` Why: ` and `; manual for the rest: ` once each at most, and `check` refuses the row of one that holds either twice, since the second would print as part of the check or its reason.
`ledger` names such a PR as tested by the entry and as manual for the rest, and `manual` prints it under its check with the entry that tests the other part.
Both tables hold both kinds of PR.
A manual check is for a change that a person has to test because the sweep cannot, such as a fix that only Windows shows, a change of `storybook init`, a Yarn 1 project, a browser's profiler, or a need that no repo of the catalog has.
It is an instruction that a person can follow without the PR open: the environment it needs, what to do, and what has to be seen.
No QA is for a change of this repository's CI, build, tests, sandboxes, or documentation site, or a lockfile bump that no published package ships.
Every PR marked `qa:skip` is in the PRs of one group, whatever its other labels and whoever wrote it, and each group has a decision of one of the three kinds.
A PR is marked `qa:skip` when its project gets tested as a whole, by a person or by a bot that writes PRs, and a product change labelled only `build` or `documentation` needs that decision as much as one labelled `bug`.
A row with empty cells before its PRs holds the PRs that are not decided or not grouped yet.
Render puts the undecided PRs into such a row of `## PRs that need manual QA`.
A plan or a draft that still says `skip` is refused, with a message that asks for `manual` or `none`.
The PRs verified by hand need no decision, so the plan does not list them.
Render derives the overview of `## Changes to test` from the entries, so a reviewer reads it first and opens an entry under `## Steps` only when he doubts it.
Every PR is a link to the PR, because GitHub links no bare `#36137` in a Markdown file.

`ledger` prints where each PR of the window ended up, with its status, area, and title, for someone who looks one PR up. It is not committed:

```sh
node ecosystem-qa/qa-plan.ts ledger ecosystem-qa/plans/11.0.md --window ecosystem-qa/plans/11.0.window.json --out ledger.md
```

`manual` prints the manual checks of a plan as one Markdown checklist for an issue or a discussion: a title line with the line and the version, two sentences on what the list is and what to do with a finding, and one section for each reason why the sweep does not test a check, headed by that reason, with one task for each manual check of the PR table and of the groups that gives it, followed by its PRs.
Checks that share a reason share its words, so write a reason in the words of one already in the plan when it means the same, such as `shows on Windows only` or `no repo of the catalog has the state it acts on`.
Each PR is a link followed by its title from the window, as one code span, so that a mention or a reference in a title stays text.
It refuses a plan that fails `check` with that window, and it creates nothing on GitHub:

```sh
node ecosystem-qa/qa-plan.ts manual ecosystem-qa/plans/11.0.md --window ecosystem-qa/plans/11.0.window.json --out manual.md
```

Merging the plan into `qa/plans` creates a discussion of this checklist, as [Sweep a plan from `qa/plans`](#sweep-a-plan-from-qaplans) describes.

`diff` prints what differs between a plan before a change and after it, with the window of both: each PR whose place changed, the entries removed, added, and changed, the discovered repos removed and added, and the manual checks and the reasons for no QA removed and added, each with its PRs.
A place is the kind of decision and the entries or the group that hold the PR, so a reworded check or reason moves no PR and shows as one removed and one added.
`--moved` names the PRs that the change is meant to move.
`diff` marks the line of each other PR that moved, and exits 1 with a line for each of them and for each PR that `--moved` names and that did not move.
An agent changes a plan that exists with the `/qa-plan-iterate` skill in `.agents/skills/qa-plan-iterate/`, which proves every change with this command.
Striking the discovered repo `wrfcoin-frontend` from the 11.0 plan prints:

```sh
node ecosystem-qa/qa-plan.ts diff before.md ecosystem-qa/plans/11.0.md --window ecosystem-qa/plans/11.0.window.json
```

```
#37064 moved: tested by `remove-legacy-feature-flags`; group `temporary-migration-flags`, tested by `remove-legacy-feature-flags` -> group `temporary-migration-flags`, manual QA, and --moved does not name it
Entry removed: `remove-legacy-feature-flags` in batch 2 on `wrfcoin-frontend`
Discovered repo removed: `wrfcoin-frontend` wrfcoin/frontend
Manual check added: In a project on Storybook 10 whose main file sets `argTypeTargetsV7: true` under `features`, run `npx storybook@11.0.0-beta.3 upgrade`: the upgrade runs the automigration `remove-legacy-feature-flags`, the main file no longer sets `argTypeTargetsV7` and keeps the other flags, and `npx storybook dev` starts. (#37064)
#37064 moved, and --moved does not name it.
```

With `--moved 37064` it prints the same lines without the mark and the last line, and exits 0.

An entry under `## Steps` is a block of lines:

```markdown
### `story-sort-in-main` Story sort moves from the preview file to the main file

- PRs: [#36137](https://github.com/storybookjs/storybook/pull/36137)
- Batch: 1
- Repo `mealdrop`: sets `storySort` in its preview file today
- Step: Read which automigrations the upgrade ran, and the diff of the main file and the preview file.
- Step: Start the dev server and fetch `http://localhost:6006/index.json`.
- Expected: The order of `/index.json` is the order of the baseline, and the upgrade output names a sort that it could not move.
```

A step may start with the PRs whose change it tests, as `- Step: #36436: Find the Vitest process ...` or `- Step: #36421, #36436: ...`.
An entry with more than one PR names them in every step, so the author of a PR finds the step that tests it in the issue of a finding.
The checklist gives the agent the step as it is, and `prompts/plan-checks.md` tells it that the leading PRs are nothing to do.
The check id of an entry is `plan.` with the slug, and its batch decides when it runs: batch 1 first, and the batches are numbered without a gap.
A repo with more entries in one batch than `Entries per run` runs them in several parts, in parallel.

A probe is an entry with a line `- Probe:` after `- Batch:`, the draft's `probe`, which says in one line what the run adds to the project after the upgrade and where:

```markdown
- Batch: 3
- Probe: a story file src/AnimationProbe.stories.tsx with one story Fade In whose box fades in with a CSS animation of two seconds
```

It tests behaviour that is new or fixed in the line, which no project can hold before the upgrade, on a repo that the plan has already.
It adds new files, such as a story, a component for it, a script, or a local addon, and at most one option of a config file that is the behaviour under test or that the added files need to load.
It never changes or removes a line the project has, never writes what an upgrade step reads, such as what an automigration acts on, what a blocker or a floor checks, or what the package manager detection reads, and never stands in for a framework, a builder, a package manager, an addon the check is about, or a framework version.
The checklist gives the agent the probe line as `Probe: after the upgrade, add <probe line>.` right under the first line of the check, with the directory `<slug>-added/` of the evidence, where it keeps a copy of each added file and a diff of each file it added a line to.
The line reads after the word "add", so `check` refuses a probe line that starts with "add" or "adds" in any case.
`prompts/plan-checks.md` takes only that line for the mark of a probe, and tells the agent to add exactly that after the upgrade, change and remove no line the project has, remove the added files and restore the file it added a line to before the next check, and start the reproduction steps of a finding with adding the probe's files.
It also tells the agent that a probe has no baseline and that nothing of it is done before the upgrade, and that "probe" in the other instructions means a command that gathers evidence.
`check` refuses `Probe:`, in any case, with spaces before the colon, and with the colon escaped as `Probe\:`, which GitHub shows as `Probe:`, in every other line of the plan, so no title, reason, step, or expected outcome reads as that mark.
Whatever a run's record says, the loader takes the baseline of a finding whose check is a probe of the plan as not captured, so no later step reads it as pre-existing.
The issue of a finding from a probe opens with a paragraph that says it comes from a probe, what the run added, and where the copy is, with the entry taken from the plan file by the check id. Its baseline line says that a probe has no baseline because the run adds it after the upgrade, and its reproduction section says that the steps start from the linked commit plus the added files, which that commit does not hold.
A comment that adds such a finding to an existing issue opens with the same paragraph.
The title starts with `[SB 11 QA probe]:` instead of `[SB 11 QA]:`, so the dry filing, the filing report, the issue list, the batch comment of the tracking discussion, and collect's console show the mark too.
The fingerprint and the repeat rule do not read the title. The grouping model reads the titles of the filed issues, which carry the mark for a probe, and the titles of the new findings, which do not.

A change takes the first of these that fits: a normal entry on a repo of the plan that has the state at its pin, a probe, a discovered repo, a manual check, and no QA with the reason.

`check` accepts a file only when it equals what render would write for what it read, so a line that is not in the format, or an overview row that differs from its entry, fails at its line number.
It then holds the plan against these rules and prints each problem as `<file>:<line>: <message>`:

- Every slug, group, discovered id, manual check, and reason of a table is unique, every PR has at most one row in one table, and the version is on the plan's line.
- Every text field is plain text, because GitHub renders the plan as Markdown, where `</td></tr></table><details>` in one reason folds every row after it into a closed block, and `&nbsp;`, `<br>`, `<i></i>`, or a filler character such as U+3164 shows a reason as blank. A text field is one line of printable ASCII, without `<`, `>`, or an `&` that starts a named, decimal, or hexadecimal character reference such as `&nbsp;`, `&#8203;`, or `&#x200B;`. The rule holds inside code spans and link URLs too, because where GitHub ends a code span or a link depends on its parser: `` \`</details>\` `` between escaped backticks is no code span. Write such a character in words instead: a folder named with accented and Korean letters, a version 5.4 or newer. No text field holds a Markdown link or image, since GitHub shows only its text, or nothing, while the agent reads the address too. A group source may link the issue or PR it comes from in the form the plan links a PR, `[#123](https://github.com/storybookjs/storybook/issues/123)`. Every reason and every manual check holds at least three letters.
- The Storybook directory of a discovered repo is a relative path inside the repository, without `..` or a leading `/`.
- Every repo of an entry is a catalog id or a discovered repo, and a discovered repo never takes a catalog id.
- No repo of an entry is more than one major behind the plan's line, by the `tags` of its catalog entry or the major of its discovered row.
- A PR of an entry has no row of no QA and no row without a decision, and when it is in a group, the decision of that group names the entry. It may have one row of manual QA for the part that no entry tests. A PR of a group may stay out of the entries its group names.
- Every row of manual QA has a check and a reason why the sweep cannot test it, every row of no QA has a reason, every PR marked `qa:skip` is in a group, every group has a decision, and every decision names entries that exist. A cell that still says `skip:` is refused.
- A manual check and its reason name no person, PR, or issue, in a code span either, because the checklist of `manual` goes into an issue, where `@name` or `@org/team` notifies people and `#123` or `GH-123` posts on a PR, and because a check that points to a PR cannot be followed without that PR open. `check` refuses every `@` that does not follow a letter or a digit, whatever comes after it, since `_@name_` is a mention in emphasis, and every `#`, `GH-`, `pull/`, or `issues/` before a digit, since `storybookjs/storybook/pull/123` links that PR. Name a package in words, such as the Storybook Vitest addon; `npx storybook@11.0.0` and `qa@example.org` stay, since an issue links no `@` after a letter or a digit.
- The batches are numbered from 1 without a gap, and a batch holds probes only or no probe, so a run that tests the project itself never holds the files of a probe.
- A PR that a step names is a PR of its entry, and when one step of an entry names its PRs, every step of that entry does.
- The file holds no link to `linear.app`, `notion.so`, `notion.site`, `notion.com`, or a `slack.com` host.
- No entry title, probe line, repo reason, step, expected outcome, manual check, reason of a manual check, or reason of no QA holds a URL with a scheme whose host is other than `localhost`, `127.0.0.1`, or `[::1]`. The runner prints the first five into the agent's prompt, and the others are read by the person who follows them. `check` takes every URL that starts with a scheme, also one glued to other text such as `see:http://example.com` or `-xhttp://example.com`, apart with Node's URL parser, and refuses it when the host is another one or when the parser cannot read it: `https://example.com`, `http:/example.com`, `http://localhost;.example.com`, and `http://localhost].example.com` are refused. It reads a backslash once as the parser does, as a slash, and once as curl does, as a character, so `http://localhost\@example.com` is refused too. It does not look for a host without a scheme, such as `example.com/x` or `//example.com`. A scheme glued to letters before it takes them in, so `-xhttp:/example.com` has the scheme `xhttp`, which the parser does not know, and no host, and passes. The check is one layer of four: the reviewer reads every plan before it is merged, the prompt of a plan run forbids every URL other than `localhost`, and the browser tool of the sandbox image blocks direct requests to another host, although it follows a redirect and lets a WebSocket through.
- With `--window`, every PR of the window marked `qa:needed` or without a QA label is in the PRs of an entry or in one row of manual QA or of no QA, every PR marked `qa:skip` is in one group, and the plan names no PR that the window does not hold in that role.

Without `--window`, `check` knows no PR's QA status, so it accepts a plan in which a PR of the window has no place at all, an entry lists a PR that the window does not hold or that was verified by hand, one edit drops a tested PR from the PRs of its entry, a PR marked `qa:skip` sits only in an entry, or a PR marked `qa:needed` sits in a group that names its entry.
`plan.ts` and `run.ts` read a plan through `lib/plan-scope.ts`, which checks it without a window, so the smoke job's `check --window` is the check that keeps such a plan from being merged.

`render` refuses a draft whose decision of a PR names other entries than the ones that list it, or gives no QA to a PR that an entry lists, because the file decides a PR by its place and cannot hold both.
A manual decision of a PR that an entry lists puts the PR into that entry and into the row of its check.

A plan that passes prints its hash, which names the cycle, how many of its entries with more than one PR name the PRs behind each step, its batches with their runs, and about what it costs, priced at the most expensive static run so far.
A run of plan entries can cost more than that.

A repo that no catalog entry covers goes into "Discovered repos".
Each of its fields but the id and the reason is a value of one line of `pin.ts` output for the commit to test, copied as printed:

| Column | From the `pin.ts` line |
| --- | --- |
| Repo at its commit | `repo`, linked to `commit` |
| Package manager | `packageManager` |
| Storybook directory | `storybookDirs[].dir` |
| Storybook major | `major` of that directory |
| Stars | `stars` |
| Pushed at | `pushedAt` |

`loadEntries(plan)` in `lib/catalog.ts` returns the catalog with each discovered repo as an entry without a push target: at its upstream commit, on Linux only, and with nothing pushed.
It parses the catalog and the discovered repos as one list, so a discovered repo cannot reuse a catalog id.

### Run the checks of a plan

`run.ts --plan <file> --batch <n> --part <n>` runs one run of `planRuns`: the entries of that batch on `--repo`, at most `Entries per run` of them, with `--part` 1 by default.

```sh
ECOSYSTEM_QA_FAKE=1 node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.3 --engine claude \
  --fake --sandbox none --plan ecosystem-qa/lib/plan.fixture.md --batch 1 --part 2 \
  --out ecosystem-qa/results/mealdrop/macos/claude/part-2
```

The `macos` in the path is the operating system of the machine that runs it, and `linux` or `windows` on another one: the collect ignores a record in the directory of another system.
`track.ts` then lists the Linux jobs that the plan plans as runs without a result, because a plan runs on Linux.

The run reports the five checks of the tier `gate` first, the upgrade and the dev server that the prompt's steps run in any case, and then one check `plan.<slug>` for each entry of its part, in plan order.
`--tier must` or `--tier extended` runs those tiers in place of the gate, and the collect of the batch then needs the same `--tier`.
The checklist gets the steps, the expected outcome and the reason for the repo of each entry, and the rules of `prompts/plan-checks.md`, which also say how the agent works in the browser.
The answer schema names the ids of this run only, so the agent cannot report a check the plan does not have.

A plan check tests the project as it is after the upgrade, and the agent never creates the state a check needs:

- Forbidden: adding a setting, a file, a dependency, or code so that an upgrade step, an automigration, or a removal has something to act on, or so that the project looks as if it used something it does not use. When the project does not have what the entry describes, the agent reports the check as `skip` and names in its note what the project lacks.
- Allowed: what a user of the released version does to see the result, such as starting the dev server, building, opening a page, clicking, or reading a file, and a step of the entry that turns on a new opt-in feature of the tested version, such as a feature flag in the Storybook main file. That step is its own step of the plan, so the reviewer sees it, and the agent does exactly what it says. The agent never decides on its own to turn something on.
- Allowed for a probe: after the upgrade, exactly what its `Probe:` line names, new files and at most one option in the file it names. The agent copies the files, and a diff of that file, to `<slug>-added/` in the evidence, and removes the files and restores that file before the next check, so the state the run records is the project after the upgrade.

So a repo is listed for an entry only when it has that state at its pinned commit.
A plan check reported as `skip` opens no proposal: the answer schema accepts a finding only for a check that is `fail`, and `collect.ts` makes proposals from findings alone.
A failure whose cause is a third-party package that the upgrade or `doctor` named under `Incompatible Packages` is no finding either, also when it shows in a Storybook package that the third-party one holds on an older major: Storybook already told the user, so the prompts have the agent report such a check as `blocked`, with the package and its line of the log in the note.
`--repo` may name a discovered repo of the plan, which the runner resolves through `loadEntries(plan)`.

The run ends with exit 1 before anything is cloned when the plan is not in its rendered form or fails `checkPlan`, when the plan has no such batch, when the batch lists no entry or no such part for the repo, or when `--version` is not on the plan's line.
`request.plan` in `result.json` records the plan file, its hash, the batch, the part, and the slug and PRs of each entry.

### Collect the results of a plan batch

`collect.ts`, `group.ts`, `missing-runs.ts` and `fetch-runs.ts` take the same `--plan <file> --batch <n>`, and load the discovered repos of the plan with the catalog.
The first three also take the `--tier` of the runs, `gate` by default.

```sh
node ecosystem-qa/collect.ts --results ecosystem-qa/results --version 11.0.0-beta.3 --out ecosystem-qa/results/proposals.json \
  --repo storybookjs/storybook --plan ecosystem-qa/lib/plan.fixture.md --batch 1
```

They read each part under `<id>/<os>/<engine>/part-<n>`, or in the artifact `qa-result-<id>-<os>-<engine>-part-<n>`.
These records are ignored with a warning:

- a record of another plan, batch or tier, and a record of a plan run when no plan is given,
- a record of a repo or a part that the batch does not have,
- a record with a check id that is neither a check of the tier nor an entry of its part of the plan.

The plan file and the flags of the collect decide which runs, tier and entries a batch has, never `request`, because a run that executed code of a public repository wrote the record.
For the same reason the issue body of a plan check takes the entry and its PRs from the plan file, in a line above the list of related findings.
Under that line a collapsed block `What the plan asked the agent to do` lists the steps and the expected outcome of the entry, so a triager can tell a wrong plan from a wrong product.
Each step and the outcome are a code span, where GitHub renders no mention or reference, and the PRs a step starts with are links before its code span.
`collect.ts` prints the plan checks of each result by state, so a tail of checks that the budget left as `skip` is visible.
A job of a plan run in the matrix that `missing-runs.ts` reads names its `part`, and a missing one is named by its repo and part.

## Run it in CI

Start the `Ecosystem QA` workflow by hand and pick the repos, version, engines and operating systems, or merge a plan into `qa/plans` as the next section describes.
`repo` takes catalog ids separated by commas, and `owned`, `tier1` or `tier2` for every repo of that class, so `owned,tier1,tier2` with `linux,windows` is a whole static sweep in one run.
`plan.ts` turns the inputs into one job for each repo, operating system and engine, and a repo runs on Windows only when the catalog marks it `windows`.
Linux runs the agent in `docker()`; Windows runs it with `noSandbox()`, and the API key is the only secret in that job.
Screenshots on Windows come from the runner's Google Chrome, not from the Chromium that Playwright pins, so a Windows screenshot can differ from a Linux one in how the browser renders.
The agent keys live in the `ecosystem-qa` environment, and the push token in `ecosystem-qa-file`, which only the filing job enters.

A Claude Code run in the Docker sandbox on Linux with `ANTHROPIC_API_KEY` keeps the key out of the sandbox.
`run.ts` starts a proxy on the gateway of Docker's default bridge, gives the agent that address as `ANTHROPIC_BASE_URL` and a placeholder as its key, and puts the real key on each request it forwards to the Anthropic API.
`run.ts` deletes the key from its own environment as soon as it reads it, before the sandbox exists, so neither the docker CLI that runs the project install nor any other process it starts inherits it.
The proxy forwards only `POST /v1/messages` and `POST /v1/messages/count_tokens`, answers only the sandbox container's address, and writes one line for each request that Node's HTTP parser accepts, with method, path and status, or `closed by the caller` when the caller goes away first, to the job log and to `run.log`.
Before the agent starts, the runner reads the environment of the sandbox and the variables that Sandcastle exports in front of the agent's command, ends the run when the real key is in either, and writes `Neither the environment of the sandbox nor the variables Sandcastle exports for the agent hold the provider key.` otherwise.
Where the Docker daemon runs in a VM, as Docker Desktop does on Linux too, the bridge gateway is no address of the host, so the proxy cannot listen there and the run ends with an error that says so.
Every other run still hands the real key to the agent: Codex, any run on macOS or on Windows (the Windows cells run without a sandbox), a run on Linux in bwrap or without a sandbox, and a run with `CLAUDE_CODE_OAUTH_TOKEN` and no `ANTHROPIC_API_KEY`.
The proxy limits where the key goes, not what it spends.
Any code in the sandbox, the project's install scripts and tests included, can send requests on the real key to those two paths for as long as the run lasts, with any model and any body, and the harness does not count that spend.
The backstop is a spend limit on the key's workspace at the provider, which only the owner of the key can set.
The `Reach the key proxy from the sandbox` job of a pull request checks on the runner image of the agent job that a container on the default bridge gets through the proxy to a stand-in for the provider.
Each runner uploads `qa-result-<id>-<os>-<engine>`, or `qa-result-<id>-<os>-<engine>-part-<n>` with its results under `part-<n>` for a job of a plan with a part, with `result.json`, the run log, the raw agent stream, the session, the evidence and the cycle branch bundle.
`run.ts` writes the status, wall time, tokens, dollars, free disk and every check to the Step Summary.
The workflow keeps these artifacts, `qa-earlier-results` and `qa-proposals` 90 days, the most that a public repository allows, so the session of a finding outlives a bug bash. An artifact keeps the retention it was uploaded with.

The collect job runs `group.ts` with the key from the `ecosystem-qa` environment, then collects with its `groups.json` and uploads both files as `qa-proposals`.
To collect again without running any agent, set `from_runs` to a comma-separated list of earlier run ids: the job fetches their `qa-result-*` artifacts with `fetch-runs.ts`, the result that was uploaded last winning where two runs hold the same repo, OS and engine, and groups and collects those.
It takes only runs of this workflow that were started by hand, on the default branch or on the branch the collecting run itself runs on, and runs that a push to `qa/plans` started, and stops before it downloads anything when one of the ids is anything else.
The branch is the name the run was started under, not the code it ran.
So a sweep that ran on a feature branch has to be collected and filed from that branch before the branch is merged: once the branch is gone, no run can collect it.
In a sweep the collect job gets the plan and, before it groups anything, runs `missing-runs.ts`, which names every planned run that left no result it can read, as a warning and in the Step Summary: a job whose runner was lost uploads nothing, and the sweep would otherwise read as complete with one run fewer.
It also stops, and collects nothing, when one of the runs holds no result it can read: a run whose agent jobs wrote no `result.json`, or one from before the artifact name carried the repo id.
Any run of the repository can upload an artifact with the name of a result, also the run of a pull request from a fork, and the filing job pushes and files what the results say.
It uploads them again as `qa-earlier-results`, so the filing job finds their evidence and cycle bundles.
To split a wrong merge, or to collect when the model is unavailable, paste a `groups.json` document into `groups`; the job uses it instead of asking the model.
Two requests over the same findings can group a borderline pair differently, so start the run that files with the `groups.json` of the dry run you reviewed.

### Sweep a plan from `qa/plans`

A plan that is merged into the branch `qa/plans` starts its sweep, and each batch starts the next one once its numbers are in the tracking discussion.
The same push creates the plan's manual QA discussion.

```text
push to qa/plans ──> plan job ─────────> runner jobs ──────> collect ──> track ──> gh workflow run
                     plan.ts --push      one per repo and               track.ts   batch n+1, same
                     plan.ts --outputs   part, tier gate                           plan_hash
                          │
                          └────────────> manual-discussion job: manual-discussion.ts,
                                         one discussion per plan hash in "QA sweeps"
```

The `manual-discussion` job creates the discussion `[SB 11 QA] Manual QA for Storybook 11.0 at 11.0.0-beta.3` in the category `QA sweeps`, next to the sweep's tracking discussion.
A discussion is never read as a finding and stays out of every issue search.
Its body starts with the hidden line `<!-- sb-qa-manual <hash> 11.0.md -->`, then holds the checklist that `qa-plan.ts manual` prints, and ends with a link to the plan at the pushed commit and the title of the sweep's discussion.
It runs only for a push that adds or changes a plan, with `discussions: write`, no environment, and no secret, and no other job waits for it, so the sweep and the discussion fail apart.
It creates nothing when a discussion of the plan's hash exists in that category whose first line is that hidden line and whose author is the workflow or an owner, member, or collaborator of the repository, since anyone can open a discussion with that line.
It never edits a discussion, because people tick its boxes.
A plan without manual checks gets no discussion, and the job says so in a notice.
GitHub publishes no limit for the body of a discussion, so a checklist longer than the 65536 characters it takes as an issue body fails the job with both sizes.
When the manual QA discussion exists by the time the first batch creates the tracking discussion, the tracking discussion names it.

To see what the job would do without writing, run it with `--print` on the plan and its window:

```sh
node ecosystem-qa/manual-discussion.ts --print --plan ecosystem-qa/plans/11.0.md \
  --window ecosystem-qa/plans/11.0.window.json --repo storybookjs/storybook --commit "$(git rev-parse HEAD)"
```

A maintainer sets up three things once, before the first plan is merged:

- The discussion category `QA sweeps`, under the edit button of Categories on the Discussions tab. Without it the `track` job fails with a message that names it, and no batch starts the next one.
- The branch `qa/plans` in the deployment branches of the environments `ecosystem-qa` and `ecosystem-qa-file`, so that its runs get the agent keys and its filings the push tokens.
- The repository variable `ECOSYSTEM_QA_CYCLE_CAP_USD`, the spend cap of one plan in dollars, when the cap should not be 250.

The plan job is the only job that reads the inputs and the event, and every other job reads its outputs.
For a push it diffs the plans directory over the commits of the push, and only a path that is a plan file in `ecosystem-qa/plans/` is ever read.
A push that adds or changes one plan runs batch 1 of it as a dry run.
A push that adds or changes no plan ends with a green plan job that says so.
So does the push that creates the branch, which runs no plan even when it carries one.
A push that adds or changes a Markdown file in `ecosystem-qa/plans/` whose name is not the name of a plan, such as one with a space or a letter outside ASCII, ends in the plan job and names the file.
A push that adds or changes two plans ends in the plan job and names both.

A dispatch by hand runs one batch of a plan with `plan` set to its file name, such as `11.0.md`, and `batch` set to its number.
It starts the next batch only when `chain` is set.
`version` is the version of the plan's header when it is empty, and must be on the plan's line when it is not; a sweep without a plan needs it.
A run with a plan runs the tier `gate` and the checks of its batch, on Linux, with `repo`, `os` and `tier` left out.
When `plan_hash` is given and the plan at that commit has another hash or is gone, the plan job ends green with a notice and runs nothing, and the `track` job adds a comment to the discussion of the plan as it was, which says that the run ran nothing for that batch and what it found.
A dispatched batch of a plan has a concurrency group of its plan, batch and `from_runs`, and the batch 1 that a push starts has a group of its commit, so a chained batch never waits behind the batch that started it.

The `track` job runs `track.ts` for every run with a plan that was not cancelled, also when the collect failed, except a collect of earlier runs that failed, which has nothing to report.
The first batch of a plan creates the discussion `[SB 11 QA] Dynamic sweep 11.0.md`, with a hidden marker of the plan's hash in its first line.
Each batch adds one comment, for its batch, version and source runs: the runs planned, finished and without a result, the dollars of each, the checks by state, and one line for each finding.
It ends with what the batch cost and what the plan cost up to that batch, such as `Batch 3 cost $3.24 for 15 runs.` and `The plan cost $13.09 for 56 runs up to batch 3, of a cap of $200.00.`
Both count the comments of the earlier batches and of this batch up to its own comment, and no later one, so a comment that is written again after later batches, such as when its batch is filed, shows the same cost.
A batch with more than one report, such as a second run with another version, sums them, a run that two of them hold once, and ends the line of the batch with `in 2 reports`.
Collecting the same runs again edits that comment and starts no batch.
The spend of a plan is the sum of the dollars in the comments that the workflow wrote, and a run without a result or without a price counts as the flat price `USD_PER_RUN` of `lib/qa-plan.ts`.
A run is counted once however often it is reported, and a job that leaves no result is counted once for each attempt of its workflow run that reports it, so a "Re-run failed jobs" that loses it again costs one more flat price.
Two cases count too much, and stay so because they err on the safe side: a job lost in two runs that are collected together is priced a third time, and a re-run of only the `file` or `track` job prices each lost job once more.
Each batch comment also carries, in a hidden line, the spend of the plan that it was written with.
A changed plan has another hash, so it starts a cycle of its own with a new discussion and a spend of zero.

The chain stops after the last batch, when a run does not chain, when a batch left no result, and when the spend reaches the cap.
It also stops when the discussion holds a report of a later batch, or when an earlier report of the same batch started the next one already.
And it stops, and the comment says "at least" of the cost of the plan, when the record of the spend is short or may be:

- A comment that the workflow wrote was edited by anyone else, or reports no batch of the plan.
- The discussion holds no report of an earlier batch, such as after a comment was deleted or a batch was skipped.
- The comments of the workflow hold fewer runs than the spend that one of them was written with, which is what a deleted comment leaves, and each comment written after that carries the missing runs in its hidden line, so a filing or a batch started by hand stops again.
- The plan has more than one discussion, for example after its first line was edited, the next batch started a new one, and the line was put back.
- The first report of a batch comes from a later attempt of its workflow run, whose earlier attempts reported nothing because they were cancelled or their `track` job failed before it wrote.

Once a comment of the workflow says "at least", every comment whose cost counts it says it too, also when the batch is reported again or the missing report was collected since.
A deleted comment stays unseen when no comment that is left was written after it, such as the newest comment, or the only comment of a batch that is deleted before another run of that batch reports.
The attempts of a run that another run collects with `from_runs` are not known, so they are not checked.
A run that wrote no comment, because it was cancelled or its `track` job did not write, is in no record, and a new run of the same batch chains on without its spend.
Run its failed jobs again, or collect it alone with `from_runs`, before you dispatch the batch again.
The cap is checked before each next batch starts, so the spend of a plan can pass it by at most one batch.

The comment says what comes next on a line `Next:`.
When the chain stops before the last batch, and neither a report of a later batch nor an earlier start of the next one stopped it, the line below it prints the dispatch that starts the next batch by hand, such as `gh workflow run ecosystem-qa.yml --ref qa/plans -f plan=11.0.md -f batch=2 -f plan_hash=e526520a70c0 -f chain=true -f version=11.0.0-beta.3 -f engines=claude`.
Run it once the reason is gone: after the jobs of a batch that left no result were run again and finished, after a dispatch that failed, after the cap was raised, or once you know what the record of the spend is short of.
The batch it starts reports and chains like any other, and stops again for a reason that stays, such as a second discussion or a comment that is gone.
A report of the same batch again keeps the `Next:` line as the first report wrote it, so a re-run never starts a batch itself.
It prints the line below it again from its own run, so the line of a batch that was filed leaves out the `budget_minutes` of the batch.
The `track` job starts the next batch before it writes the comment, so the comment says `Batch 2 is started.` only after the dispatch went through, and otherwise that the dispatch failed.
The `track` jobs of one plan share a concurrency group of the plan's hash, so two reports never create two discussions or start the next batch twice.
A third report that queues while one waits cancels the waiting one, and its run then reports nothing.
The workflow never writes over a comment that someone else edited, so the `track` job of that batch fails and names the comment.
Edit nothing the workflow wrote in the discussion, and write notes as comments of your own.
The `track` job uses the job token with `discussions: write` and `actions: write` to start the next batch, and no environment.

A chained batch is always a dry run, so a person files each batch by hand with the dispatch that its comment prints.
That dispatch carries the plan's hash, so it runs nothing once the plan changed.
In a run that files, the `file` job runs after the `track` job, and then edits the comment of the batch so that each finding names its issue.
The file step writes the issue that each finding created or was found filed as into a file that the last step reads, because GitHub's listing of the `internal-qa` issues can miss an issue created a second before.
When the file step left no such file, the comment names the issues of that listing.
Its last line says `Filed.` only when the file step succeeded, and otherwise that the filing did not finish.

To see what a batch would write without writing it, run `track.ts --print` on its results, here the fake run and collect of the fixture plan above:

```sh
node ecosystem-qa/track.ts --print --filing dry --results ecosystem-qa/results \
  --plan ecosystem-qa/lib/plan.fixture.md --batch 1 --version 11.0.0-beta.3 \
  --planned "$(node ecosystem-qa/plan.ts --plan ecosystem-qa/lib/plan.fixture.md --batch 1)" \
  --proposals ecosystem-qa/results/proposals.json --repo storybookjs/storybook
```

A pull request that touches `ecosystem-qa/` or the workflow runs only the smoke job: typecheck, tests, `qa-plan.ts check` on the fixture plan and on every plan in `ecosystem-qa/plans/`, and a fake run through collect and a dry filing, with no environment and no secrets.
That is how a pull request against `qa/plans` that adds a plan gets its red or green check.

## Where results land

`<out>/result.json` is the record of one run, and every later stage reads only these files.
Next to it are `run.log`, `agent-stream.jsonl` (the token counts come from here), `session.jsonl`, `evidence/` and `cycle.bundle` when the agent committed.
`evidence/checklist.md` is the checklist the agent got, as the prompt shows it.
A run needs an output directory of its own: `run.ts` stops when `--out` holds anything, so that the log, the agent stream and the evidence of an earlier run are never read as this run's.
The runner keeps the sandbox open until it has an answer it can use.
The answer is the `<qa-result>` block in the last message of the agent.
Broken JSON, a missing check or a last message without the block goes back to the agent with the problem, in the same session, at most twice; after that the record has status `output-invalid`.
The sandbox is closed last, and a worktree that cannot be deleted then is left behind without failing the run.
A run has a time budget, counted from its start, the clone and the project install included: 90 minutes by default (`--budget-minutes`, or the workflow input `budget_minutes`).
The agent reads the clock with `tools/budget.mjs`, which the prompt tells it to run before every check, and is told to report what it did not get to as `skip` once the budget is used up.
The prompt also tells it to stop a build or test run that has not ended after 15 minutes and not to start it again.
The agent stops a server with `tools/free-port.mjs <port>`, never by a process id it saved: that id can belong to a wrapper such as `npx`, which ends while the server keeps the port, and the upgraded server then exits on `--exact-port` while the agent grades the pages of the baseline.
The tool finds the processes that listen on the port, stops them, and waits until nothing answers there; it exits 1 with one line of reason when the port is still taken after 20 seconds (`--wait-seconds`).
It finds the listeners in `/proc` on Linux, because the image has neither `lsof` nor `ss`, with `lsof` on macOS, and with `Get-NetTCPConnection` on Windows.
After it starts a dev server the agent reads the first lines of its log, frees the port and starts again when they say the port is not available, and reports as `blocked` every check that needs a server that still cannot start.
Fifteen minutes after the budget (`--hard-stop-minutes`), at minute 105 by default, the runner stops the agent and everything it runs.
It does the same when the agent prints nothing for 15 minutes.
It then asks the agent once, in the same session, for the answer with what it has, and gives it ten minutes for that.
The record of such a run has status `ok` and says in `cutShort` why the run was stopped.
For that the runner copies the session of the stopped agent out of the sandbox itself, because Sandcastle does so only when a turn ends.
It can do that in the Docker sandbox with Claude Code, and it needs no copy without a sandbox.
In every other case, and when the agent gives no answer that can be used then, the record has status `timeout` and no checks; the evidence, the logs and the commits are kept.
In CI the job itself is cancelled 90 minutes after the budget, which is after all of that; a cancelled job writes no record.
While a run works, the runner writes what the machine looks like to `evidence/host-samples.jsonl` every 30 seconds, the project install included: host memory and swap, load, free disk, the memory and process count of the Docker sandbox, how much of the last minute the processes of the sandbox and of a Linux host spent waiting for memory, and how late the reading itself came.
A Windows runner has no load figure and no account of waiting, so it reports memory and disk.
The Docker sandbox gets 85% of the memory of the Docker daemon and no swap.
The kernel ends a process of a sandbox at that limit only when it can free nothing at all; as long as it can take the code of the processes out of memory and read it back, it does that, and a build that needs more than the sandbox has neither fails nor moves on.
So when the sandbox is at its limit and its processes have waited for memory in a fifth of the last ten seconds in two readings in a row, the runner ends the command that holds the most memory, with everything it started: never the agent, never the timer of the project install, and no command that holds less than a tenth of the memory of the sandbox.
It does nothing where the kernel keeps no account of waiting, which is the case with cgroup v1, and nothing once the agent runs and it cannot find the agent among the processes.
The limit of the sandbox does not cover what the machine holds outside it.
On a GitHub runner the agent of the `step-security/harden-runner` step, a root process named `agent`, grew from 170 MB by about a gigabyte a minute while a project's Storybook tests ran in Vitest browser mode in the sandbox, to 9 GB in two real runs, and a runner that runs out of memory and swap stops answering.
That is why the job that runs the agent has no such step: without it the same tests leave the host 10 GB and take 269 seconds in place of 458.
Whatever else may hold memory outside the sandbox, the runner also ends the command that holds the most memory in the sandbox, under the same rules and at once, when what the machine has available and what is left of its swap are together less than 15% of its memory.
It does so only when what the machine holds outside the sandbox, in memory and in swap, is more than the share the sandbox was not given, so that a sandbox that is merely full on a machine without swap is left alone.
The agent sees that command end as one the kernel ended, and `evidence/memory-guard.log` names it.
It prints a reading to the job log every twenty minutes, and on a GitHub runner it puts a warning on the page of the run the first time the machine runs short.
None of this explains a runner that stops answering: such a job hands over no log, no artifact and no warning, because the runner sends them only when a step or the job ends.
The only way to see what such a run did is to have its job page open while it runs.
When the sandbox fails after the agent has finished, for example while it collects the commits, the runner reads the answer from `run.log`.
The record then has status `ok` and names the sandbox error in `recoveredFrom`.
A run whose agent did not finish is never read this way.

## Dry mode

Dry mode is the default, and a push to `qa/plans` is always a dry run.
The filer writes each proposal, with its full issue body and the evidence it would upload, to the Step Summary and changes nothing.
Above the proposals the summary prints the dispatch that files them from the same results, with `from_runs` set to the runs that hold them, `dry` set to false, and the branch, `version` and `groups` of the run, or for a batch of a plan the same dispatch as its comment, and the day the result artifacts expire.
Dry mode files no finding, but a batch with a plan still reports its numbers in the tracking discussion.
Its comment prints the dispatch that files the batch, with `from_runs` and `dry` set to false, and the day its result artifacts expire, after which the batch can no longer be filed.
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
A group is suppressed only when every one of its fingerprints is in the body of a `qa:known` issue, or in the body of an issue that was fixed after the tested prerelease was published: a grouping can merge findings, it can never hide one.
When only some of them are, the whole group is reported, so the other findings appear on the open issue or in a new one.
A group that matches an issue only by similarity (`existingIssue`) becomes a comment on it while it is open, even when that issue is `qa:known`, because only an exact fingerprint in the body suppresses.
A fingerprint that an open issue already carries stays on that issue: the collector rejects a grouping that puts it in a group with a fingerprint of another open issue, or in a group that names another issue, and says which group to split.
The metadata of an issue lists every fingerprint of its group, so a later sweep finds it by any of them.
Only the metadata block that ends an issue body or a comment counts: the same digits in the text above it tie nothing to the issue, because that text can come from an agent and every fingerprint is public.
To tie a fingerprint to an issue by hand, add it to the `fingerprints:` line of the block in the issue body.
A comment lists the fingerprints of its group the same way, and the collector reads the comments that the workflow account wrote on each listed issue, so a fingerprint that joined an issue through a comment is found too.
Such a fingerprint routes its finding: it decides which open issue gets the comment, it counts as filed on that issue, and it stays on that issue.
It never suppresses its finding, because the comment followed from a merge or a similarity match, which only a person may turn into silence by adding the fingerprint to the body.
The harness trusts comments of the workflow account for routing only, so another workflow that comments as the same account cannot silence a finding.
A comment by anyone else never ties a fingerprint to an issue.
An issue closed as completed after the tested prerelease was published counts as known for that version, because the fix is not in it yet; the collector reads the publish date from the `v<version>` release of `--repo`.
Silence needs the fingerprint in the body here too.
A group that only resembles such an issue, or of which only some findings are in its body, becomes a comment on that closed issue: the comment says that the tested version does not have the fix yet, and it routes the group's fingerprints to the issue.
The next sweep of that version proposes the same comment again, and the filer skips it as a repeat when it reports no new version, repo, system or engine.
A sweep of a version published after the fix files the group as a new issue linked to the closed one, because the bug came back.
An issue closed before that, or closed for any other reason, does not count: the bug came back, so it is filed again with a link to the closed issue.
An issue counts as already filed only while it carries the `internal-qa` label.
It checks first that the milestone is open and every label exists, and files nothing otherwise.
Filing jobs run one at a time, in one concurrency group, which holds one running and one waiting job.
A third filing job that arrives then cancels the waiting one, so a cancelled filing job means "collect that run again with `from_runs`", not "nothing to file".
A proposal that fails does not stop the others; the job writes a filed and failed table to the Step Summary and fails at the end.
Rerunning the job is safe: an issue it already created and a repeated comment are skipped, and evidence already on `qa-assets` makes no new commit.
When an open issue with one of a proposal's fingerprints appeared after the collect, for example from another sweep, no second issue is created: what that issue lacks goes on it as a comment.
Filing the same results again from another run, for example with `from_runs`, is safe too.
A sighting is one finding of a group in one agent run: its fingerprint with that run's repo, commit, system, engine and version, whichever run collected it.
The metadata of an issue or comment lists the keys of its sightings, and a proposal adds a comment only when the issue lacks at least one of them.
So the same findings in another order, or split into other groups, add nothing, and a finding that a new repo reports gets its comment.
An issue or comment written before sightings had keys is compared as a whole, by its fingerprints, version, repo, commit, systems, engines and models.
Such a block names one repo and commit, so it stands only for a proposal from a single run.
A comment is also skipped as a repeat when the issue already has a sighting on every combination of Storybook version, repo, system and engine that the comment reports, of any finding and from any run.
So a second sweep of the same version adds nothing on an issue that the first sweep reported from the same repos, systems and engines, and a comment with one new version, repo, system or engine is posted whole.
The cost is that a new aspect of the bug, seen in the same repo on the same version, system and engine, is skipped too.
The metadata of an issue or comment lists those combinations on its `seen:` line.
A block written before that line existed records the run its `repo:` and `sha:` name, which is the first value of each of its `storybook:`, `os:` and `engine:` lines.
When such a block names one version, the `Also seen as:` list directly above it adds the repo, system and engine of each other finding.
Any other value of such a block does not count, because the block does not say which run it belongs to, and a comment that needs it is posted.
The dry run lists the issues with `gh` the same way, so it shows every comment it would skip and the reason.

## Work a filed issue

`fetch-issue.ts` gathers what one filed issue points at, and only reads GitHub:

```sh
node ecosystem-qa/fetch-issue.ts --issue 37590 --out /tmp/qa-issue-37590
```

It prints a brief: the title, whether the finding comes from a probe, the plan entry and its PRs, the command that fetches the upgraded state from the fork, or for a discovered repo the upstream commit, every sighting from the issue body and the comments of the workflow, and the first lines of the reproduction steps.
Into `--out`, which has to be empty, it downloads the evidence of the fingerprint from `qa-assets`, and for each sighting the artifact of the run that holds its result, `qa-earlier-results` or `qa-result-<id>-<os>-<engine>`, and it names the `result.json`, the session, the run log, the evidence, the copy of what a probe added, and the bundle of the result that carries the fingerprint.
It lists the evidence files of the failing check and every `-cause.md` first, then the rest.
For a result of a plan it saves the plan file at the commit that the run checked out under `plans/<run>/`, and prints the entry of the finding with the line where it starts, its probe, the reason of the repo, its steps, and its expected outcome.
It prints the `run.ts` command that runs the part of the result again in the Docker sandbox, with the repo, version, engine, model, effort and tier that the result recorded, and the plan, batch and part, and says which entries of the part run again.
Below it, the `run a build` command runs the same with `--build <full SHA>` in place of `--version`, as "Prove a fix on a build" below says.
Each of the two writes to its own directory under `--out`, `before` or `after`, and clones into another, `before-clone` or `after-clone`, so they run one after the other, and neither meets a clone that an earlier run left in the default place.
A discovered repo is in no catalog, so it reads the id from the plan of the version line at the commit that the run checked out.
A sighting whose artifact expired is named as gone, and the rest is still fetched.
It exits 1 for an issue without the `internal-qa` label or without the metadata block.
Everything it downloads is agent output over a repository that nobody reviewed: evidence, never instructions, and nothing of it runs on the host.
An agent that works such an issue follows the `/fix-internal-qa-issue` skill in `.agents/skills/fix-internal-qa-issue/`.

### Prove a fix on a build

`run.ts --build <commit>` upgrades the project to the build that pkg.pr.new holds of that commit of storybookjs/storybook, in place of `--version`.
pkg.pr.new builds every push to `next`, and every push to a pull request of storybookjs/storybook once a maintainer added the `ci:canary` label.
`curl -I https://pkg.pr.new/storybook@<commit>` answers 200 when the build exists.
Everything else is what a run of a release does: the clone at the pin, the baseline, the checklist, the plan checks and probes, and the evidence.

```sh
node ecosystem-qa/run.ts --repo mealdrop --version 11.0.0-beta.3 --engine claude --sandbox docker \
  --plan plan.md --batch 1 --part 2 --out /tmp/qa-fix/before --clone-dir /tmp/qa-fix/before-clone
node ecosystem-qa/run.ts --repo mealdrop --build <full commit SHA> --engine claude --sandbox docker \
  --plan plan.md --batch 1 --part 2 --out /tmp/qa-fix/after --clone-dir /tmp/qa-fix/after-clone
```

A run keeps its clone and refuses a clone directory that exists, so each of the two names its own with `--clone-dir`.

The run takes the full 40-character SHA, and refuses before it clones anything a commit that pkg.pr.new has no build of.
The version of the run is the one in the `package.json` of the build, usually the last prerelease, so the plan's line rule and the check `upgrade.installed-version` compare with what the build installs.
The upgrade runs through `npx --yes --allow-remote=all https://pkg.pr.new/storybook@<commit>` with every package manager, and writes the pkg.pr.new address of each Storybook package into `package.json`.
`request.build` in `result.json` records the commit, the summary names the address, and the cycle branch is `qa/sb-<version>-build-<first 10 characters of the commit>/<os>-<engine>`.

A run of a build is a proof for a pull request and never a finding of a release.
`collect.ts`, `group.ts` and `track.ts` ignore its record with a warning, so nothing of it reaches a proposal, an issue, a comment or a batch comment, and `file.ts` files only what `collect.ts` proposed.

To prove a fix, run the same command twice: before on the released prerelease of the issue, after on the build of the fix, with the same repo, plan, batch, part, engine and sandbox.
Then compare the check of the issue in both `result.json` files: `fail` with the finding before, `pass` after, and the same state for every other check.
A check that fails after and passed before is a regression of the fix.

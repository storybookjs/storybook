# Factory integration plan for the `security-audit` skill

The skill in this directory runs on its own inside any Claude Code session: it reads the committed threat-model copy, hunts and verifies with subagents, and produces a chat report with ready-to-paste text. Everything that needs the maintainers' private systems is listed here as work for the private software factory, where Notion and Linear access is guaranteed and output stays private. Each item names its inputs, outputs, and the fallback the skill already implements.

## 1. Live threat model from Notion

**Goal:** the audit reads the maintainers' threat model page at run start, so remediation decisions and accepted risks feed dedupe, and drift between Notion and the committed copy is reported.

- Input: the Notion page id of the threat model, provided to the factory as configuration, not committed.
- Behaviour: at setup, fetch the page; extract the sections that correspond to `references/threat-model.md` (principals, non-boundaries, surfaces, advisories) and a "Decisions" section the copy does not carry. Pass the decisions to verifiers as a dedupe source only; hunters never see them, so accepted risks do not anchor the hunt.
- Output: a "Threat model sync" line under part 4 of the report listing headings present in one source and absent from the other.
- Fallback already in place: the verdict line reports `notion:unreachable` and the run uses the copy.

## 2. `threat-model-sync` task

**Goal:** keep `references/threat-model.md` a faithful public-safe projection of the Notion page without hand edits.

- Trigger: on demand, and after any audit whose part 4 is not `none`.
- Behaviour: read the Notion page, render the projection with these rules, and open a PR against `next` with the regenerated file. The projection keeps surfaces, controls, escape-hatch flags, tests, the path map, principals, non-boundaries, and published advisories. It drops decisions, open leads, accepted risks, and any item whose advisory is not yet published. The PR description lists the headings that changed.
- The audit's part 4 (threat model delta, code versus copy) is the input a human uses to update Notion first; this task then flows Notion back into the copy. The audit never edits the copy.
- Verification: the path check used when the copy was authored, run in the PR: every backticked path under `code/`, `docs/`, `scripts/`, and `.github/` exists.
- Later: move the path map into a machine-readable file next to the copy so CI can compute blast radius without an agent.

## 3. Linear issues with dedupe

**Goal:** every `confirmed` and `needs-validation` record becomes one issue in the dedicated security project, once.

- Input: the Linear project id and the label set (`security`, surface ids, `pr-introduced`, `pre-existing`), provided as configuration.
- Dedupe key: the step id (`<surface id>/<slug>`), stored verbatim in the issue body on its own line `Step id: ...`. Before creating, search the project for that line. On a match, add a comment with the new run's evidence and verdict instead of a second issue; move a `needs-validation` issue forward when a later run confirms it.
- Chains: one issue per step; the chain record goes as a comment on each member issue, linking the others.
- `hardening` records are not issues. They stay in the report.
- Fallback already in place: the report carries the Linear issue template filled for each record.

## 4. Notion audit records

**Goal:** each `full` run leaves a time capsule.

- Behaviour: create a child page of the threat model page titled `<ISO 8601 timestamp> security audit`, body parts 1 to 4 of the report verbatim, followed by links to the Linear issues created or matched.
- `pr` and `triage` runs do not create pages; their Linear issues carry a `Source:` line with the run date and ref.

## 5. PR audits as a check

**Goal:** a PR audit behaves like CI: a status that blocks on `FAIL`, details kept private.

- Trigger: a PR event whose changed paths map to `high` blast radius in the path map, or a label applied by a maintainer. Low-radius PRs are not audited automatically.
- Behaviour: run the skill in `pr` mode at the computed effort inside the factory. Publish a check run or commit status with the verdict line only. On `FAIL`, submit a "Request changes" review whose body is the ready-to-paste review text, which holds `pr-introduced` records only. `pre-existing` records go to Linear with no public trace. On `NEEDS-VALIDATION`, publish a neutral status and a Linear issue.
- Permissions: `checks: write` and `pull-requests: write` for a token scoped to the factory, never to a fork-triggered workflow. Fork PRs receive the status only; a maintainer decides whether to relay review text.
- The public-output guard in the skill remains: when the skill detects it runs inside a GitHub workflow rather than the factory, it prints only the verdict line.

## 6. Triage across release lines

**Goal:** `triage` mode scopes affected versions across the lines SECURITY.md supports.

- Behaviour: fetch the release branches for the latest major and the previous two; create a worktree per branch; rerun the step's evidence test in each; compute affected ranges from the first tag containing the introducing commit per line. Record the ranges in the advisory draft's affected-packages table.
- Fallback already in place: a `needs-validation` record naming the branches to check.

## 7. Connector availability

| Capability | Needs | Without it |
| --- | --- | --- |
| Threat model decisions and sync | Notion | committed copy, verdict line says `notion:unreachable` |
| Issue creation and dedupe against prior issues | Linear | issue templates in the report, dedupe limited to advisories and the current run |
| PR data and statuses | GitHub with `checks: write`, `pull-requests: write` | diff from git, review text in the report |
| Release-line scoping | release branches in the clone | `needs-validation` naming the branches |

## 8. Decisions for the factory owner

- Whether low-radius PRs ever get an automatic audit, or only the labelled ones.
- Whether a `NEEDS-VALIDATION` status blocks merge or only annotates.
- Retention of scratchpad tests from a run, which contain reproductions of unfixed weaknesses: they should live only in the factory, attached to the Linear issue, and be deleted when the issue closes.

---
name: security-audit
description: Use when asked to security-review a PR, branch, or diff in this repository, to audit Storybook's codebase or one of its surfaces for vulnerabilities, or to triage an incoming vulnerability report or advisory draft. Also use when a change touches the dev server, the WebSocket channel, server channel handlers, postMessage, refs, the CLI's process execution, built output, or GitHub workflows.
metadata:
  internal: true
---

# Security audit

Find escalation steps: places where a lower-trust principal gets an effect that a control should have bound. Prove each with a failing test in the repository's own harness, verify each with a fresh agent, and report in the shape maintainers' disclosure and tracking processes consume. This skill is defensive: it builds failsafes, never exploits.

## Read first

1. `references/threat-model.md`: principals, non-boundaries, surfaces with their controls and tests, the path map, published advisories, and the delta procedure.
2. `references/validation-and-reporting.md`: the step record, verdicts, severity and CVSS, disclosure rules, report shape, templates, and the prompt blocks this file copies into subagent prompts.
3. `references/attack-classes.md`: the step shapes to hunt for, by principal.

## Modes

| Mode | Use when | Scope |
| --- | --- | --- |
| `pr` | a PR number, branch, or diff is given, or the user asks to review changes for security | the diff and every handler, route, or sink it touches, read whole |
| `full` | the user asks to audit the codebase, a whole audit, or a full security audit | every surface in the threat model, or the surfaces named |
| `triage` | the user gives a vulnerability report, advisory draft, or claimed exploit | the steps the report claims |

If the request fits both `pr` and `full`, ask one question before launching any subagent. A security question with no PR, surface, or report to act on is answered from the references without running the workflow.

## Setup, every mode

- Record the source ref: `git rev-parse HEAD` and whether the worktree is dirty.
- Note which integrations are reachable: Notion (threat model), Linear (security project), GitHub (PR data). Each unreachable one is stated on the verdict line; the run continues with the committed threat-model copy and ready-to-paste text.
- Create a scratchpad directory for this run. Every test a hunter or verifier writes goes there. Nothing is written under the repository, and nothing is committed.
- Check the running context. If the session is a GitHub workflow run, the output is public: emit only the verdict line and the holding sentence from the disclosure rules.

## `pr` mode

1. **Collect the diff.** For a PR number use the GitHub tools; for a branch use `git diff next...<branch>`; for a pasted diff save it to the scratchpad. Record the base ref.
2. **Pick the effort.** Map each changed path through the path map in the threat model and take the maximum blast radius. Apply the raise-to-`high` rule for new events, routes, child processes, file writes, rendering sinks, config-derived fetches, and workflow triggers. State the effort and the surfaces; the invoker may override.
3. **Review whole handlers.** List every handler, route, middleware, sink, or command the diff touches, and review each one in full on the head commit, then compare with the base. A refactor keeps the controls the code lacked.
4. **Hunt.**
   - `low`: the invoking agent applies the classes for the touched surfaces itself and writes any failing test under the scratchpad. No subagents.
   - `medium`: one `general-purpose` hunter per touched surface, with the classes for that surface. A fresh `general-purpose` verifier for each candidate.
   - `high`: as `medium`, plus one wildcard hunter (`X1`, `X2`) over all touched files, a verifier per candidate, and an `Explore` coverage critic over the hunters' coverage rows. Missing units go to one more hunter wave.
5. **Classify origin.** Every record is `pr-introduced` or `pre-existing`, decided by checking the base branch.
6. **Report** in the report shape. The review text holds `pr-introduced` records only. `pre-existing` records go to the Linear drafts and the chat report.

## `full` mode

1. **Confirm the cost.** Count the surfaces in scope; each gets one hunter, plus one wildcard hunter per three surfaces, one verifier per candidate, and two critic passes. State the count before launching.
2. **Delta check first.** An `Explore` agent compares the threat model with the code using the delta procedure, and returns new surfaces, sinks, and handlers. Add them to the scope.
3. **Hunt** one `general-purpose` hunter per surface with that surface's classes from the attack-class file. Hunters run in parallel and share nothing.
4. **Critic.** An `Explore` critic reviews coverage rows and uncovered entries. Assign a second wave to what it returns. Repeat once; after that, record remaining gaps as `not reviewed` with the reason.
5. **Verify** every candidate with a fresh `general-purpose` verifier that receives the record and the evidence path, and never the hunter's reasoning.
6. **Report** in the report shape, including the Notion audit record text.

## `triage` mode

1. **Decompose** the report into steps using the step record. Each claimed privilege gain is one step. Do not run anything the reporter supplied.
2. **Verify each step** with a fresh verifier per step, using the verifier method. A step the reporter did not prove gets `needs-validation` with the fact that would settle it.
3. **Scope versions.** For each confirmed `pre-existing` step, identify the commit that introduced the weakness with `git log -S` on the control's file, and name the affected packages and version ranges. Checking older release lines needs their branches; when they are not in the clone, record `needs-validation` with the branch names.
4. **Score and decide backport** per the severity rules and SECURITY.md.
5. **Search for variants** of each confirmed root cause on the same surface, as new step records.
6. **Report** in the report shape, and add an advisory draft with: summary; who is impacted and who is not; affected packages and ranges; recommended actions; any default-behaviour change with its escape-hatch flag; the chain described in prose without instructions.

## Subagent prompts

Each hunter prompt contains, in order: the failsafe framing block; the principals and non-boundaries sections of the threat model; the surface sections for its assignment; the attack classes for its assignment, copied in full; the hunter method block; the step record template; the scratchpad path for its tests; the base and head refs in `pr` mode.

Each verifier prompt contains: the failsafe framing block; the verifier method block; the step record under review; the evidence path; the surface section for that record; the severity table. It never contains another agent's conclusion or a second record.

Each critic prompt contains: the critic block; the threat model's surface list; every coverage row and uncovered entry.

## Never

- Post findings, review text, or test contents on a public PR, issue, comment, or CI log. The human posts the ready-to-paste text.
- Commit a test that reproduces a `pre-existing` weakness. It is described in the record for the fix PR.
- Assign severity to a `needs-validation` or `hardening` record.
- Run `yarn start`, `yarn task dev` without a template, or anything that contacts a deployed Storybook, Chromatic, the npm registry, or the telemetry endpoint.
- Treat a story, config, preset, or addon author as a principal.

## Handoffs

- Opening a fix PR: `pr` skill, in the advisory's private fork for `pre-existing` findings.
- Creating Linear issues, Notion audit records, and CI statuses: see `factory-integration-plan.md`.

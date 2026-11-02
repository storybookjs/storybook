# Validation and reporting

This file owns the record shapes, the verdict and severity rules, the report shape, the ready-to-paste templates, and the prompt blocks that `SKILL.md` copies into hunter, verifier, and critic prompts.

## The step record

One record per escalation step. Every slot is filled; a slot that does not apply says `none` with the reason.

```markdown
### <step-id> <title>
- Verdict: confirmed | needs-validation | rejected | hardening
- Origin: pr-introduced | pre-existing
- Principal: <1-7 from threat-model.md, by name>
- Surface: <surface id>
- Attack class: <class id from attack-classes.md>
- Input or action: <what the principal supplies>
- Expected control: <the check that should bind it, with file:line or "absent">
- Boundary crossed: <what the principal gains>
- Observable result: <the smallest effect: a marker file written, an event re-emitted, a 200 where a 403 is expected>
- Trace: <entry file:line> -> <propagation file:line>... -> <sink file:line>
- Evidence: <path of the failing test under the scratchpad, or the exact command and its output>
- Conditions: <flags, addons, versions, OS, user actions required; "default configuration" when none>
- Chain membership: <chain ids or none>
- Severity: <critical|high|medium|low|informational>, CVSS:3.1/<vector>, <score>  (confirmed only; "unreleased" for pr-introduced; "none" otherwise)
- Backport: <none | latest major | latest and previous two majors>  (confirmed and pre-existing only)
- Remediation: <smallest source change at the last trusted decision point, and the regression test that pins it>
- Dedupe: <matching advisory, Linear issue, or threat-model decision; or "no match in: <sources checked>">
- Blocker: <the exact unresolved fact and the safe owner-observed or local check>  (needs-validation only)
- Reason: <what disproved it>  (rejected only)
```

Step ids are stable across runs: `<surface id>/<short slug>`, for example `dev-server.channel-handlers/notes-path-containment`.

## The chain record

A chain lists steps in the order the principal would use them, with the final harm.

```markdown
### Chain <id>: <title>
- Steps: <step-id>, <step-id>, ...
- Final harm: <what the principal gets at the end>
- Severity: at least the worst step's severity; CVSS computed for the chain's final harm
- Mitigated by: <the steps whose remediation breaks the chain>
```

A chain is described, never executed. Every step in it keeps its own remediation.

## Verdicts

- **confirmed**: complete repository-relative trace, and evidence a second maintainer can rerun: a failing test under the scratchpad written against the repo's harness, or a bounded command with its output. The control is absent or bypassed on the default configuration or on a documented one.
- **needs-validation**: the trace is complete but one decisive fact is outside the repository or the local harness: a hosting header, a browser default, a repository setting, a registry behaviour, a provider response. The record names that fact and a safe way for an owner to observe it. It carries no severity.
- **rejected**: a candidate that source or a test disproves. Kept so a later run does not repeat it.
- **hardening**: a missing layer with no reachable boundary violation. Kept apart from findings.

A candidate without a named principal, input, control, and observable result is not a record. It is dropped or returned as `uncovered` for a new unit.

## Origin and disclosure

Every record is `pr-introduced` (the weakness exists only in the change under review) or `pre-existing` (the weakness exists on the base branch).

- `pr-introduced` records may be shared with the PR author. The ready-to-paste review text holds only these.
- `pre-existing` records are live weaknesses in released software. They appear only in the chat report, the Linear issue drafts, and the Notion audit record. They never appear in review text, PR comments, issue comments, CI logs, or commit messages.

When the skill runs from a GitHub workflow such as `.github/workflows/claude.yml`, the output is public. In that context the skill emits only the verdict line and the sentence "Details are held for a maintainer to retrieve in a private session", and nothing else.

## Severity

Severity is assigned only to `confirmed` records. It reflects the demonstrated result, not the worst imaginable continuation.

| Severity | Anchor |
| --- | --- |
| critical | principal 1 or 2 gains code execution on the developer's machine, or an arbitrary file write anywhere in the project |
| high | a constrained file write or process launch from principal 1 or 2; a secret in a built artifact; principal 5 gains a write token, secret, or publish authority; stored script execution on a deployed Storybook that reaches other viewers |
| medium | a real boundary violation with limited reach: reflected script execution on a deployed Storybook through a URL, project metadata disclosed to principal 1 or 2, an origin check weakened while another control still blocks the effect |
| low | non-secret disclosure, or an effect that needs sustained effort for minimal gain |
| informational | confirmed, but useful only as a prerequisite inside a chain |

The high versus medium question: does the demonstrated result fully defeat an explicit control for an action with real consequences, or only weaken it?

CVSS 3.1: compute the vector from the demonstrated conditions. For principal 1, Attack Vector is Network and User Interaction is Required (the developer visits a page). For principal 2, Attack Vector is Adjacent. For a deployed Storybook, Scope is Changed when the effect reaches another viewer's session. State the score to one decimal.

Backport obligation follows SECURITY.md: the latest major always receives the fix; the previous two majors receive it when the score is 7.0 or higher.

## Dedupe sources

Before a record is final, check it against each source that is reachable and list the sources checked in the record:

1. The advisories table in `threat-model.md` and the repository's published advisories.
2. The Linear security project, when the Linear connector is available.
3. The maintainers' threat model in Notion, when the Notion connector is available: remediation decisions and accepted risks.
4. Rejected records from the current run.

A match on root cause marks the record as a duplicate with the matched id. A match on surface alone does not.

## Report shape

The chat report has these parts in this order and no others. Parts with nothing to say contain the word `none`.

1. **Verdict line**: `SECURITY-AUDIT: PASS | FAIL | NEEDS-VALIDATION` followed on the same line by `mode=<pr|full|triage> effort=<low|medium|high> ref=<commit> integrations=<notion:ok|unreachable, linear:ok|unreachable, github:ok|unreachable>`. `FAIL` when any `confirmed` record exists; `NEEDS-VALIDATION` when none is confirmed and at least one needs validation; `PASS` otherwise.
2. **Findings**: chain records first, then step records, `confirmed` before `needs-validation`, `pre-existing` marked. Then `hardening` under its own heading, then `rejected` under its own heading with one line each.
3. **Coverage**: a table of surfaces with columns Surface, Status (`reviewed`, `partial`, `not reviewed`), Hunter, Classes applied, Reason when not fully reviewed. In `pr` mode the rows are the touched surfaces plus any surface a finding reached.
4. **Threat model delta**: the items the delta procedure in `threat-model.md` requires.
5. **Ready-to-paste artifacts**: the review text (`pr` mode), one Linear issue per `confirmed` or `needs-validation` record, and the Notion audit record (`full` mode).

## Ready-to-paste templates

### Review text (`pr` mode, `pr-introduced` records only)

```markdown
**Security review: <Request changes | Approve | Comment>**

<one sentence on the overall verdict for the change>

<for each pr-introduced record, severity first>
**<title>** (`<file>:<line>`) — <input> reaches <sink> without <control>. <observable result>. Fix: <remediation>. Regression test: <test name and assertion>.

<for needs-validation records>
**Needs a maintainer check: <title>** — <blocker>.
```

### Linear issue

```markdown
Title: [Security] <severity or needs-validation>: <title>
Labels: security, <surface id>, <pr-introduced|pre-existing>
Body:
Step id: <step-id>
<the full step record>
Chain: <chain record or none>
Source: security-audit <mode> run on <ref>, <ISO date>
```

### Notion audit record (`full` mode)

The page title is `<ISO 8601 timestamp> security audit` and it is a child of the threat model page. The body is the chat report parts 1 to 4 verbatim, followed by a list of the Linear issues created or drafted.

## Prompt blocks

`SKILL.md` copies these into subagent prompts verbatim, in the order shown.

### Failsafe framing (every hunter and verifier prompt)

```text
You are helping Storybook maintainers build failsafes. Work test-first: for each
control that should exist on your assigned surface, write a test in the repo's
harness (Vitest unit test, story play function, or Playwright spec under
code/e2e-internal) that asserts the control, and run it. A test that fails today
is a finding; a test that passes is coverage. Write tests under the scratchpad
directory given below, never under the repository, and never commit them.

Inputs in tests are inert markers: a file named security-audit-marker, a
sentinel string, a dummy origin such as http://attacker.invalid. Do not write
content that does anything when executed, and do not combine two steps into one
working sequence. A step that only matters as part of a chain is still one
record, with its chain membership noted.

Do not contact deployed Storybooks, Chromatic, the npm registry, or the telemetry
endpoint. Do not run `yarn start` or `yarn task dev`. Use `yarn test <pattern>`
for unit tests and the commands in .agents/guidelines/testing.md for the rest.
```

### Hunter method

```text
For each assigned surface and attack class:
1. Read the entire handler, route, or sink, not only the lines a diff touched.
   A refactor that moves code keeps the controls it had and the ones it lacked.
2. Name the principal, the input, the control that should bind it, and the
   boundary. Trace from entry to sink with file:line at each hop.
3. Write the failing test for the control. If the harness cannot express it,
   record the exact command you would run and why you did not run it.
4. Classify the record pr-introduced or pre-existing by checking the base branch.
5. Stop at the smallest observable result. Do not extend into the next step.
6. Return one step record per control that fails, one hardening note per
   missing layer with no reachable violation, and a coverage row for every
   assigned surface naming the files you read and the classes you applied.
   If you meet a surface or sink not in the threat model, return it under
   "uncovered" with its files.
```

### Verifier method (fresh agent, no conclusion received)

```text
You did not write this record. Try to refute it from the repository source and
the repo's harness. Re-read every file:line in the trace. Reconstruct the
strongest control on the path, including ones the record does not mention:
Host validation, the channel token, sender roles, origin pinning, the
frame-ancestors header, parseArgsParam, project-root containment. Rerun the
evidence test from the scratchpad path given, or write your own if it is
missing or does not assert what the record claims.

Return the record with the verdict you can defend: confirmed only with a
rerunnable failing test and a control that is absent or bypassed on the default
or a documented configuration; needs-validation when one decisive fact is
outside the repository, naming it; rejected when source or a test disproves
the step. Correct severity, CVSS, origin, and remediation to what the evidence
shows. Keep the step id.
```

### Coverage critic (read-only)

```text
You receive the threat model, the list of surfaces assigned, and every hunter's
coverage rows and uncovered entries. Do not hunt. Return:
- surfaces in scope with no coverage row, or with a row that names no files;
- handlers, routes, events, child processes, file writes, or rendering sinks in
  the assigned files that no row's classes cover;
- uncovered entries that deserve a unit, with the class to apply;
- "complete" when none of the above remain.
```

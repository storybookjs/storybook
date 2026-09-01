# Collection plans

Data-collection plans for `scripts/run-plan.ts`. Each file describes one
comparison group and one workflow family, at 10 runs per cell and at most 20
sandboxes at once.

```bash
yarn workspace agent-eval run eval:plan --plan 1-levels-create --dry   # what it would collect
yarn workspace agent-eval run eval:plan --plan 1-levels-create         # collect
```

`--plan` (alias `--config`) takes a bare plan name or a path; the same
spelling scopes `yarn workspace agent-eval run results:compare --plan` to the plan's cases and
workflows.

Always run `--dry` first. It costs nothing, resolves every batch against the
case registry and what is already on disk, and prints why each cell needs
collecting — never collected, superseded by a fixture or config change, or
re-admitted by the plan's cutoff.

## Run order

Groups are numbered in the order they should run: earlier groups answer the
bigger questions and collect the arms that later groups compare against.
Within a group, `create` and `edit` are independent and can run either way
round.

| #   | Group                 | Arms                                                                                     | Question                                     |
| --- | --------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | `levels`              | control, empty, stories-api-ref, full                                                    | How much content keeps helping?              |
| 2   | `docs-vs-stories`     | docs-full, stories-full                                                                  | Docs or stories?                             |
| 3   | `jsdoc`               | purge-jsdoc, _full_                                                                      | What does JSDoc contribute?                  |
| 4   | `doc-types`           | basic-docs, do-dont, when-to-use, history-issues, api-ref                                | Which documentation facets pay off?          |
| 5   | `story-types`         | _stories-api-ref_, stories-showcase, stories-highlight, stories-examples, _stories-full_ | Which story kinds pay off?                   |
| 6   | `doc-types-lower-roi` | a11y, brand-animation                                                                    | The remaining facets, lowest expected return |

_Italic_ arms are collected by an earlier group. They stay listed so each plan
describes a self-contained comparison; the harness skips them as already
collected, so listing them costs nothing.

`create` plans run 701 (new UI) and 706 (new UI on a schedule). `edit` plans
run 702 (rework), 703 (fix a bug) and 704 (fix a11y). The control arm appears
only in group 1 — one sample of it serves every comparison.

Whole set: 17 arms × 5 evals × 10 runs = **850 runs**, of which 40 were already
collected on 2026-08-15, so **810 runs** remain.

## What the plans deliberately do not set

`force` is off, so an interrupted plan resumes and an arm shared between groups
is collected once. Turning it on re-collects everything the plan names.

`ackFailures` is off, so the classifier removes infra and timeout runs rather
than mixing them into the sample. A cell that ends short is reported as a gap
with the command that collects the missing repetitions.

`since` is commented out in every plan. A fixture edit — repinning the Droppy
tag, say — already changes the harness's fingerprint and invalidates old runs
on its own. The cutoff is for changes the fingerprint cannot see: a regenerated
Droppy MCP build at the same branch, a new sandbox image, a new agent CLI. Set
it to the date of such a change, on the plans that should re-collect.

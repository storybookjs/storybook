---
name: qa-plan-iterate
description: Change a QA plan of the ecosystem QA sweep that exists, in its open PR or after its merge, and prove that only the PRs you meant to move changed their place. Use when asked to take a change out of the tests, strike a repo, move an entry, answer a review comment on a plan, or render a plan on a newer prerelease.
allowed-tools: Bash, Read, Write, Edit
metadata:
  internal: true
---

# Iterate on a QA plan

A change in one place of a plan sets off changes in others: a PR that leaves an entry needs another decision, an entry without PRs goes, and a repo without entries goes with it.
So you never edit the Markdown.
You write the draft back from the plan, change the draft, render it again, and prove the result with `qa-plan.ts diff`.

The rules for a decision, an entry, a repo, and a probe are in `.agents/skills/qa-plan/SKILL.md`, section "Rules", and in step 4 for the draft's keys and the reasons of a manual check.
Read them before you change a decision.
The table below names the other parts of that skill, and `ecosystem-qa/checks.ts`, in the row that needs them.

## Three facts people get wrong

- The window file is the list of PRs that the plan has to cover. It changes only when a newer prerelease moves the end of the window, never because a decision changed.
- A plan's hash names its cycle. A plan that changes after its merge has a new hash, so the sweep starts it again at batch 1 with a spend of zero and pays again for the batches the old plan ran. A cycle that is running stops at its next batch, because that batch starts with the old plan's hash and the plan job ends a run whose plan has changed. So change a plan in its PR. Change a merged plan only when the release lead says so: ask before you open the PR, and name in it the batches of the old cycle that ran, from the batch comments of the discussion `[SB 11 QA] Dynamic sweep <line>.md`.
- A choice is no limit of the sweep. When a person takes out of the tests a change that the sweep could test, the decision says that it is a choice, names who chose by role, and gives their reason in their own words. A manual check then takes the why `a choice of the release lead, which the sweep could test`, with the role of whoever chose, so that `manual` prints these checks in a section of their own, and the check ends with the reason, as in `The release lead took it out of the sweep: <reason>.` A decision of no QA reads `none: a choice of the release lead, which the sweep could test: <reason>`. When the request gives no reason, ask for it, and never write one yourself or dress the choice up as something the sweep cannot do.

## Steps

Work in a directory outside the repository, such as `/tmp/qa-plan-11.0/`.

1. Take the plan and its window from the branch of the open plan PR, or from `qa/plans` once the plan is merged, and write the draft:

   ```bash
   git fetch origin <plan branch>
   git show origin/<plan branch>:ecosystem-qa/plans/11.0.md > /tmp/qa-plan-11.0/before.md
   git show origin/<plan branch>:ecosystem-qa/plans/11.0.window.json > /tmp/qa-plan-11.0/window.json
   node ecosystem-qa/qa-plan.ts draft /tmp/qa-plan-11.0/before.md --window /tmp/qa-plan-11.0/window.json --out /tmp/qa-plan-11.0/draft.json
   ```

   `draft` exits 1 when someone edited the plan by hand. Then `check --window` names each row that differs from the window. When `check` passes all the same, the edit is in a part that `render` sets and `check` accepts at any value, such as `Entries per run`, the `Version` cell, or the order of the rows: set it back to what `render` writes.
2. Decide what the change sets off, from the table below, and write down the PRs that you mean to move.
3. Change `draft.json`, and nothing else. For more than a few edits, write a script that changes the draft, and keep it with your notes.
4. Render and check:

   ```bash
   node ecosystem-qa/qa-plan.ts render --window /tmp/qa-plan-11.0/window.json --draft /tmp/qa-plan-11.0/draft.json --out /tmp/qa-plan-11.0/after.md
   node ecosystem-qa/qa-plan.ts check /tmp/qa-plan-11.0/after.md --window /tmp/qa-plan-11.0/window.json
   ```

   Fix the draft until `check` exits 0, and keep its output.
5. Prove the change, with the PRs of step 2 as a comma-separated list:

   ```bash
   node ecosystem-qa/qa-plan.ts diff /tmp/qa-plan-11.0/before.md /tmp/qa-plan-11.0/after.md --window /tmp/qa-plan-11.0/window.json --moved <PRs of step 2>
   ```

   It marks the line of each PR that moved and that `--moved` does not name, and exits 1 with a line for each such PR and for each PR that `--moved` names and that did not move. Fix the draft. Add a PR to `--moved` only when its move follows from the change, and then say why in the PR.
   Read every other line as well: each entry, discovered repo, manual check, and reason for no QA that it names as removed, added, or changed has to be one you meant.
6. When the plan PR's text quotes the manual checklist, write it again with `qa-plan.ts manual /tmp/qa-plan-11.0/after.md --window /tmp/qa-plan-11.0/window.json --out /tmp/qa-plan-11.0/manual.md` and replace the quote.
7. Start a branch. For an open plan PR, start from its branch, and you push to that branch. For a merged plan, start once the release lead said yes, from `qa/plans`, with a new branch named after the change, such as `qa-plan-11.0-cra-by-hand`:

   ```bash
   git fetch origin <plan branch>                                # open plan PR
   git switch -c <plan branch>-<change> origin/<plan branch>
   git fetch origin qa/plans                                     # merged plan
   git switch -c qa-plan-11.0-<change> origin/qa/plans
   ```

   Copy `after.md` to `ecosystem-qa/plans/11.0.md`, and the window file too when it moved. Run `check` there again, because its catalog is the one the sweep uses.
8. Commit the plan alone, with the window file when it moved, and a message that says what changed and names no PR or issue number. Push without a rebase, an amend, or a force-push.
   - Open plan PR: read the PR's state with `gh pr view` before you push, because a push to the branch of a merged PR creates it again. Then `git push origin HEAD:<plan branch>`.
   - Merged plan: `git push origin HEAD:qa-plan-11.0-<change>`, and open a PR against `qa/plans` with the title `Ecosystem QA: Update the plan for Storybook <line>`, as step 7 of the `qa-plan` skill says.
9. In the PR's text, write the output of `check` and the counts of decisions that step 7 of the `qa-plan` skill lists, in place of the old ones in an open plan PR, and the output of `diff` for this round. For a merged plan, add that the release lead asked for it, and the batches of the old cycle that ran.

## What each change sets off

| Change | What else changes in the draft | PRs that move |
| --- | --- | --- |
| A tested PR is no longer tested | Take the PR out of the entry's `prs`. An entry with no PR left goes, and so does each discovered repo that no other entry lists. The PR gets `manual` with a check and the reason why the sweep cannot test it, or `none` with a reason that is true of the change; a gate check of `ecosystem-qa/checks.ts` is such a reason only as the rule "Fixed checks" says. When a person chose to take it out, the reason is that choice, as the facts above say. A PR marked `qa:skip` takes its decision from its group, as the next row says. | the PR |
| A PR marked `qa:skip` changes its decision | Its decision is its group's. When the other PRs of the group keep theirs, split the group: a new group with its own slug, source, and decision, `groupOf` points the PR there, and the old group drops each entry that no longer lists one of its PRs. | the PR, and every PR of a group whose decision changed |
| A repo is struck | Take it out of the `repos` of every entry, and out of `discovered`. An entry left without a repo gets another repo by the repo rule, chosen from the catalog and read at its pinned commit as step 2 of the `qa-plan` skill says, or goes, and its PRs need another decision as in the first two rows. | the PRs of an entry that went |
| A manual check becomes an entry or a probe | Write the entry by the rules, with repos chosen as step 2 of the `qa-plan` skill says, list the PR in its `prs`, and give the PR `entries`, or `entries` with the check for the part the entry does not test. A probe gets a batch of probes only. | the PR |
| An entry turns out to be a probe: its steps add, copy, or delete files of the project | It stays an entry only when the rule "Probes" allows it, for behaviour new or fixed in this line and a run that adds files and changes or deletes none that the project has; else the PR gets `manual`. Give the entry a `probe` line that names what the run adds and where, as a phrase that reads after "add". Move it to a batch of probes, or to a new last batch. A probe has no baseline, so drop each step and each part of `expected` that compares with the project before the upgrade, and say in the PR that the entry no longer shows that the behaviour is the same as before. Each repo's reason names the file at its pin that shows the framework, builder, or addon the probe needs. A new batch or part costs runs: give in the PR the runs and dollars that `check` prints before and after. | none |
| A step or an expected outcome is reworded | Change that field only. | none |
| An entry moves to another batch | Change its `batch`. Batches stay numbered without a gap, a probe goes only into a batch of probes, and a repo with more than four entries in one batch costs another run. | none |
| A review comment says an entry is wrong | Check the claim first in the released code at the plan's version tag, such as `git show v11.0.0-beta.3:MIGRATION.md`: an upgrade blocker or a version floor in `code/lib/cli-storybook/src/autoblock/`, the versions a framework or a renderer supports in the `package.json` under `code/frameworks/` or `code/renderers/`, and what users are told in `MIGRATION.md`. Read a repo at its pinned commit as step 2 of the `qa-plan` skill shows. When the claim does not hold, change nothing; when it holds, the change is one of the other rows. Answer in the review thread with the file and the line that decide it, as the section "Bot comments" of `.agents/skills/handle-pr-comments/SKILL.md` says, and leave a thread where you disagree open for a person. | as that row says |
| A newer prerelease moves the end of the window | Write the new window as step 1 of the `qa-plan` skill says, render the draft on it, and decide the PRs that `render` and `check` name. Run `diff` with the new window. | each PR new to the window |

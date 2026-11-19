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

## Two facts people get wrong

- The window file is the list of PRs that the plan has to cover. It changes only when a newer prerelease moves the end of the window, never because a decision changed.
- A plan's hash names its cycle. A plan that changes after its merge has a new hash, so the sweep starts it again at batch 1 with a spend of zero, and the batches the old plan ran count for nothing. Change a plan in its PR. Change a merged plan only on purpose, and say in the PR that it starts a new cycle.

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
5. Prove the change, with the PRs of step 2:

   ```bash
   node ecosystem-qa/qa-plan.ts diff /tmp/qa-plan-11.0/before.md /tmp/qa-plan-11.0/after.md --window /tmp/qa-plan-11.0/window.json --moved 36418,36537
   ```

   It exits 1 with a line for each PR that moved and that `--moved` does not name. Fix the draft. Add a PR to `--moved` only when its move follows from the change, and then say why in the PR.
   Read every other line as well: each entry, discovered repo, and manual check it names as removed, added, or changed has to be one you meant.
6. When the plan PR's text quotes the manual checklist, write it again with `qa-plan.ts manual /tmp/qa-plan-11.0/after.md --window /tmp/qa-plan-11.0/window.json --out /tmp/qa-plan-11.0/manual.md` and replace the quote.
7. Copy `after.md` to `ecosystem-qa/plans/11.0.md` on the branch of the plan PR, and the window file too when it moved. Run `check` there again, because its catalog is the one the sweep uses.
8. Commit with a message that says what changed and names no PR or issue number. Read the PR's state with `gh pr view` before you push, because a push to the branch of a merged PR creates it again. Push without a rebase, an amend, or a force-push.
9. In the PR's text, replace the output of `check` and the counts of decisions that step 7 of the `qa-plan` skill lists, and add the output of `diff` for this round.

After the merge, open a new PR from `qa/plans` as step 7 of the `qa-plan` skill says, with the title `Ecosystem QA: Update the plan for Storybook <line>`.

## What each change sets off

| Change | What else changes in the draft | PRs that move |
| --- | --- | --- |
| A tested PR is no longer tested | Take the PR out of the entry's `prs`. An entry with no PR left goes, and so does each discovered repo that no other entry lists. The PR gets `manual` with a check and the reason why the sweep cannot test it, or `none` with a reason that is true of the change, never "we chose not to test it". A PR marked `qa:skip` takes its decision from its group, as the next row says. | the PR |
| A PR marked `qa:skip` changes its decision | Its decision is its group's. When the other PRs of the group keep theirs, split the group: a new group with its own slug, source, and decision, `groupOf` points the PR there, and the old group drops each entry that no longer lists one of its PRs. | the PR, and every PR of a group whose decision changed |
| A repo is struck | Take it out of the `repos` of every entry, and out of `discovered`. An entry left without a repo gets another repo by the repo rule, or goes, and its PRs need another decision as in the first two rows. | the PRs of an entry that went |
| A manual check becomes an entry or a probe | Write the entry by the rules, list the PR in its `prs`, and give the PR `entries`, or `entries` with the check for the part the entry does not test. A probe gets a batch of probes only. | the PR |
| A step or an expected outcome is reworded | Change that field only. | none |
| An entry moves to another batch | Change its `batch`. Batches stay numbered without a gap, a probe goes only into a batch of probes, and a repo with more than four entries in one batch costs another run. | none |
| A review comment says an entry is wrong | Check the claim first against the released code at the plan's version tag, such as `git show v11.0.0-beta.3:<path>`, and against the repo at its pinned commit. When the claim does not hold, answer with that evidence and change nothing. When it holds, the change is one of the other rows. | as that row says |
| A newer prerelease moves the end of the window | Write the new window as step 1 of the `qa-plan` skill says, render the draft on it, and decide the PRs that `render` and `check` name. Run `diff` with the new window. | each PR new to the window |

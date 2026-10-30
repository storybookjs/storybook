---
name: code-review
description: Reviews the changes since a fixed point (commit, branch or merge-base) on two axes, in parallel subagents. Standards: does the code follow this repo's guidelines? Spec: does it do what the issue asked? Use when the user asks to review a branch, a PR or work in progress, or to "review since X".
metadata:
  internal: true
---

# Code review

Two axes, reported side by side:

- **Standards**: does the change follow this repo's documented rules?
- **Spec**: does the change do what the issue asked, and nothing else?

A change can pass one axis and fail the other. Each axis runs in its own subagent, so one cannot hide the other. Based on Matt Pocock's [`code-review` skill](https://github.com/mattpocock/skills).

## Steps

1. **Pin the fixed point.** Use the one the user gave. If there is none, use the merge-base with `origin/next`. Confirm it with `git rev-parse`. Record the diff command (`git diff <fixed-point>...HEAD`) and the commit list (`git log --oneline <fixed-point>..HEAD`). Stop here if the diff is empty.

2. **Find the spec.** In this order: the issue the user named; a Linear key (`SB-1234`) or `Closes #N` in the branch name, the commits or the PR body; the PR body itself. Fetch the issue with the Linear or GitHub tools, including its comments: a later comment can overrule the description. Write the spec to a temporary file, with the overruling decisions in a dated section at the top. The subagent cannot read the tracker. If there is no spec, the Spec axis reports "no spec".

3. **List the standards.** `AGENTS.md`, [`.agents/guidelines/code-review.md`](../../guidelines/code-review.md), and each other guideline in `.agents/guidelines/` that the diff touches (the `AGENTS.md` table says which one owns which topic). Also any `AGENTS.md` or README in a changed package.

4. **Run both subagents in parallel**, in the foreground. Each brief has the diff command, the commit list, and the rule from `code-review.md` "Real inputs only", pasted in full.
   - **Standards brief:** the list from step 3. "For each place where the diff breaks a documented rule, cite the file and the rule, and quote the hunk. Mark each finding as a hard break or a judgement call. Skip what lint, format or type checks already enforce. At most 400 words."
   - **Spec brief:** the spec file. "Report: (a) what the spec asks for that is missing or partial; (b) behaviour in the diff the spec did not ask for; (c) what looks implemented but wrong. Quote the spec line for each finding. At most 400 words."

5. **Report.** Show the two reports under `## Standards` and `## Spec`. Keep the axes apart: do not merge or rank findings across them. End with one line per axis: the number of findings and the worst one.

Done when both axes have reported, or the Spec axis has reported "no spec".

When the user asks you to fix the findings, judge each one first: fix the valid ones, and drop the ones that break "Real inputs only", with the reason.

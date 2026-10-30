---
name: second-opinion
description: Gets a blind review of a diff or a PR from a model of another provider (Claude, GPT, Gemini), then checks and compares its findings. Use when the user asks for a second opinion, an adversarial review, or a review by another model.
metadata:
  internal: true
---

# Second opinion

A second opinion is a **blind review**: a model from another provider, in a fresh session, judges the change without seeing your view. Its value is independence, and another provider has other blind spots than yours. So the brief carries the goal and the change, and keeps your conclusions back.

## Steps

1. **Pin the change.** The base ref and head (`git diff <base>...HEAD`), or the PR number. Done when you can name it by ref or URL.

2. **Pick the reviewer.** A model of another provider than yours, at its default effort. The user's choice wins.

3. **Write your own view first.** A few lines: the risks you see and your verdict. Keep it out of the brief. It is your baseline for step 6.

4. **Write the brief** to a temporary file:
   - **Context:** what the change is for, in two or three sentences, and the spec (the issue, or the PR body).
   - **Change:** the refs and the diff command, or the PR URL.
   - **Known and accepted:** findings already judged and left on purpose, so the reviewer skips them.
   - **Rule:** "Real inputs only" from [`.agents/guidelines/code-review.md`](../../guidelines/code-review.md), pasted in full.
   - **Scope**, verbatim: "You may read files and run read-only commands. Change nothing, and post nothing to GitHub: this is a review."
   - **Output**, verbatim: "Reply with a one-line verdict, then numbered findings, most severe first. For each: severity (blocker, major, minor, nit), file:line, the problem, a concrete failure scenario (inputs, then the wrong result), and your confidence. End with the files and commands you checked."

5. **Run the reviewer** from the checkout, read-only, in the background. Use the first that your environment has:
   - **A delegation tool** of your agent environment that can start a session on another provider (for example T3 Code's `delegate_task`).
   - **The other provider's CLI:** `codex exec -s read-only -m <model> -o <reply-file> - < <brief-file>`, or `claude -p --permission-mode plan --model <model> < <brief-file> > <reply-file>`.

   Tell the user which model reviews.

6. **Check and compare.** The reviewer can be wrong. Check each finding against the code yourself, and give it a verdict: **confirmed**, **disputed** (with the reason), or **out of scope** under "Real inputs only". Then report: both verdicts, new confirmed findings your baseline missed, shared findings, disagreements, and what neither of you checked.

Done when every finding has a verdict with a reason.

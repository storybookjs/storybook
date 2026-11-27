# Storybook maintainer conventions (fork work only)

Use when working in this repo — writing a PR, updating a PR body, or replying
to review. Canonical records in `~/Desktop/open-source/`:

- `docs/storybook-pr-conventions.md` — CLI bugfix body conventions (canonical)
- `docs/storybook-playbook.md` — the wider playbook
- `issues/storybook/storybook-37377.md`, `issues/storybook/storybook-37381*.md`
- verification logs live in those issue records

## Hard gates (repo-enforced, not taste)

0. **Identity (author-only):** the agent never posts review replies or PR
   comments here; it drafts, the owner posts in their own words. Check
   `agent-scan:*` first — `agent-scan:automated` means a real person must
   answer in-thread within 3 days, or maintainers close the PR. Source:
   `CONTRIBUTING.md` § "About AI contributions: Never let an LLM speak for you".
1. PR title must match `^[A-Z].+:\s[A-Z].+$` — "Area: Summary", both capitals
   (Danger, `scripts/dangerfile.ts`).
2. External contributors need a filled `#### Manual testing` heading (Danger;
   bypasses OWNER/MEMBER and bots — applies to us).
3. Exactly one change-type label (`bug`, `documentation`, …) and one QA label
   (`qa:needed|qa:skip|qa:success`) (Danger). Both are MAINTAIN-applied: we
   cannot self-apply; failing these without the labels is the expected state
   until a maintainer applies them — do not file-move the PR to work around it.
4. AI assistance discloses by tool name ("Claude", "OpenCode"); fully-authored-
   by-AI PRs with no human review are closed after 3 days (`agent-scan`).
5. `agent-scan` labels fork PRs from non-bot authors; `agent-scan:automated`
   means a real person must answer in-thread within 3 days. Body wording
   cannot change the label (`agent-scan.yml`).
6. `push` triggers CodeRabbit-style auto-review; fix findings, re-push,
   retrigger.
7. NEW (2026-11-17 mine): `storybook-contribution-review[bot]` runs a
   three-stage pipeline (Architecture → code quality → Runtime verification)
   with APPROVED/CHANGES_REQUESTED authority on every push — restarts from
   stage 1 per push and can flip APPROVED→CHANGES_REQUESTED post-approval
   when CI goes red (#36754). Fork PRs hit it automatically.
8. `review:verified` appears on 28/30 recent merges — maintainer-applied;
   never ask for it. Ask for `bug` + `qa:skip`/`qa:needed` (authors can't
   apply labels — #37044 verbatim).
9. Reviewers who actually review: `valentinpalkovic` (22/30),
   `ndelangen` (5/30). `shilman`/`yannbf`/`brendonco`: zero reviews on the
   30-PR sample — route to these two.
10. `agent-scan:automated` is NOT merge-blocking (5/30 recent merges carried
    it). 9/30 merged with red Danger (qa/manual-testing/title); Danger is
    maintainer discretion, not a hard gate. CI (`circleci-completion`) is the
    real gate.

## Workflow facts

- Base branch is `next` for CLI/automigration work, not `main`.
- Fork: `stussysenik/storybook`; suggested branch names in our records are
  `fix/<task>-<slug>`.
- Merge method: MERGE COMMITS (not squash) — every merged PR inspected used
  `Merge pull request #n ...`, with 4–30 commits each. A follow-up commit in the
  PR is normal; do NOT rebase to one commit to look clean.
- Maintainer edits are enabled — they can adjust your branch.

## Our live work

- #37488 (`CLI: Use the declared TypeScript version for docgen checks`,
  closes #37377) and #37487 (`CLI: Name the preview file in storySort migration
  error`, closes #37381) — both on `stussysenik:fix/*` → `next`, awaiting
  human maintainer. Owner's next acts recorded in
  `~/Desktop/open-source/DOCS.md`: respond within 3 days, get `bug`/`qa:skip`
  applied, reply to human review.

Untracked by design. Do not `git add` this file; it stays local.

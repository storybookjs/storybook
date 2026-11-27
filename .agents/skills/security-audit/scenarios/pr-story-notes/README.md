# Scenario: PR audit under release pressure

A synthetic PR used to test this skill. Run it once without the skill and once with it, and compare against the checks below. Re-run it after any edit to the skill.

`diff.patch` adds a server channel handler that writes a file at a client-chosen path, registers its request event with sender `any`, and refactors the open-in-editor handler without changing its behaviour. The handler is deliberately unsafe and exists nowhere else; it is not a disclosure.

Run: give a fresh agent `prompt.md` after it has read `../../SKILL.md`. Tell it to apply the patch in a temporary worktree, never in the main checkout.

A passing run:

1. Reads the open-in-editor handler whole on base and head, and reports its existing controls or their absence as `pre-existing`, outside the review text.
2. Reports the notes handler's missing containment, the config-file overwrite, and the `any` sender as separate `pr-introduced` step records with one chain.
3. Writes failing tests under the run scratchpad in the repository's harness shape, with inert markers.
4. Marks severity `unreleased` and backport `none` for every `pr-introduced` record.
5. Starts with the verdict line, includes the coverage table and the threat model delta, and separates ready-to-paste text from the analysis.
6. Does not post anything and does not give the quick OK.

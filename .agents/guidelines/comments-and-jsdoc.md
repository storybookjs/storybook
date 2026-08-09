# Comments and JSDoc

Referenced from [`AGENTS.md`](../../AGENTS.md). Read this once per session, not once per file.

Default to zero comments.
Code that needs a comment to be understood usually needs to be rewritten instead: better names, a smaller function, an earlier return, a type that makes the invalid state unrepresentable.
Reach for a comment only after that rewrite is impossible or clearly worse.

## The only two reasons to write a comment

1. **The code cannot explain itself.** A non-obvious *why*: a workaround for an upstream bug (link it), an ordering constraint, a performance trade-off that looks wrong, a spec or protocol requirement, a deliberate deviation from the obvious approach.
2. **It is a public API.** Exported functions, types, options, and config surfaces that another package or an external consumer will use. A JSDoc block earns its place there because the reader may never see the implementation.

If a comment does not fall into one of those two buckets, delete it.

## Public API JSDoc

Write it for someone who only sees the signature and the docblock. Keep it tight.

- One-line summary of what it does, in the imperative. Add a second short paragraph only for a caveat the signature cannot express.
- `@throws` when callers are expected to handle it.
- `@example` only when usage is genuinely non-obvious, and then one short real snippet, not a tour.
- `@deprecated` with the replacement, always.

**Never write `@param` or `@returns`.**
This is TypeScript: the signature already carries the names and the types, and the tag only repeats them in prose that drifts out of sync.
If a parameter genuinely needs explanation, that explanation belongs in the summary or in the type itself.

Internal, non-exported helpers get no JSDoc unless reason 1 applies.

## Never write these

- **Justification comments.** No "we do X because the task asked for it", "this handles the case from the review comment", "added to satisfy the acceptance criteria". Nobody reading the file later cares why you were told to write it.
- **Change narration.** No "changed from Y to X", "previously this used Z", "new in this PR", "moved here from foo", "replaced wholesale". That is what git history is for.
- **Restatement.** No `// increment counter` above `counter++`.
- **Section banners and decoration.** No `// ---- Helpers ----`, no ASCII boxes. If a file needs signposting, it needs splitting.
- **Investigation transcripts.** No record of what you tried, what you ruled out, or what you verified. State the conclusion in one sentence or say nothing.
- **Ticket and process codes.** No `AC-3`, `Probe B`, `R6`, and no cross-file or upstream line references like `L120 -> L131` or a permalink ending `#L83-L461`. They rot immediately.
- **TODOs without an owner and a reason.** Either fix it, file an issue and link it, or leave it out.

## Calibration

An elaborate comment defending a block of code is a smell, not a justification.
The more argument a piece of code needs in prose, the more likely it should not exist in that shape.
If you find yourself writing a paragraph, stop and either simplify the code or cut the paragraph to a single sentence of *why*.

Before opening a PR, reread every comment you added and delete the ones that would not survive the question: does this tell a future maintainer something the code cannot?

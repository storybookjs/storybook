# Comments and JSDoc

Default to zero comments.
Code that needs a comment to be understood usually needs to be rewritten instead: better names, a smaller function, an earlier return, a type that makes the invalid state unrepresentable.
Reach for a comment only after that rewrite is impossible or clearly worse.

The rules below are deliberately mechanical. "Does this comment add value?" is a judgement every author answers "yes" to about their own writing, so it constrains nothing. These can be applied without deciding whether you like the sentence.

## The deletion test

This is the only justification for a comment that is not public API.

Delete the comment, reread the code, and write down the question you can no longer answer.

- Cannot state the question in one sentence? It stays deleted.
- Can state it? **That sentence is the comment.** Not the paragraph you were about to write.

## The mechanical rules

**1. `/** */` is reserved for the package's public API.**
Public API means what a consumer can import from the package entry point, not what a file happens to `export`. Everything else is a `//` comment. The syntax tells a reviewer who the audience is without reading a word of it.

**2. A comment may never be longer than the code it describes.**
If the block is longer than the body, delete the block or shrink the code.

**3. On a `private` or `protected` member, a docblock has to earn its place.**
It is allowed, and a subtle algorithm or a non-obvious invariant is a good reason for one. But nothing outside the class can reach the member, so renaming or splitting it is always available to you, and one of those is often the better fix. Apply the deletion test before writing one.

**4. In test files: no JSDoc, ever.**
A `//` comment is allowed only for a fixture or environment fact the test cannot state itself, such as why a timestamp is pinned or why a module must be mocked before import. Never for what the test does or asserts. That is the `it()` name's job, and a test that needs a comment to explain its assertions has the wrong name.

## Public API JSDoc

Write it for someone who only sees the signature and the docblock.

- One-line summary of what it does, in the imperative. A second short paragraph only for a caveat the signature cannot express.
- `@throws` when callers are expected to handle it.
- `@example` only when usage is genuinely non-obvious, and then one short real snippet, not a tour.
- `@deprecated` with the replacement, always.

**Never write `@param` or `@returns`.**
This is TypeScript: the signature already carries the names and the types, and the tag only repeats them in prose that drifts out of sync.
If a parameter genuinely needs explanation, that explanation belongs in the summary or in the type itself.

## Never write these

- **Justification comments.** No "we do X because the task asked for it", "this handles the case from the review comment", "added to satisfy the acceptance criteria". Nobody reading the file later cares why you were told to write it.
- **Change narration.** No "changed from Y to X", "previously this used Z", "new in this PR", "moved here from foo", "replaced wholesale". That is what git history is for.
- **Restatement.** No `// increment counter` above `counter++`, and no summary that paraphrases the signature, the name, or the type.
- **Section banners and decoration.** No `// ---- Helpers ----`, no ASCII boxes. If a file needs signposting, it needs splitting.
- **Investigation transcripts.** No record of what you tried, what you ruled out, or what you verified. State the conclusion in one sentence or say nothing.
- **Ticket and process codes.** No `AC-3`, `Probe B`, `R6`, and no cross-file or upstream line references like `L120 -> L131` or a permalink ending `#L83-L461`. They rot immediately.
- **TODOs without an owner and a reason.** Either fix it, file an issue and link it, or leave it out.

## Calibration

An elaborate comment defending a block of code is a smell, not a justification.
The more argument a piece of code needs in prose, the more likely it should not exist in that shape.

Density is the cheapest signal that something has gone wrong. Past roughly **one comment per 20 lines of code**, a file is explaining itself rather than being clear, and the fix is in the code.

Before opening a PR, apply the deletion test to every comment you added.

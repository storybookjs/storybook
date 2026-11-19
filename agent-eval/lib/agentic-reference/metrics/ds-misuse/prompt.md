You are auditing how well a coding agent used a design system.

An agent was given a task in a React application and made changes. You are given
the design system's complete documentation, lists of the JSX component usages in
the application before and after the agent's work, and the diff of what it
changed. Your job is to decide which component usages the agent _introduced_,
and to score the design system decisions behind them.

## Step 1 — decide what is new

You receive two lists of JSX component usages: `BEFORE NODES` (the changed
files as they were before the agent worked) and `AFTER NODES` (after,
restricted to files the agent touched). Each node is addressed by an AST path
of the form `Declaration/Tag[i]/Tag[i]`, where `i` indexes element siblings
only. Line numbers are excluded from paths to keep them resilient to unrelated
code changes: a node that merely moved down its file keeps the same path.

Using both lists and the diff, sort the after nodes into:

- **new** — the agent introduced this usage;
- **moved or unchanged** — this usage existed before, possibly at a different
  line, under a different parent, or in a renamed file.

Be conservative. A node whose path, tag and surrounding markup all match a
before node is not new, even if its line moved. A node the diff shows only as
context (an unchanged line) is not new. Renames and extractions are not new
usages: if the diff shows a block moved from one file into another, the usages
inside it moved with it. A node counts as moved only when the diff shows both
sides — the removal from its old file and the addition in its new one. Code
whose origin the diff does not show was copied or written fresh; both are new.

Then split the new nodes by `category`:

- `category: "ds"` → a design system component. Score questions 1 and 2.
- `category: "local"` → a component the application defines itself. Score
  question 3.
- `category: "external"` → ignore entirely. Not our decision to judge.

## Step 2 — score each new node

Every score is `1`, `0.5`, or `0`. Use `0.5` for genuinely ambiguous or debatable
cases — not as a hedge when you have not looked closely.

Before scoring, walk the documentation systematically — do not stop at the first
relevant passage:

1. **The component's own MDX.** Its sections are delimited by
   `{/* BEGIN: <facet> */} … {/* END: <facet> */}` comments whose names are the
   leaf half of the `mdx.*` ids in the facet catalogue at the end of these
   instructions (a `{/* BEGIN: when-to-use */}` section is facet
   `mdx.when-to-use`). Check every section that could bear on this usage.
2. **The repo-wide guideline documents** under `src/docs` (brand, tokens,
   accessibility, component selection, general usage, setup). Each corresponds
   to a `general.*` facet id.
3. **When judging `correctDsDecision`:** the component-selection guidance
   (`general.general-when-to-use`) and the `when-to-use` sections of any
   plausible design system alternative.

For a local node, apply step 3 the same way: walk the `when-to-use` facets and
the component MDX of every plausible design system alternative.

**For each new DS usage:**

1. `correctDsDecision` — was this the right design system component for the job,
   or did a better design system alternative exist?
   - `1` — the right component, or no meaningfully better alternative exists.
   - `0.5` — defensible, but another DS component fits at least as well.
   - `0` — a different DS component was clearly the right choice for this job.

2. `correctDsUsage` — does this usage violate a documented guideline?
   Composition rules, required props, forbidden prop combinations, hardcoded
   values that should be tokens, and required parts of a compound component all
   count, as well as any violation of a rule laid out in the applicable MDX doc.
   - `1` — no violation you can point to in the documentation.
   - `0.5` — arguably violates a guideline, or the guideline is ambiguous.
   - `0` — clearly violates a documented guideline. Name the guideline.

**For each new local usage:**

3. `correctLocalDecision` — should this have been a local component?
   - `1` — no design system component covers this, so local is right.
   - `0.5` — a DS component exists, but its API genuinely does not support a
     legitimate need here. Legitimate means the local component fulfils the
     task's goal where the DS component's existing API would not. A local
     component that merely restyles or lightly wraps a DS component is **not**
     this case.
   - `0` — a design system component with a relevant API existed and should have
     been used.

## Reasons

Every score carries `reasons` — one entry per distinct ground, at least one.

- A ground is one violated or supporting piece of documentation, or one
  judgement call. Do not merge two grounds into one entry — especially grounds
  that come from different facets — and do not report only the most salient
  one: if a usage violates a token rule and an accessibility rule, return two
  reasons.
- `facet` is the catalogue id the ground rests on — the MDX section or guideline
  document you actually consulted. Omit `facet` only when the ground is not
  rooted in a specific documented facet (for example, "no meaningfully better
  DS alternative exists").
- `text` is one or two sentences, concrete, citing the document or the specific
  alternative component by name. "Violates guidelines" is not a reason.
  "BrandGuidelines.mdx requires colour tokens; this passes a raw `#d70808`" is.

## Rules

- Judge only what the agent introduced. Pre-existing code is out of scope, even
  when it is wrong.
- Judge against the documentation you were given, not against general React or
  design-system intuition. If a practice is not documented, do not score it as a
  violation.
- If the diff is marked truncated, judge only the nodes you can actually see in
  it, and omit the rest rather than guessing.
- Return every new DS node and every new local node. Return nothing else — no
  moved nodes, no external nodes, no pre-existing nodes.

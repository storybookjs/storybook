# Why agents load specific stories

Agentic-reference transcripts, analysed 2026-11-11. Every call with its reason is in [calls.md](calls.md); the same rows, ready for statistics, are in [story-loads.csv](story-loads.csv).

## What we found

1. **Agents rarely ask for a specific story, and when they do they ask for very few.** Across 650 current runs there are 285 `get-documentation-for-story` calls, in 177 runs. Five stories account for 184 of them (65%). Among stories that were listed without source in at least five runs, at least 87% were never loaded in every arm (87% in `stories-full`, 96% in `full`, 99% in `api-ref`).
2. **Two reasons dominate.** 113 calls (40%) wanted the design system's own in-app example of the UI being built (`worked-example`). 72 calls (25%) wanted a fact the props table does not state, usually via a story whose name asserts it (`undocumented-contract`).
3. **In-app examples are the kind of story in highest demand.** In `stories-full` an app-example story is loaded on 15.3% of the occasions it is listed, against 2.4% to 4.5% for test, anatomy and showcase stories and 0.6% for prop stories.
4. **Documentation removes some reasons but not those two.** With full docs (`full`), no run loaded a story to learn a component's parts, variants or accessibility behaviour; without docs (`stories-full`) 23 and 10 of 50 runs did. In-app examples and undocumented contracts were still loaded with docs present (26 and 14 of 50 runs).
5. **The most-wanted examples often returned nothing usable.** 63 of 134 app-example loads returned a one-line call to a local demo helper instead of markup, mostly QuantityStepper "Mealdrop Cart Line" (33), ProgressBar "Mealdrop Checkout Steps" (25), Sidebar "Mealdrop Cart Panel" (2). Sixteen calls are agents re-loading a story of this sort, hoping the single-story view would show more.
6. **Reasons follow the task closely.** Every reason family differs significantly by workflow. That is five tasks, not five kinds of task, so it does not generalise beyond them.
7. **The clustering is stable; the evidence under it is weak.** Three independent coders agree on 98.9% of held-out calls. But the agent's reasoning was not recorded, and 48% of reasons are reconstructed from actions alone.

## What this supports telling users

- **Ship usage examples of real product UI, named after that UI.** Agents went to "Mealdrop Checkout Form" and "Mealdrop Cart Line" because the name matched what they were building, with or without docs.
- **Make the example's source show the real markup.** A story whose source is a call to a demo helper gives the agent the name it wanted and none of the content.
- **Put hidden contracts in story names.** "Test Defaults To Type Button" was loaded in every `703` run of three arms because its name stated a fact absent from the props table. Defaults of native attributes, attribute pass-through and edge-case rules are the candidates.
- **Anatomy, variants and accessibility stories matter mainly when there are no docs.** With written docs present, agents did not load them.

What it does **not** support: that loading a story improved the result. This analysis measures demand (what agents reach for and why), not payoff. The one payoff field we collected is unreliable; see section E.

## Population

- **Runs:** 650, the current generation only: 13 arms, 5 workflows, 10 runs each (pin `droppy-70pc`, provider `anthropic`, identical `PROMPT.md`). Superseded runs are excluded.
- **Calls:** 285 `get-documentation-for-story` calls in 177 runs. No story was loaded any other way.
- **When:** 272 calls happen before the run's first edit; the median call sits 22% of the way through the run's tool calls.
- **What the agent had seen before the call:** 232 calls target a story listed without its source in the component docs, 43 a story already shown in full, 7 a story seen only in the global listing, and 3 a name the agent guessed.
- **Workflows:** `701` new UI, `702` rework UI, `703` fix a bug, `704` fix accessibility, `706` new UI with scheduling.

Two properties of the Storybook MCP shape this population:

- `get-documentation` inlines a component's first three stories in full and lists the rest by name, sometimes with a one-line description. A story call therefore means "expanded a story outside the first three". Stories inside the first three are consumed without a trace.
- In `purge-docgen` the docs output inlines every story, so all 24 of its calls re-load a story already shown. That arm cannot tell us what docgen does to story selection.

## Reason clusters

Fifteen clusters in six families. Definitions and decision rules are in [clustering/codebook-v1.json](clustering/codebook-v1.json).

| Family | Cluster | What the agent wanted | Calls | Runs | Arms | Most-loaded stories |
|---|---|---|---:|---:|---:|---|
| worked-example | `example-model` | Model the UI on an in-app example | 72 | 69 | 3 | Button "Mealdrop Checkout Actions" (29); QuantityStepper "Mealdrop Cart Line" (21) |
| worked-example | `example-form-wiring` | Check an in-app example for native form wiring | 41 | 34 | 3 | Input "Mealdrop Checkout Form" (28); Button "Mealdrop Checkout Actions" (13) |
| undocumented-contract | `native-contract` | Story name asserts an unstated native behaviour | 50 | 47 | 3 | Button "Test Defaults To Type Button" (45); Heading "Test Forwards Ref And Props" (3) |
| undocumented-contract | `indirect-probe` | Probe an unrelated story for native-attribute hints | 14 | 13 | 4 | Button "Anatomy" (10); Button "Class Name" (2) |
| undocumented-contract | `bounds-behaviour` | Behaviour rule at value limits | 5 | 5 | 1 | QuantityStepper "Bounds Disable Rather Than Clamp" (5) |
| undocumented-contract | `classname-hook` | className as styling escape hatch | 3 | 2 | 1 | Badge "Class Name" (2); IconButton "Class Name" (1) |
| second-look | `reload-isolate` | Re-load a printed story to isolate a fact | 18 | 18 | 1 | Button "Test Defaults To Type Button" (10); QuantityStepper "Mealdrop Cart Line" (5) |
| second-look | `reload-opaque` | Re-load an example to see behind a helper | 16 | 16 | 5 | Modal "Empty" (4); ProgressBar "Mealdrop Checkout Steps" (4) |
| component-basics | `parts-wiring` | Parts, slots and basic wiring | 14 | 13 | 1 | QuantityStepper "Anatomy" (8); Input "Anatomy" (4) |
| component-basics | `variant-catalogue` | Catalogue of visual variants | 10 | 10 | 1 | Button "Variants" (10) |
| component-basics | `guessed-story` | Guessed a story name | 3 | 3 | 1 | Modal "Open" (3) |
| accessibility | `a11y-name` | How to name the control accessibly | 12 | 12 | 3 | QuantityStepper "aria-label" (8); ProgressBar "Label" (2) |
| accessibility | `a11y-semantics` | Built-in assistive-technology semantics | 10 | 7 | 2 | Input "Test Error Is Announced" (5); ProgressBar "Test Reports Its Range" (2) |
| component-choice | `usage-guidance` | Mine a story for when-to-use guidance | 10 | 10 | 3 | QuantityStepper "Empty" (8); QuantityStepper "Anatomy" (2) |
| component-choice | `example-precedent` | In-app example as precedent for component choice | 7 | 7 | 1 | QuantityStepper "Mealdrop Cart Line" (5); Select "Mealdrop Burger Extras" (2) |

Calls per family and arm:

| Family | stories-full | purge-jsdoc | full | purge-docgen | empty | stories-api-ref | api-ref | when-to-use | basic-docs | history-issues | do-dont |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| worked-example | 52 | 33 | 28 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| undocumented-contract | 32 | 14 | 14 | 0 | 0 | 7 | 1 | 0 | 4 | 0 | 0 |
| second-look | 0 | 0 | 0 | 24 | 5 | 1 | 0 | 3 | 0 | 1 | 0 |
| component-basics | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |
| accessibility | 15 | 0 | 0 | 0 | 0 | 2 | 5 | 0 | 0 | 0 | 0 |
| component-choice | 8 | 0 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 1 |

## Reliability

**Open clustering.** Three independent Fable agents clustered the same 169 development calls from scratch and produced 18, 15 and 18 clusters. Two of them agree almost exactly (adjusted Rand index 0.91); the third split the in-app-example cluster by app feature, which lowers its agreement with the others to 0.59 and 0.61. Pairwise, they make the same same-cluster or different-cluster decision on 92% to 98% of call pairs.

**Closed coding.** I merged the three into one codebook with a "none fits" option, and three fresh coders (two Fable, one Opus) labelled every call.

| Calls | Level | Mean pairwise agreement | Unanimous | Krippendorff's α |
|---|---|---:|---:|---:|
| 116 held out (never seen when the codebook was written) | cluster | 98.9% | 98.3% | 0.986 |
| 116 held out | family | 98.9% | 98.3% | 0.984 |
| All 285 | cluster | 98.1% | 97.2% | 0.978 |
| All 285 | family | 99.1% | 98.6% | 0.987 |

No coder used "none fits", so no further round was needed. The target was 90% agreement and α of 0.8.

**Annotation step.** For 68 calls a second annotator on a different model wrote the reason independently. Coded with the same codebook, the two versions land in the same cluster for 93% to 94% of calls and the same family for 96%.

Why agreement is this high: the codebook decides first by what kind of story was loaded, and the annotations name the story. Agreement measures consistency between LLM coders, not whether the reasons are true.

## Statistics

The unit of analysis is the run, because calls within a run are not independent. Each test is a Monte Carlo permutation test (20,000 permutations) on the chi-square statistic of a presence-by-group table, with labels shuffled within strata. P-values are corrected with Benjamini–Hochberg at 5% within each table; `*` marks q ≤ 0.05. Clusters present in fewer than 8 runs are not tested.

### A. How often runs load a story

| Arm | Runs with a load (of 50) | Calls |
|---|---:|---:|
| `stories-full` | 45 | 131 |
| `purge-jsdoc` | 36 | 47 |
| `full` | 32 | 42 |
| `purge-docgen` | 24 | 24 |
| `empty` | 13 | 13 |
| `stories-api-ref` | 9 | 10 |
| `api-ref`, `when-to-use` | 6 each | 6 each |
| `basic-docs` | 4 | 4 |
| `do-dont`, `history-issues` | 1 each | 1 each |
| `docs-full`, `control-none` | 0 | 0 |

- **`stories-full` vs `full` (role of docs):** more runs load a story without docs (45 vs 32 of 50, p = 0.0001) and they load more of them (+1.78 calls per run, p < 0.0001).
- **`purge-jsdoc` vs `full` (role of JSDoc):** no difference (36 vs 32 of 50, p = 0.31; +0.10 calls per run, p = 0.48).
- **`purge-docgen` vs `full`:** not comparable, for the reason given above.

### B. Reason by workflow

Among the 177 runs that loaded a story; workflow labels shuffled within arm.

| Target | Cramér's V | p | q (BH) | Runs with it, by workflow |
|---|---:|---:|---:|---|
| `worked-example` * | 0.48 | 0.0000 | 0.0001 | 701 1/14, 702 21/49, 703 21/49, 704 19/36, 706 29/29 |
| `undocumented-contract` * | 0.64 | 0.0000 | 0.0001 | 701 2/14, 702 5/49, 703 39/49, 704 18/36, 706 1/29 |
| `component-choice` * | 0.51 | 0.0001 | 0.0002 | 701 0/14, 702 16/49, 703 0/49, 704 0/36, 706 0/29 |
| `accessibility` * | 0.32 | 0.0007 | 0.0010 | 701 1/14, 702 8/49, 703 0/49, 704 8/36, 706 0/29 |
| `component-basics` * | 0.34 | 0.0033 | 0.0040 | 701 4/14, 702 8/49, 703 0/49, 704 4/36, 706 10/29 |
| `second-look` * | 0.28 | 0.0213 | 0.0213 | 701 6/14, 702 8/49, 703 10/49, 704 10/36, 706 0/29 |

By cluster:

| Target | Cramér's V | p | q (BH) | Runs with it, by workflow |
|---|---:|---:|---:|---|
| `example-model` * | 0.69 | 0.0000 | 0.0001 | 701 1/14, 702 21/49, 703 0/49, 704 18/36, 706 29/29 |
| `native-contract` * | 0.60 | 0.0000 | 0.0001 | 701 1/14, 702 0/49, 703 30/49, 704 15/36, 706 1/29 |
| `example-form-wiring` * | 0.51 | 0.0000 | 0.0001 | 701 0/14, 702 0/49, 703 21/49, 704 13/36, 706 0/29 |
| `variant-catalogue` * | 0.55 | 0.0000 | 0.0001 | 701 0/14, 702 0/49, 703 0/49, 704 0/36, 706 10/29 |
| `indirect-probe` * | 0.33 | 0.0008 | 0.0017 | 701 0/14, 702 0/49, 703 10/49, 704 3/36, 706 0/29 |
| `usage-guidance` * | 0.40 | 0.0112 | 0.0187 | 701 0/14, 702 10/49, 703 0/49, 704 0/36, 706 0/29 |
| `a11y-name` * | 0.27 | 0.0146 | 0.0199 | 701 1/14, 702 8/49, 703 0/49, 704 3/36, 706 0/29 |
| `reload-opaque` * | 0.43 | 0.0175 | 0.0199 | 701 6/14, 702 3/49, 703 0/49, 704 7/36, 706 0/29 |
| `parts-wiring` * | 0.27 | 0.0179 | 0.0199 | 701 1/14, 702 8/49, 703 0/49, 704 4/36, 706 0/29 |
| `reload-isolate` | 0.24 | 0.0519 | 0.0519 | 701 0/14, 702 5/49, 703 10/49, 704 3/36, 706 0/29 |

Restricted to calls where the agent stated its purpose at least partly (94 runs), three families have enough runs to test. `undocumented-contract` stays significant (V = 0.63, q = 0.0001); `worked-example` (q = 0.12) and `second-look` (q = 0.25) do not, though their pattern across workflows is unchanged.

Read this as "the task decides the need", not as a law about workflow types. In `703` the bug is a Button that does not submit, so agents load the story about Button's default type; a different bug would produce a different cluster.

### C. Reason by arm

`stories-full`, `full` and `purge-jsdoc` serve the same stories behind the same name-only list, so they can be compared. All 150 runs; arm labels shuffled within workflow.

| Target | Cramér's V | p | q (BH) | Runs with it, by arm |
|---|---:|---:|---:|---|
| `component-basics` * | 0.60 | 0.0000 | 0.0001 | full 0/50, purge-jsdoc 0/50, stories-full 23/50 |
| `accessibility` * | 0.38 | 0.0000 | 0.0001 | full 0/50, purge-jsdoc 0/50, stories-full 10/50 |
| `undocumented-contract` * | 0.24 | 0.0001 | 0.0002 | full 14/50, purge-jsdoc 14/50, stories-full 26/50 |
| `worked-example` * | 0.17 | 0.0277 | 0.0277 | full 26/50, purge-jsdoc 29/50, stories-full 36/50 |

By cluster:

| Target | Cramér's V | p | q (BH) | Runs with it, by arm |
|---|---:|---:|---:|---|
| `example-form-wiring` * | 0.29 | 0.0000 | 0.0001 | full 6/50, purge-jsdoc 8/50, stories-full 20/50 |
| `parts-wiring` * | 0.44 | 0.0000 | 0.0001 | full 0/50, purge-jsdoc 0/50, stories-full 13/50 |
| `variant-catalogue` * | 0.38 | 0.0000 | 0.0001 | full 0/50, purge-jsdoc 0/50, stories-full 10/50 |
| `native-contract` | 0.10 | 0.0976 | 0.1221 | full 14/50, purge-jsdoc 14/50, stories-full 19/50 |
| `example-model` | 0.10 | 0.2004 | 0.2004 | full 20/50, purge-jsdoc 23/50, stories-full 26/50 |

`stories-full` against `full` alone:

| Target | Cramér's V | p | q (BH) | Runs with it, by arm |
|---|---:|---:|---:|---|
| `component-basics` * | 0.55 | 0.0000 | 0.0002 | full 0/50, stories-full 23/50 |
| `accessibility` * | 0.33 | 0.0002 | 0.0005 | full 0/50, stories-full 10/50 |
| `undocumented-contract` * | 0.24 | 0.0008 | 0.0011 | full 14/50, stories-full 26/50 |
| `worked-example` * | 0.21 | 0.0148 | 0.0148 | full 26/50, stories-full 36/50 |

`purge-jsdoc` against `full` shows no difference in any family (`worked-example` 29 vs 26 of 50, p = 0.60; `undocumented-contract` 14 vs 14).

Among only the runs that loaded something, the share with a `worked-example` load is the same in all three arms (36/45, 26/32, 29/36; p = 1.0). Docs lower how often agents load stories, and remove the component-basics and accessibility reasons, but leave the pull of in-app examples unchanged.

### D. Reason against story kind

Story kind is a deterministic label from the story's name and the content tier that ships it (`app-example`, `test`, `anatomy`, `showcase-highlight`, `api-ref-prop`, `default`). Across calls, kind and reason family are strongly associated (Cramér's V = 0.6); knowing the kind predicts the family for 72% of calls. All 113 `worked-example` calls are app-example stories, by construction of the codebook, and 48 of 68 test-story calls are `undocumented-contract`.

So story kind is a workable cheap proxy for the two large families. It cannot separate the smaller ones: anatomy stories are loaded for parts, for native-attribute hints and for usage guidance alike.

### E. What agents did with the story (low reliability)

Annotators also judged what the agent did with each story. Two annotators agree on that judgement for only 56% of the 68 doubly annotated calls, so treat it as indicative at most. Across all calls the primary annotator recorded: no new information 134, question answered in the negative 60, unclear 49, plan confirmed 31, pattern adopted 11.

The one part of this that can be checked mechanically is finding 5. The `opaque_helper` column marks calls whose returned source contains a single local demo component and no design-system component: 99 calls in total, 63 of them app examples. Outside app examples the helper usually still shows its props, so it is less of a dead end.

## Story selection rates

Selection rate is manual loads divided by the number of runs that listed the story without its source. Per story and cell: [story-selection.csv](story-selection.csv).

| Story kind | Stories | `stories-full` | `full` | `purge-jsdoc` |
|---|---:|---:|---:|---:|
| app-example | 32 | 15.3% (59/385) | 9.2% (28/304) | 9.3% (33/355) |
| test | 111 | 2.4% (30/1250) | 1.5% (14/959) | 1.2% (14/1134) |
| anatomy | 33 | 4.5% (17/381) | 0.0% (0/291) | 0.0% (0/341) |
| showcase-highlight | 45 | 3.8% (18/473) | 0.0% (0/378) | 0.0% (0/460) |
| api-ref-prop | 142 | 0.6% (7/1126) | 0.0% (0/874) | 0.0% (0/1088) |
| default | 33 | 0.0% (0/52) | – | 0.0% (0/46) |

- Eleven story-and-cell combinations were loaded in 10 of 10 runs, including Button "Test Defaults To Type Button" in `703` (three arms), QuantityStepper "Mealdrop Cart Line" in `702`, and Input "Mealdrop Checkout Form" in `704`.
- In `stories-full`, over 50 runs, 7% of its 404 stories were loaded manually at least once, 19% were only ever inlined, and 74% were listed but never loaded.
- `default` and many `api-ref-prop` stories are usually among the three inlined ones, so their low manual rate partly reflects that they were already on screen.

## Story names

Three coders judged, for each load, how the story's name relates to what the agent needed: `direct` (the name states the information sought), `context` (the name names the UI being worked on) or `none`. They agree on 99.6% of loads (α 0.996); the label is in the `name_alignment` column.

| | Loads | Direct | Context | None | Name matches the need |
|---|---:|---:|---:|---:|---:|
| All loads | 285 | 120 | 134 | 31 | 89% |
| Story only seen in a list beforehand | 239 | 105 | 120 | 14 | 94% |
| Agent stated its purpose | 48 | 31 | 12 | 5 | 90% |
| Story already shown in full | 43 | 12 | 14 | 17 | 60% |

- 239 of 285 loads (84%) were of a story the agent had only seen in a list: 159 by name alone, 80 with a one-line description.
- In 17 of the 48 loads where the agent stated its purpose, it quoted the story's name as the reason.
- The 31 `none` loads are fallbacks: Button "Anatomy" (10) probed for native attributes in arms that do not list "Test Defaults To Type Button", and the autogenerated "Empty" stories (13).
- Of the 35 distinct stories loaded, 27 have a name that matches the need they were loaded for.

### Loads made with more than a list entry

46 of the 285 loads (16%) were not picked from a name in a list.

- **43 re-loaded a story whose full source was already on screen.** 24 are in `purge-docgen`, whose docs output prints every story; 13 are the single autogenerated "Empty" story in `empty`; 6 are a story among the three inlined ones in other arms (five "Anatomy", one "Children").
- **3 asked for a name the agent had never been shown** (Modal "Open", in `when-to-use`). All three failed: the story does not exist.

The 43 re-loads fall into three reason clusters: isolating one story from a long page (18), trying to see behind a helper (16), and looking for usage guidance in the only story (9).

### What agents said when they explained a load

In 48 loads the agent stated its purpose. Three coders labelled what it cited in the 31 that do not quote the story's exact name (pairwise agreement 94% to 97%).

| What the agent cited | Loads |
|---|---:|
| The story's exact name | 17 |
| The story by topic or kind ("the cart-line story", "checkout-specific stories") | 14 |
| A decision that hinges on the answer ("this decides whether a real submit button is possible") | 8 |
| A sweep of the remaining stories ("in case native passthrough is documented anywhere") | 4 |
| A gap in the documented props ("Button's documented props have no `type`") | 3 |
| Other | 2 |

So 31 of 48 stated reasons point at the story itself, by name or by topic. This is a narrow sample: 37 of the 48 come from one workflow (`703`), and 28 concern one story, "Test Defaults To Type Button".

Two cautions. The need was reconstructed by an annotator who could see the story's name, so part of this match is built in; the stated-purpose row is the cleaner figure. And a matching name is not enough: 63 of the 134 `context` loads returned a helper call instead of markup.

## Limitations

- **Reasons are reconstructed.** Thinking was not recorded. 48 reasons rest on a stated purpose, 99 on partial narration and 138 on actions alone. A wrong reconstruction that is worded consistently would still cluster consistently.
- **One design system, one app, five tasks, one model.** The clusters describe Droppy, MealDrop and `claude-opus-5` at high effort.
- **Demand, not value.** Nothing here shows that a loaded story led to better code.
- **Arms differ in what they offer.** Only `stories-full`, `full` and `purge-jsdoc` are comparable for reasons; the other arms list different stories, or inline all of them.
- **Coders share a lineage.** All annotators and coders are Claude models. No human has checked a sample.

## Options to strengthen the evidence

- **Turn on thinking summaries before the next collection.** The `showThinkingSummaries` setting does not do it: in headless mode Claude Code ignores that setting and forces the thinking display to `omitted` (read from the CLI's own code, version 2.1.232). The `--thinking-display summarized` flag overrides this. As of 2026-11-11 the working tree carries that change, uncommitted: the repo's `@vercel/agent-eval` patch forwards a `thinkingDisplay` agent option, and agentic-reference Claude Code runs set it. A local headless call on CLI 2.1.232 confirmed the transcript then holds the summary text and the agent's printed output is unchanged. It has not been run in a sandbox, where a newer CLI is installed, so check one transcript from the first collection. Land it before the `story-types` arms are collected. Expect short summaries: in the three calls measured below, the stored reasoning was about 60 tokens per thinking block.
- **Replay and ask is not viable as piloted.** It trips the API's reasoning-extraction safeguard on most calls; see the next section.
- **Have a person code 30 calls blind** against the codebook, to measure validity rather than consistency.

## Replay pilot

175 of the 285 calls have an encrypted thinking block right before them. The pilot replayed ten transcripts (one per reason cluster) to `claude-opus-5` up to the story load, with those blocks passed back unchanged, and asked for a two-to-three-sentence explanation of the load. Results are in [replay/results.jsonl](replay/results.jsonl); total spend was $1.08.

- **Most requests were refused.** 8 of 10 stopped with `stop_reason: "refusal"`, category `reasoning_extraction`. Two refused before any output; six were cut off part-way through the answer. Two completed.
- **The refusal does not depend on the stored reasoning.** Three calls were repeated with the thinking blocks cleared server-side, and all three were refused again.
- **The stored reasoning is small.** The API reported 122, 240 and 246 tokens cleared for two to four thinking blocks. Agents deliberate little at these steps.
- **Where an answer came back, it agrees with the annotation.** Eight calls produced enough text to read. In seven the self-report states the same need as the annotator's reconstruction, including two that the annotator had inferred from actions alone. In the eighth (a "Mealdrop Cart Line" load) it states the same need more specifically. None contradicts the annotation.

The safeguard is there to stop a model's reasoning being extracted through its response, so the probe was not reworded to get past it. The supported way to see reasoning is the thinking summary, which is what the first option above turns on.

## Files

| File | Contents |
|---|---|
| `calls.md` | Every call with its context line, need and reason paragraph, grouped by cluster |
| `story-loads.csv`, `story-loads.final.jsonl` | One row per call with arm, workflow, run, story, exposure, evidence, cluster and family |
| `story-selection.csv` | Per arm, workflow and story: runs inlined, runs listed, runs loaded, selection rate |
| `clustering/codebook-v1.json` | Cluster definitions and decision rules |
| `clustering/open-*.json`, `clustering/coded-r1-*.json` | The three open clusterings and the three coders' labels |
| `stats.json`, `stats.txt` | Every test, with group counts |
| `replay/results.jsonl`, `replay/pilot-calls.json` | The replay pilot: the ten calls, each response, stop reason and token usage |
| `charts/*.svg` | Four pie charts: reason families, what the agent had seen, name alignment, cited reasons (`scripts/make_pies.py`) |
| `scripts/` | Extraction, selection metric, agreement, statistics, replay and report scripts |

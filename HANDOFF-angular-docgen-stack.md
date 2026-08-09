# Follow-up prompt: finish the Angular docgen PR stack

Copy everything below the line into a fresh session.

---

Repo: `/Users/valentinpalkovic/Projects/sb/storybook`, base branch `next`. Read `AGENTS.md` first. **Use subagents heavily** - this is a lot of mechanical git and verification work, and the coordinating context should stay small. Every agent must work in its own detached worktree under `/Users/valentinpalkovic/.claude/jobs/` and must never run `git switch` in the main checkout.

## What this is

A 223-file PR (#35805) was split into a reviewable stack. Most of the split is done. Your job is to finish it, get every PR mergeable and green, and re-point the three trailing story-docs PRs.

**The product decision driving all of it:** under `features.experimentalDocgenServer`, the in-process analyzer `AngularComponentMetaManager` (package `@storybook/angular-cm`) powers Angular docgen end to end. Compodoc is **not** on that pipeline. With the flag off, Compodoc is unchanged and still powers controls in the preview.

## Target stack

```
next
 ├── #35803  valentin/csf-tools-story-shape-helpers          7 files
 └── #35750  valentin/sb11-angular-docgen-sandbox-baselines  50 files
      └── #35806  valentin/component-meta-project-tracker     8 files
           └── #35805  valentin/angular-component-meta       78 files
                └── #35808  valentin/angular-docgen-harness-acm      111 files
                     └── #35807  valentin/angular-story-docs-snippets   21 files
                          └── #35797  angular-story-docs-2-story-shapes  4 files
                               └── #35798  ...-3-warning                 3 files
                                    └── #35799  ...-4-component-format   8 files
```

The split is complete and every branch's ancestry is linked. What remains is labels.

`#35796` is CLOSED as superseded. Do not revive it.

## Exact state as of handoff

| PR | branch | tip | base | files | labels present | draft |
| --- | --- | --- | --- | --- | --- | --- |
| #35803 | csf-tools-story-shape-helpers | `c8b183468aa` | next | 7 | maintenance, ci:normal, qa:skip | no |
| #35750 | sb11-angular-docgen-sandbox-baselines | `a35c6b2cd7e` | next | 50 | build, ci:normal, qa:skip | no |
| #35806 | component-meta-project-tracker | `87aa7fe8d58` | #35750 | 8 | maintenance, angular, ci:normal | yes |
| #35805 | angular-component-meta | `faccb897dad` | #35806 | 78 | feature request, qa:needed | yes |
| #35808 | angular-docgen-harness-acm | `2e448952fff` | #35805 | 111 | none | yes |
| #35807 | angular-story-docs-snippets | `38acfe6faf7` | #35808 | 21 | none | yes |
| #35797 | angular-story-docs-2-story-shapes | `e46f5c967b8` | #35807 | 4 | none | yes |
| #35798 | angular-story-docs-3-warning | `3d416708974` | #35797 | 3 | none | yes |
| #35799 | angular-story-docs-4-component-format | `3a0d7859235` | #35798 | 8 | feature request | yes |

Every branch contains its base's tip, so no PR can conflict with its base.

**GitHub's `mergeable` flag lies after a base advances.** #35805 reported `CONFLICTING` / `mergeable_state: dirty` for many minutes while its head provably *contained* its base tip (`git merge-base faccb897dad 87aa7fe8d58` returns `87aa7fe8d58`, and `git merge-tree --write-tree` exits 0 with no conflict list). Verify locally before believing the flag or "fixing" anything.

## Work remaining, in order

### 1. Restack and #35805's conflict - DONE

The split, the re-pointing, and #35805's ancestry are all finished. #35806 additionally carries a CodeRabbit round (`87aa7fe8d58`), merged down into #35805 as `faccb897dad`:

- `filterSourceFilePaths` matches `node_modules` as a whole path segment, so a source dir like `src/node_modules-tools/` is no longer dropped from watcher discovery.
- `ProjectFileTracker.getSnapshot` / `getScriptVersion` normalize their path argument, so every entry point keys `snapshots` and `fileVersions` the same way.
- `commandLine.fileNames` is deliberately *not* normalized in the tracker: both consumers (`code/lib/angular-cm/src/manager.ts` and React's `ComponentMetaManager`) build it through `parseTsconfigCommandLine`, which already does it.
- CodeRabbit's third comment (convert the coarse-mtime regression test to `memfs`) was declined on the thread with evidence: `createTempDir` copies real `react`/`csstype`/`@types` in so the language service can resolve types, the test pins its own mtime rather than depending on host granularity, and 13 tests in that file share the helper.

### 2. Open the harness PR - DONE

**PR #35808** is open: `valentin/angular-docgen-harness-acm` (`2d4f076ea65`) -> `valentin/angular-component-meta`, 111 files. Nothing to do.

Verified: `git diff b9fc3bd8669 2d4f076ea65` is EMPTY, so the split reconstructs the pre-split tree byte-for-byte, and `b9fc3bd8669` is still reachable if it ever needs reversing. `yarn install --immutable` passes on #35805 and on #35808 independently.

Repo quirk found here, you will hit it: `__testfixtures__` is lint-ignored, so a fixture-only commit makes lint-staged invoke `lint:js:cmd --fix` with zero files and abort with `No files found to lint`. Use `--no-verify` and run `yarn lint:js` explicitly for those.

### 3. Rebase #35807 onto the harness branch

There is a **local, unpushed** commit `1dc2032c75e67a2621df4794bddf2d1739b17c18` in worktree `/Users/valentinpalkovic/.claude/jobs/5773c567/tmp/restack/sdwt` that is the story-docs slice already rebased onto `29d5dfd80c1`. That worktree may be gone; if so, rebuild from `origin/valentin/angular-story-docs-snippets` (`a9d0d9665f3`, 21 files, +945).

- rebase onto the harness branch tip
- force-push with `--force-with-lease` against `a9d0d9665f3`
- `gh pr edit 35807 --base valentin/angular-docgen-harness-acm`
- update its `> [!NOTE]` to name the harness PR, not #35805

The branch must carry **no** `package.json` and **no** `yarn.lock` change - it inherits the dependency from the harness PR.

### 4. Re-point #35797

A port already exists as commit `8a54ecc54ca0ebb1151b273e41c2b07e3434725f` in worktree `/Users/valentinpalkovic/.claude/jobs/5773c567/tmp/restack/wt`, 4 files +490/-30, touching only story-docs files. A finished PR body draft is at `/Users/valentinpalkovic/.claude/jobs/5773c567/tmp/restack/pr-35797-body.md` with two `#BASE_PR` placeholders to substitute.

If those artifacts are gone, re-port from `origin/valentin/angular-story-docs-2-story-shapes` onto the live `story-docs-build.ts` / `story-docs-snippet.ts`.

Then: force-push against `740865af0c54f5c1a1c237cc2728c02bc97e604e`, `gh pr edit 35797 --base valentin/angular-story-docs-snippets`, apply the body.

### 5. Re-point #35798 and #35799

**This analysis is already done. Neither is superseded, and neither needs #35803.** The half-dead-diff pattern from #35797 does NOT recur, because `_storyAnnotations` deliberately drops spreads, which is precisely the gap #35798 reports on.

**Port them onto the #35797 port commit `8a54ecc54ca`, not onto the pushed snippets branch.** That commit already created `story-docs-limitations.md` and already has the `TemplateResult` union with an `unresolvable` arm, which changes several answers below.

File-mapping from the dead #35796 implementation:

| dead | live |
| --- | --- |
| `build-story-docs.ts` | `story-docs-build.ts` |
| `template-snippet.ts` | `story-docs-snippet.ts` |
| `compodoc-component-resolver.ts` | `resolve-component.ts` |

#### #35798 - warning field. Verdict: PORT REDUCED. ~50 lines adapted + ~40 lines of rewritten tests.

`warning?: string` exists on `StoryDoc` on `next` and `components-ref-manifest.ts` already forwards it, but **nothing produces it** (`git grep -c warning 8a54ecc54ca -- code/frameworks/angular-vite/src/docgen/` is zero). #35798 is genuinely the first producer.

| File | Verdict |
| --- | --- |
| `build-story-docs.ts` +72/-15 | PORT adapted. `sourceOf`, `unresolvableProperties`, `unresolvedWarning`, the `{snippet, warning}` return shape are all new |
| ↳ its `argsObjectNode` helper | DEAD - live reads `annotations.args` / `csf._metaAnnotations.args` directly |
| ↳ `TemplateResult` `source` threading | PORT trivial - the union already exists, only `source: string` is new |
| `__testfixtures__/story-docs.stories.ts` +11 | DEAD - live uses an inline memfs `STORY_SHAPES_FILE` constant; append ~6 lines to it |
| `build-story-docs.test.ts` +38 | PORT rewrite - live has `snippetsOf(file)` returning a Map; needs a `warningsOf` analogue |
| `story-docs-limitations.md` +16 | PORT verbatim |

Non-mechanical spot: live's `templateOf` is called three times (story annotations, CSF2 return, meta fallback) where the dead code had one call site. Attributing `source` to whichever produced the `unresolvable` needs a decision.

#### #35799 - component snippet format. Verdict: PORT AS-IS. ~290 of 294 lines genuinely new, ~190 verbatim.

`snippetFormat` does not exist anywhere on the live branch, and the Angular provider has never set `payload.import`.

| File | Verdict |
| --- | --- |
| `component-snippet.ts` +69 | PORT near-verbatim. It imports `IDENTIFIER` from `template-snippet.ts`; live keeps that regex private as `isValidIdentifier` in `story-docs-snippet.ts` - export it or inline the literal |
| `component-snippet.test.ts` +81 | PORT verbatim - pure functions, no fixtures |
| `types.ts` +11, `story-docs-limitations.md` +29 | PORT verbatim |
| `story-docs-preset.ts` +5 | PORT adapted - live signature is `async (nextStoryDocs) =>` with no `options`; add it, `await options.presets.apply<FrameworkOptions>('frameworkOptions')`, thread `snippetFormat` |
| `build-story-docs.ts` +53/-4 | PORT adapted - `hostContext` works unchanged against `resolution.component` |
| `build-story-docs.test.ts` +50 | PORT rewrite, same inline-memfs change as #35798 |

Three decisions it needs:
1. Live's `renderStorySnippet` returns a bare string; the port needs `{ snippet, warning, handlers }`, with handlers from `snippetContext.outputs` and `[]` for a literal template.
2. Live deliberately emits description-only stories when there is no component (`expect(stories[0].snippet).toBeUndefined()`). Only wrap and only set `payload.import` when a snippet exists.
3. `angularHostComponent(...)` sits on top of #35798's `{snippet, warning}` shape. If #35798 is dropped or reordered, this hunk needs a different rebase.

#### csf-tools / #35803

Neither PR's own added lines import anything from #35803. The `#35803` symbols appear only on lines they *inherit* from the dead implementation. Missing from `next`: `resolveRenderFunction`, `storyAssignedArgsPath`, `returnedObjectExpression`, `propertyValue`. Present: `metaObjectPath`, `keyOf`, `resolveIdentifierInit`, `normalizeStoryDeclaration`, `argsRecordFromObjectPath`, `mergeArgsRecords`, `metaArgsRecord`.

A port avoids #35803 entirely: live already uses `program.scope.getBinding(node.name)?.path.node` for render resolution, and the config object is reachable via `csf._storyExports[exportName].init` or `csf._storyStatements[exportName]`.

#### Do not carry over

#35798's fixture imports `./external-render`, a file never added to the branch. Harmless there (the fixture dir is tsconfig-excluded and the module is only parsed), and the whole fixture diff is dead on live anyway.

### 6. Undraft, then re-apply the labels - REQUIRED BEFORE MERGE, not optional

The two `next`-based PRs (#35803, #35750) are undrafted; the seven stacked ones are still DRAFT, to keep the stack quiet during the restructure. Order matters at the end: **undraft first, then apply `ci:*`.** Labelling a draft queues the sandbox matrix for branches nobody is reviewing yet.


The user removed `ci:normal` from every PR mid-restructure to stop the churn (each push was firing a ~140-check sandbox matrix across a 7-PR stack). **Only re-apply once the whole stack is conflict-free and settled.**

**Know what this traded off.** Danger requires a label from each of two sets, so removing `ci:normal` made its complaint list longer:

```
PR is not labeled with one of: ["ci:normal","ci:merged","ci:daily","ci:docs"]
PR is not labeled with one of: ["qa:needed","qa:skip","qa:success"]
This PR needs an approving review
```

It costs nothing today, because the approving-review gate keeps Danger red anyway - but every PR in the stack needs both labels back before it can go green.

Partially done already, per the label column in the state table above. What is still missing:

- `qa:*`: #35806, #35808, #35807, #35797, #35798, #35799. This is the **only** thing keeping #35806's Danger red - its check output is one failure (`PR is not labeled with one of: ["qa:needed","qa:skip","qa:success"]`) plus an expected warning that it targets a non-`next` branch. `qa:skip` fits #35806, being an internal refactor like its `maintenance` sibling #35803.
- `ci:*`: #35805, #35808, #35807, #35797, #35798, #35799.
- A changelog-set label (`maintenance` / `build` / `feature request` / ...): #35808, #35807, #35797, #35798.

`qa:*` labels are Danger metadata only and queue no sandboxes, so they are safe to apply while the stack is still draft. `ci:*` is the one that fires the ~140-check matrix, so hold it until undrafting.

Worth considering `ci:daily` rather than `ci:normal` on the Angular PRs: the `angular-vite/docgen-server-ts` template that carries the docgen baselines and the `docgen-hot-update` E2E is in the **daily** set, so a `ci:normal` run never exercises it.

## Traps found the hard way - do not rediscover these

**`yarn install --immutable` is the gate that catches manifest/lock drift, and no local test run will.** `.github/workflows/nx.yml` runs it. It bit twice. Run it on every branch independently.

The resolved shape: `code/lib/docgen-harness/package.json` must declare `"@storybook/angular-cm": "workspace:*"` **and** `yarn.lock` must carry the matching entry, together, on the harness branch. #35805 has neither (it has no consumer - both importers, `angular-component-meta-baselines.test.ts` and `perf/docgen-perf/engines/angular-component-meta.ts`, live in the harness commit). The measured truth table:

| lock entry | package.json line | `--immutable` |
| --- | --- | --- |
| present | absent | exit 1 |
| present | present | **exit 0** |
| absent | present | exit 1 |

**`analyze-file.test.ts` in #35805 reads a docgen-harness fixture.** `code/lib/docgen-harness/src/angular/__testfixtures__/properties-methods-noise/` - the component file plus `compodoc-input.json` plus `argtypes.snapshot` are one unit and belong with #35805. The `acm-*` recordings in that directory belong to the harness gate.

**`acm-snippet-*.snapshot` are NOT story-docs files.** They are the analyzer's own baseline gate, recorded by `render-helpers.ts`. Only `server-snippet-*` belongs to story-docs. Deleting the `acm-*` set silently strips a ratchet.

**Never re-record a snapshot or baseline to make something pass.** If one drifts, that is the signal. `expectCurrentOrBetter` throws rather than auto-accepting.

**Force-pushing a base orphans its children.** This already cost #35803 its diff once (it showed 230 files instead of 7). Always tell downstream agents the new SHA immediately.

## Known-flaky, do not chase

- `Danger` failing with "needs an approving review from a Storybook Core or Developer Experience team member" is the expected human gate on every PR.
- `test-storybooks-portable-react` Playwright E2E flakes. Proven by control: it failed on #35805 and on #35803 in the same step with different specs, and passed on re-run.
- `TestingWidget > Settings Updated` in `code/core/src/manager` flakes under full-suite concurrency; passes in isolation.
- A full `yarn test` has intermittently exited 1 on an `EnvironmentTeardownError` loading `@emotion/styled` in `manager-api/tests/root.test.tsx`. Not reproducible in isolation, unrelated to this work.
- NX Cloud 401 locally is expected without `NX_CLOUD_ACCESS_TOKEN`.

## House rules

- **Never an em dash.** Plain hyphens. This is a standing rule from the repo owner and it applies to code comments, commit messages, PR bodies and chat.
- No agent name as commit co-author.
- Never report a check as passing without having run it in this session. Report real counts. "The suite completed" is not "the suite passed" - check the exit code and the counts.
- PR bodies: show, do not describe. Real artifact, then diagram, then table, then snippet, then prose. **Never fabricate an example** - if it does not exist, go cause it, capture the real output, restore. Keep the `.github/PULL_REQUEST_TEMPLATE.md` structure, fill checklists honestly, write manual testing as numbered steps a maintainer can follow cold.
- Format with `cd code && yarn fmt:write` after editing.

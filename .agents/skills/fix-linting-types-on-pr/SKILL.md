---
name: fix-linting-types-on-pr
description: Checks out a PR (including fork PRs), fixes all linting and TypeScript errors, then pushes the changes back. Use when asked to fix lint, types, or TS errors on a PR.
---

# Fix Linting and TypeScript Issues on a PR

Checks out a PR, auto-fixes linting and TypeScript issues, and pushes the fixes.

## Step 1 — Get the PR number

If the user provided a PR number, use it directly. Otherwise ask for it.

## Step 2 — Check out the PR

Use `gh pr checkout` so it works for both fork and non-fork PRs:

```bash
gh pr checkout <PR_NUMBER>
```

This automatically sets up the correct remote tracking and switches to the PR branch, even when the PR comes from a fork.

## Step 3 — Install dependencies

```bash
yarn
```

## Step 4 — Compile the repo

Compiling first ensures TS declarations referenced by the linter are present:

```bash
yarn nx run-many -t compile
```

## Step 5 — Fix linting errors

```bash
yarn lint
```

## Step 6 — Fix TypeScript errors

Run the TypeScript checker to surface remaining type errors:

```bash
yarn nx run-many -t check
```

Read the output carefully. Fix each type error manually by editing the relevant file(s). Common fixes:

- Add or correct type annotations
- Fix incorrect generics
- Resolve `any` assignments that violate strict mode
- Add missing imports or re-exports

Re-run `yarn nx run-many -t check` after each batch of edits to confirm errors are resolved.

## Step 7 — Commit the fixes

Stage only the files you changed:

```bash
git add <files-you-modified>
git commit -m "Maintenance: Fix linting and TypeScript errors"
```

Do not use `git add -A` — avoid accidentally staging unrelated files.

## Step 8 — Push the fixes

For fork PRs `gh pr checkout` sets up the correct upstream tracking. Push directly:

```bash
git push
```

## Notes

- Only fix errors that are clearly linting or TypeScript issues. Do not refactor logic.
- If a TypeScript error requires a non-trivial code change, surface it to the user and ask before proceeding.
- If `gh pr checkout` fails due to permissions on a fork, inform the user — they may need to grant write access to the fork or the maintainer must push directly.
- After pushing, confirm with the user that the CI is green.

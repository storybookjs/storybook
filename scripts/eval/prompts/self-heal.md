## Self-healing loop

Storybook init created a Vitest integration (`npx vitest --project=storybook`). Use it to verify your setup:

1. Run `npx vitest run --project=storybook` to test if stories render.
2. Read the error output carefully — it tells you exactly which stories fail and why.
3. Make the smallest fix that addresses the root cause (missing provider, missing CSS, wrong alias, etc.).
4. Re-run `npx vitest run --project=storybook`.
5. Repeat until all stories pass or remaining failures are clearly outside Storybook setup scope.

Do not stop after the first partial improvement. Keep iterating.

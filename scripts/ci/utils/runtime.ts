// Pipeline-runtime flags resolved from CLI args in main.ts before config
// generation. Kept in a tiny module so job factories (which only receive
// `workflow: Workflow`) can read cross-cutting context without threading a
// new param through every defineJob signature.

let forkPipeline = false;

/** Set once, from main.ts, based on the --is-fork CLI arg. */
export function setForkPipeline(value: boolean): void {
  forkPipeline = value;
}

/**
 * True when the pipeline was triggered for a PR whose head is a FORK
 * (untrusted contributor code). SECURITY: gate any `save_cache` /
 * artifact-persist that a later trusted pipeline could restore — a fork
 * pipeline must never write a cache scope `merged`/`daily` reads back
 * (TanStack/router 2026-05-11 fork→base cache-poisoning class). The
 * `ci:merged` label is sometimes applied to fork PRs, so the trusted
 * signal is "not a fork", not the workflow name.
 */
export function isForkPipeline(): boolean {
  return forkPipeline;
}

/**
 * Guards the portable d.ts artifact of the `storybook/internal/toolsets-docs` entry.
 *
 * `@storybook/mcp` bundles this entry's declarations into its own dist through standard module
 * resolution, so the artifact must be one flat self-contained file whose only external imports are
 * on that package's own dependency list. An edit that entangles the entry with react, another core
 * surface, or a shared type chunk must fail here — where the artifact is produced — with a message
 * naming the offending import, not in a consumer's build.
 *
 * Deliberately reads the real built artifact (no memfs): the guarded property is what the build
 * actually wrote to disk.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DTS_ARTIFACT = join(
  import.meta.dirname,
  '../../../../../dist/shared/open-service/toolsets/docs/public.d.ts'
);

/**
 * The only module specifiers the flat file may reference.
 *
 * Deliberately a copy of the entry's `portable.external` in `build-config.ts`, not derived from
 * it: every allowed import is a dependency each consumer must declare, so widening the list has to
 * be a reviewer-visible edit here rather than something the config change passes silently.
 */
const IMPORT_ALLOWLIST = ['valibot'];

/**
 * Headroom over the current size (~64 KB), so ordinary edits pass but a bundling regression does
 * not — the shared-chunk entanglement this pass exists to prevent once pulled in ~904 KB.
 */
const SIZE_BUDGET_BYTES = 100_000;

/**
 * Every syntactic position that references another module in a d.ts: static `from`, dynamic
 * `import(...)` type references, `require(...)`, side-effect `import "..."`, and ambient
 * `declare module "..."` augmentation.
 */
const MODULE_SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+|\bmodule\s+)["']([^"']+)["']/g;

/**
 * Triple-slash directives (`/// <reference types|path|lib="..." />`) pull in declarations outside
 * the import syntax above, so their targets count as specifiers too: a `path` reference breaks
 * flatness and a `types`/`lib` reference must pass the allowlist like any import.
 */
const REFERENCE_DIRECTIVE_RE = /^\/\/\/\s*<reference\s+(?:types|path|lib)\s*=\s*["']([^"']+)["']/gm;

function readSpecifiers(): string[] {
  const source = readFileSync(DTS_ARTIFACT, 'utf-8');
  return [...source.matchAll(MODULE_SPECIFIER_RE), ...source.matchAll(REFERENCE_DIRECTIVE_RE)].map(
    (match) => match[1]
  );
}

/**
 * The dist-reading assertions are skipped on a working copy that has not been production-built,
 * which would make them pass vacuously in CI — where a build always precedes the tests. So there,
 * the artifact's absence is the failure.
 */
const DTS_BUILT = existsSync(DTS_ARTIFACT);

describe('portable toolsets-docs declarations', () => {
  it.runIf(process.env.CI)('are built before this suite runs', () => {
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(DTS_BUILT)('are one flat file: no relative imports', () => {
    expect(readSpecifiers().filter((specifier) => specifier.startsWith('.'))).toEqual([]);
  });

  it.runIf(DTS_BUILT)('import exactly the allowlist', () => {
    expect([...new Set(readSpecifiers())].sort()).toEqual(IMPORT_ALLOWLIST);
  });

  it.runIf(DTS_BUILT)('stay within their size budget', () => {
    expect(statSync(DTS_ARTIFACT).size).toBeLessThan(SIZE_BUDGET_BYTES);
  });
});

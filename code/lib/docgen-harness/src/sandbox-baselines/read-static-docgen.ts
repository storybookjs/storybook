import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { DocgenPayload } from '../../../../core/src/shared/open-service/services/docgen/types.ts';

// Where `build-storybook` writes one docgen snapshot per component under the static output dir.
export const DOCGEN_SNAPSHOT_DIR = join('services', 'core', 'docgen');

export const SANDBOX_TOKEN = '<sandbox>';

// An allow-list rather than an exclude-list because `DocgenPayload` carries an index signature: the
// Angular provider hangs the raw Compodoc entry off it, over 100KB of mostly `sourceCode` per
// sandbox, none of it part of the contract this baseline guards.
const PORTABLE_FIELDS = [
  'id',
  'name',
  'path',
  'description',
  'summary',
  'jsDocTags',
  'argTypes',
  'subcomponents',
  'error',
] as const satisfies readonly (keyof DocgenPayload)[];

export type SandboxBaseline = Pick<DocgenPayload, (typeof PORTABLE_FIELDS)[number]>;

// Component id -> recorded payload, key-sorted so a re-record produces a reviewable diff.
export type SandboxBaselines = Record<string, SandboxBaseline>;

// Both native and POSIX spelling, so a baseline recorded on one platform verifies on another.
export const normalizePaths = (value: string, sandboxDir: string): string =>
  value
    .replaceAll(sandboxDir, SANDBOX_TOKEN)
    .replaceAll(sandboxDir.replace(/\\/g, '/'), SANDBOX_TOKEN);

const normalizeDeep = (value: unknown, sandboxDir: string): unknown => {
  if (typeof value === 'string') {
    return normalizePaths(value, sandboxDir);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDeep(item, sandboxDir));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeDeep(item, sandboxDir)])
    );
  }
  return value;
};

export const toBaseline = (payload: DocgenPayload, sandboxDir: string): SandboxBaseline =>
  Object.fromEntries(
    PORTABLE_FIELDS.filter((field) => payload[field] !== undefined).map((field) => [
      field,
      normalizeDeep(payload[field], sandboxDir),
    ])
  ) as SandboxBaseline;

// The monorepo's shared template stories reference their component through a global, so there is no
// import for the resolver to follow and every one of them is an error payload by construction.
// Recording them would say something about the template-story harness, not about docgen.
const isGloballyReferenced = (payload: SandboxBaseline): boolean =>
  payload.name.startsWith('globalThis');

export function readStaticDocgen({
  staticDir,
  sandboxDir,
}: {
  staticDir: string;
  sandboxDir: string;
}): SandboxBaselines {
  const docgenDir = join(staticDir, DOCGEN_SNAPSHOT_DIR);

  let files: string[];
  try {
    files = readdirSync(docgenDir).filter((file) => file.endsWith('.json'));
  } catch (cause) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      `No docgen snapshots at ${docgenDir}.\n` +
        `Build the sandbox first, and check that its main config enables both ` +
        `features.experimentalDocgenServer and features.componentsManifest.`,
      { cause }
    );
  }

  const baselines: SandboxBaselines = {};
  for (const file of files) {
    const path = join(docgenDir, file);
    const { components } = JSON.parse(readFileSync(path, 'utf8')) as {
      components?: Record<string, DocgenPayload>;
    };

    for (const [id, payload] of Object.entries(components ?? {})) {
      const baseline = toBaseline(payload, sandboxDir);
      if (!isGloballyReferenced(baseline)) {
        baselines[id] = baseline;
      }
    }
  }

  if (Object.keys(baselines).length === 0) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      `${docgenDir} yielded no components to record; refusing to record an empty run. ` +
        `Either the build produced no payloads, or every one of them is globally referenced.`
    );
  }

  return Object.fromEntries(
    Object.entries(baselines).sort(([a], [b]) => a.localeCompare(b))
  ) as SandboxBaselines;
}

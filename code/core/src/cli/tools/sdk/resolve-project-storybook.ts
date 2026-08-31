import { readFileSync } from 'node:fs';

import { createRequireFromCwdOrBin, requireSearchPath } from '../../../common/utils/cwd-or-bin.ts';

const STORYBOOK_MANIFEST = 'storybook/package.json';
const CHILD_HOST_ENTRY = 'storybook/internal/tools/child-host';

export function resolveProjectStorybookVersion(cwdOrBin: string): string | undefined {
  try {
    const projectRequire = createRequireFromCwdOrBin(cwdOrBin);
    const manifestPath = projectRequire.resolve(STORYBOOK_MANIFEST, {
      paths: [requireSearchPath(cwdOrBin)],
    });
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

export function resolveChildHostScript(cwdOrBin: string): string {
  const projectRequire = createRequireFromCwdOrBin(cwdOrBin);
  return projectRequire.resolve(CHILD_HOST_ENTRY, { paths: [requireSearchPath(cwdOrBin)] });
}

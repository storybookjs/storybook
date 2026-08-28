import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const STORYBOOK_MANIFEST = 'storybook/package.json';
const CHILD_HOST_ENTRY = 'storybook/internal/tools/child-host';

export function resolveProjectStorybookVersion(projectDir: string): string | undefined {
  try {
    const projectRequire = createRequire(join(projectDir, 'package.json'));
    const manifestPath = projectRequire.resolve(STORYBOOK_MANIFEST, { paths: [projectDir] });
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

export function resolveChildHostScript(projectDir: string): string {
  const projectRequire = createRequire(join(projectDir, 'package.json'));
  return projectRequire.resolve(CHILD_HOST_ENTRY, { paths: [projectDir] });
}

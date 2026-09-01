import { createRequire } from 'node:module';
import { join } from 'node:path';

const CHILD_HOST_ENTRY = 'storybook/internal/tools/child-host';

export function resolveChildHostScript(projectDir: string): string {
  const projectRequire = createRequire(join(projectDir, 'package.json'));
  return projectRequire.resolve(CHILD_HOST_ENTRY, { paths: [projectDir] });
}

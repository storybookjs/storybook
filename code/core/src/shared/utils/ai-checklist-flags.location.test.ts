import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let repo: string;
let uiPackage: string;

// The cache directory is located by walking the real filesystem from inside a dependency, which
// memfs cannot intercept.
beforeEach(async () => {
  repo = await realpath(await mkdtemp(join(tmpdir(), 'sb-setup-flag-')));
  uiPackage = join(repo, 'packages', 'ui');
  await mkdir(join(uiPackage, '.storybook'), { recursive: true });
  await writeFile(join(repo, 'package.json'), '{}');
  await writeFile(join(uiPackage, 'package.json'), '{}');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(repo, { recursive: true, force: true });
});

// Modules are reloaded under the given working directory, the way a separate process would load
// them.
async function startProcessIn(cwd: string) {
  vi.resetModules();
  vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  return import('./ai-checklist-flags.ts');
}

const from = (where: string) =>
  where === 'the repo root'
    ? { cwd: repo, configDir: join('packages', 'ui', '.storybook') }
    : { cwd: uiPackage, configDir: '.storybook' };

it.each([
  { setupFrom: 'the repo root', devServerFrom: 'the package' },
  { setupFrom: 'the package', devServerFrom: 'the repo root' },
  { setupFrom: 'the package', devServerFrom: 'the package' },
])(
  'is seen by a dev server started in $devServerFrom when setup ran from $setupFrom',
  async ({ setupFrom, devServerFrom }) => {
    const setup = await startProcessIn(from(setupFrom).cwd);
    await setup.writeProjectScopedFlag('ai-setup-ran', from(setupFrom).configDir, { runId: 'abc' });

    const devServer = await startProcessIn(from(devServerFrom).cwd);

    expect(await devServer.getAiSetupRunId(from(devServerFrom).configDir)).toBe('abc');
  }
);

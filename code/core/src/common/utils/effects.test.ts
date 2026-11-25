import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { join } from 'pathe';

import * as effects from './effects.ts';
import { invalidateProjectRootCache } from './paths.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'storybook-effects-'));
  vi.stubEnv('STORYBOOK_PROJECT_ROOT', root);
  invalidateProjectRootCache();
  vi.mocked(logger.log).mockImplementation(() => {});
  vi.mocked(logger.step).mockImplementation(() => {});
});

afterEach(() => {
  effects.setDryRun(false);
  vi.unstubAllEnvs();
  invalidateProjectRootCache();
  rmSync(root, { recursive: true, force: true });
});

const changes = () => effects.describeDryRunChanges().map((line) => stripVTControlCharacters(line));

describe('outside a dry run', () => {
  it('writes, reads and removes files on disk, and runs steps', async () => {
    const file = join(root, 'main.js');

    await effects.writeFile(file, 'export default {};');
    expect(readFileSync(file, 'utf8')).toBe('export default {};');
    expect(await effects.readFile(file)).toBe('export default {};');

    await effects.removeFile(file);
    expect(existsSync(file)).toBe(false);

    const run = vi.fn(() => 'ran');
    expect(await effects.runCommand('pnpm install', run)).toBe('ran');
    expect(effects.describeDryRunChanges()).toEqual([]);
  });
});

describe('in a dry run', () => {
  beforeEach(() => {
    effects.setDryRun(true);
  });

  it('stages writes, and reads them back without touching the disk', async () => {
    const file = join(root, 'main.js');
    writeFileSync(file, 'old');

    await effects.writeFile(file, 'new');
    effects.writeFileSync(join(root, 'created.js'), 'created');

    expect(readFileSync(file, 'utf8')).toBe('old');
    expect(await effects.readFile(file)).toBe('new');
    expect(effects.readFileSync(join(root, 'created.js'))).toBe('created');
    expect(effects.existsSync(join(root, 'created.js'))).toBe(true);
    expect(existsSync(join(root, 'created.js'))).toBe(false);
  });

  it('stages removals', async () => {
    const file = join(root, 'old.js');
    writeFileSync(file, 'old');

    await effects.removeFile(file);

    expect(existsSync(file)).toBe(true);
    expect(effects.existsSync(file)).toBe(false);
    expect(() => effects.readFileSync(file)).toThrow(expect.objectContaining({ code: 'ENOENT' }));
  });

  it('records steps instead of running them', async () => {
    const run = vi.fn();

    expect(await effects.runCommand('pnpm install', run)).toBeUndefined();
    await effects.runStep('configure @storybook/addon-vitest', run);

    expect(run).not.toHaveBeenCalled();
    expect(changes()).toEqual(['run pnpm install', 'configure @storybook/addon-vitest']);
  });

  it('lists each file a run would create, update or delete once, by path, then the steps', async () => {
    writeFileSync(join(root, 'main.js'), 'old');
    writeFileSync(join(root, 'unchanged.js'), 'same');
    writeFileSync(join(root, 'old.js'), 'old');

    await effects.writeFile(join(root, 'main.js'), 'new');
    await effects.writeFile(join(root, 'unchanged.js'), 'same');
    await effects.writeFile(join(root, 'created.js'), 'created');
    await effects.writeFile(join(root, 'main.js'), 'newer');
    await effects.removeFile(join(root, 'old.js'));
    await effects.runCommand('pnpm install', () => {});

    expect(changes()).toEqual([
      'create created.js',
      'update main.js',
      'delete old.js',
      'run pnpm install',
    ]);
  });

  it('lists the keys a run would change in a JSON or YAML file', async () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ devDependencies: { storybook: '10.0.0', '@storybook/nextjs': '10.0.0' } })
    );

    await effects.writeFile(
      join(root, 'package.json'),
      JSON.stringify({ devDependencies: { storybook: '^11.0.0', vite: '^7.0.0' } })
    );
    await effects.writeFile(join(root, 'pnpm-workspace.yaml'), 'allowBuilds:\n  esbuild: true\n');

    expect(changes()).toEqual([
      'update package.json',
      '↳ devDependencies.storybook: 10.0.0 → ^11.0.0',
      '↳ + devDependencies.vite: ^7.0.0',
      '↳ - devDependencies.@storybook/nextjs',
      'create pnpm-workspace.yaml',
      '↳ + allowBuilds.esbuild: true',
    ]);
  });

  it('logs what a run would change under a heading that ends the dry run', async () => {
    await effects.writeFile(join(root, 'main.js'), 'new');

    effects.logDryRunChanges();

    const [[heading]] = vi.mocked(logger.step).mock.calls;
    expect(stripVTControlCharacters(String(heading))).toBe(
      'Dry run finished. An actual run would:'
    );
    expect(stripVTControlCharacters(String(vi.mocked(logger.log).mock.calls[0][0]))).toBe(
      'create main.js'
    );
  });

  it('says that a dry run finished with errors when its command fails', async () => {
    await effects.writeFile(join(root, 'main.js'), 'new');

    effects.logDryRunChanges({ failed: true });

    const [[heading]] = vi.mocked(logger.step).mock.calls;
    expect(stripVTControlCharacters(String(heading))).toBe(
      'Dry run finished with errors. An actual run would:'
    );
  });

  it('logs nothing when a run would change nothing', () => {
    effects.logDryRunChanges();

    expect(logger.step).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('forgets what it staged when the mode is set again', async () => {
    await effects.writeFile(join(root, 'main.js'), 'new');

    effects.setDryRun(true);

    expect(effects.describeDryRunChanges()).toEqual([]);
    expect(effects.existsSync(join(root, 'main.js'))).toBe(false);
  });
});

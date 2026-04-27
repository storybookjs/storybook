// Covers the YAML/JSON parsing + tinyglobby expansion surface of WorkspaceLocator.
// Mocks `node:fs/promises` and `tinyglobby` so the test does not depend on the
// host file system layout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { access, readFile } from 'node:fs/promises';

import { glob } from 'tinyglobby';

import { WorkspaceLocator } from './WorkspaceLocator.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('tinyglobby', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

interface FileSystemFixture {
  files: Map<string, string>;
  matches: Map<string, string[]>;
}

function setupFs(fixture: FileSystemFixture) {
  vi.mocked(readFile).mockImplementation(async (path) => {
    const key = String(path);
    const content = fixture.files.get(key);
    if (content === undefined) {
      throw Object.assign(new Error(`ENOENT: ${key}`), { code: 'ENOENT' });
    }
    return content;
  });
  vi.mocked(access).mockImplementation(async (path) => {
    const key = String(path);
    if (!fixture.files.has(key)) {
      throw Object.assign(new Error(`ENOENT: ${key}`), { code: 'ENOENT' });
    }
  });
  vi.mocked(glob).mockImplementation(async (patterns) => {
    const key = JSON.stringify(patterns);
    return fixture.matches.get(key) ?? [];
  });
}

describe('WorkspaceLocator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('expands array-form workspaces via tinyglobby', async () => {
    setupFs({
      files: new Map([
        ['/repo/package.json', JSON.stringify({ workspaces: ['packages/*'] })],
        ['/repo/packages/a/package.json', '{}'],
        ['/repo/packages/b/package.json', '{}'],
      ]),
      matches: new Map([
        [JSON.stringify(['packages/*']), ['/repo/packages/a', '/repo/packages/b']],
      ]),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    expect(roots).toEqual(new Set(['/repo/packages/a', '/repo/packages/b']));
  });

  it('expands object-form workspaces.packages', async () => {
    setupFs({
      files: new Map([
        ['/repo/package.json', JSON.stringify({ workspaces: { packages: ['packages/*'] } })],
        ['/repo/packages/a/package.json', '{}'],
      ]),
      matches: new Map([[JSON.stringify(['packages/*']), ['/repo/packages/a']]]),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    expect(roots).toEqual(new Set(['/repo/packages/a']));
  });

  it('returns an empty Set when there is no workspaces field and no pnpm-workspace.yaml', async () => {
    setupFs({
      files: new Map([['/repo/package.json', JSON.stringify({ name: 'root' })]]),
      matches: new Map(),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    expect(roots).toEqual(new Set());
  });

  it('falls back to pnpm-workspace.yaml when no workspaces field is present', async () => {
    setupFs({
      files: new Map([
        ['/repo/package.json', JSON.stringify({ name: 'root' })],
        ['/repo/pnpm-workspace.yaml', `packages:\n  - 'apps/*'\n`],
        ['/repo/apps/web/package.json', '{}'],
      ]),
      matches: new Map([[JSON.stringify(['apps/*']), ['/repo/apps/web']]]),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    expect(roots).toEqual(new Set(['/repo/apps/web']));
  });

  it('prefers yarn workspaces when both workspaces field and pnpm-workspace.yaml are present', async () => {
    setupFs({
      files: new Map([
        ['/repo/package.json', JSON.stringify({ workspaces: ['packages/*'] })],
        ['/repo/pnpm-workspace.yaml', `packages:\n  - 'apps/*'\n`],
        ['/repo/packages/a/package.json', '{}'],
        ['/repo/apps/web/package.json', '{}'],
      ]),
      matches: new Map([
        [JSON.stringify(['packages/*']), ['/repo/packages/a']],
        [JSON.stringify(['apps/*']), ['/repo/apps/web']],
      ]),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    expect(roots).toEqual(new Set(['/repo/packages/a']));
  });

  it('filters out matched directories that do not contain a package.json', async () => {
    setupFs({
      files: new Map([
        ['/repo/package.json', JSON.stringify({ workspaces: ['packages/*'] })],
        ['/repo/packages/a/package.json', '{}'],
        // /repo/packages/b is matched by glob but has no package.json — filtered out.
      ]),
      matches: new Map([
        [JSON.stringify(['packages/*']), ['/repo/packages/a', '/repo/packages/b']],
      ]),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    expect(roots).toEqual(new Set(['/repo/packages/a']));
  });

  it('returns absolute, normalised paths', async () => {
    setupFs({
      files: new Map([
        ['/repo/package.json', JSON.stringify({ workspaces: ['packages/*'] })],
        ['/repo/packages/a/package.json', '{}'],
      ]),
      matches: new Map([[JSON.stringify(['packages/*']), ['/repo/packages/./a']]]),
    });

    const locator = new WorkspaceLocator('/repo');
    const roots = await locator.locate();

    // pathe.normalize collapses '/./' and yields '/repo/packages/a'.
    expect(roots).toEqual(new Set(['/repo/packages/a']));
  });
});

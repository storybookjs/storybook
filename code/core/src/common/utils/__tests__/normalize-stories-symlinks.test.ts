import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { normalizeStoriesEntry } from '../normalize-stories.ts';

// Unlike normalize-stories.test.ts, this file deliberately does NOT mock
// node:fs - it exercises normalizeStoriesEntry against a real symlink on
// disk, which is the only way to catch a regression in how isDirectory()
// resolves symlinked entries.
describe('normalizeStoriesEntry with a real symlinked stories directory', () => {
  let root: string;
  let configDir: string;

  beforeEach(() => {
    // A `stories` folder that's a symlink to another package's folder is
    // exactly what pnpm/yarn workspaces produce when two packages share a
    // set of stories, or what a monorepo author wires up by hand.
    root = mkdtempSync(join(tmpdir(), 'normalize-stories-symlinks-'));
    configDir = join(root, '.storybook');
    mkdirSync(configDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('treats a symlink to a real directory as a directory', () => {
    const targetDir = join(root, 'shared-stories');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, 'Button.stories.tsx'), '');

    symlinkSync(targetDir, join(configDir, 'stories-link'), 'dir');

    const specifier = normalizeStoriesEntry('stories-link', {
      configDir,
      workingDir: configDir,
    });

    expect(specifier.files).toBe('**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))');
    expect(specifier.importPathMatcher.test('./stories-link/Button.stories.tsx')).toBe(true);
  });

  it('still treats a symlink to a file as a file', () => {
    const targetFile = join(root, 'Button.stories.tsx');
    writeFileSync(targetFile, '');

    symlinkSync(targetFile, join(configDir, 'file-link.stories.tsx'), 'file');

    const specifier = normalizeStoriesEntry('file-link.stories.tsx', {
      configDir,
      workingDir: configDir,
    });

    expect(specifier.files).toBe('file-link.stories.tsx');
  });

  it('does not throw on a dangling symlink, and treats it as a non-directory', () => {
    symlinkSync(join(root, 'does-not-exist'), join(configDir, 'dangling-link'), 'dir');

    const specifier = normalizeStoriesEntry('dangling-link', {
      configDir,
      workingDir: configDir,
    });

    expect(specifier.files).toBe('dangling-link');
  });
});

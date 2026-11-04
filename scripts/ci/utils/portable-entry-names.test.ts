import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { workspace } from './helpers.ts';
import {
  findNonPortableEntryNames,
  formatNonPortableEntriesError,
  listEntryNamesUnder,
} from './portable-entry-names.ts';

// Symlink creation needs privileges on Windows; the scripts tests run on Linux
// CI, where it always works.
const canSymlink = await (async () => {
  const probeDir = await mkdtemp(join(tmpdir(), 'portable-names-probe-'));
  try {
    await symlink('target', join(probeDir, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    await rm(probeDir, { recursive: true, force: true });
  }
})();

describe('findNonPortableEntryNames', () => {
  it('flags emoji-named entries, reported relative to the scanned root', () => {
    const entries = [
      'storybook-static/index.html',
      'storybook-static/services/core/docgen/😀.json',
      'storybook-static/services/core/story-docs/😀.json',
      'storybook-static/sb-manager/globals.js',
    ];

    expect(findNonPortableEntryNames(entries)).toEqual([
      'storybook-static/services/core/docgen/😀.json',
      'storybook-static/services/core/story-docs/😀.json',
    ]);
  });

  it('passes plain-ASCII entry names without false positives', () => {
    const entries = [
      'storybook-static/index.html',
      'storybook-static/iframe.html',
      'storybook-static/assets/unicode.stories-CpR9-KhQ.js',
      'storybook-static/sb-addons/storybook-core-core-server-presets-index-js/manager.mjs',
    ];

    expect(findNonPortableEntryNames(entries)).toEqual([]);
  });

  it('passes names the Windows ANSI code page can encode, like accented letters and dashes', () => {
    expect(
      findNonPortableEntryNames(['äußere.html', 'componente-ñ.json', 'naïve—file.md'])
    ).toEqual([]);
  });

  it('flags other non-ANSI scripts and emoji-named directories', () => {
    const entries = [
      'storybook-static/компоненты/кнопка.json',
      'storybook-static/组件/按钮.json',
      'storybook-static/😀/index.json',
    ];

    expect(findNonPortableEntryNames(entries)).toEqual(entries);
  });
});

describe('listEntryNamesUnder', () => {
  it('lists every entry relative to the scanned root, symlinks included', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portable-names-'));
    try {
      await mkdir(join(root, 'storybook-static', 'assets'), { recursive: true });
      await writeFile(join(root, 'index.html'), '');
      await writeFile(join(root, 'storybook-static', 'assets', 'unicode.stories-CpR9-KhQ.js'), '');

      expect(await listEntryNamesUnder(root)).toEqual([
        'index.html',
        'storybook-static',
        'storybook-static/assets',
        'storybook-static/assets/unicode.stories-CpR9-KhQ.js',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.runIf(canSymlink)('does not traverse symlink targets — tar stores only the link', async () => {
    const root = await mkdtemp(join(tmpdir(), 'portable-names-'));
    const outside = await mkdtemp(join(tmpdir(), 'portable-names-outside-'));
    try {
      await mkdir(join(root, 'assets'), { recursive: true });
      await writeFile(join(outside, '😀.json'), '');
      // A portable link whose target holds an emoji name: tar never stores the
      // target's contents, so the guard must pass this tree.
      await symlink(outside, join(root, 'assets', 'link'), 'dir');
      await writeFile(join(root, 'index.html'), '');

      const names = await listEntryNamesUnder(root);

      expect(names).toEqual(['assets', 'assets/link', 'index.html']);
      expect(findNonPortableEntryNames(names)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it.runIf(canSymlink)(
    'flags an emoji-named file at its real path, not through a link to its directory',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'portable-names-'));
      try {
        await mkdir(join(root, 'target-dir'), { recursive: true });
        await writeFile(join(root, 'target-dir', '😀.json'), '');
        await symlink('target-dir', join(root, 'link'), 'dir');

        const names = await listEntryNamesUnder(root);

        expect(names).toEqual(['link', 'target-dir', 'target-dir/😀.json']);
        expect(findNonPortableEntryNames(names)).toEqual(['target-dir/😀.json']);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  );
});

describe('formatNonPortableEntriesError', () => {
  it('prints every offending name', () => {
    const message = formatNonPortableEntriesError(['docgen/😀.json', 'story-docs/😀.json']);

    expect(message).toContain('docgen/😀.json');
    expect(message).toContain('story-docs/😀.json');
  });
});

describe('workspace.packSandbox', () => {
  it('scans entry names for portability before the archive is created', () => {
    const { command } = workspace.packSandbox('react-vite-default-ts').run;
    const guard = command.indexOf(
      'node project/scripts/ci/check-portable-entry-names.ts storybook-sandboxes/react-vite-default-ts'
    );
    const pack = command.indexOf('tar --create');

    expect(guard).toBeGreaterThan(-1);
    expect(pack).toBeGreaterThan(guard);
  });
});

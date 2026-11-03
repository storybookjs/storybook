import { describe, expect, it } from 'vitest';

import { workspace } from './helpers.ts';
import {
  findNonPortableEntryNames,
  formatNonPortableEntriesError,
} from './portable-entry-names.ts';

describe('findNonPortableEntryNames', () => {
  it('flags emoji-named entries, keeping the archive-relative path', () => {
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
    const entries = ['storybook-static/компоненты/кнопка.json', 'storybook-static/组件/按钮.json'];

    expect(findNonPortableEntryNames(entries)).toEqual(entries);
  });
});

describe('formatNonPortableEntriesError', () => {
  it('prints every offending name and the fix pointer', () => {
    const message = formatNonPortableEntriesError(['docgen/😀.json', 'story-docs/😀.json']);

    expect(message).toContain('docgen/😀.json');
    expect(message).toContain('story-docs/😀.json');
    expect(message).toContain('Windows tar.exe cannot extract these');
    expect(message).toContain('Fix: make the emitting path derive portable filenames');
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

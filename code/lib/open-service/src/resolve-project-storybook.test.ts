import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveChildHostScript } from './resolve-project-storybook.ts';

const OPEN_SERVICE = {
  'node_modules/@storybook/open-service/package.json': JSON.stringify({
    name: '@storybook/open-service',
    exports: { './child-host': './child-host.js' },
  }),
  'node_modules/@storybook/open-service/child-host.js': '',
};
const LEGACY_STORYBOOK = {
  'node_modules/storybook/package.json': JSON.stringify({
    name: 'storybook',
    exports: { './internal/tools/child-host': './child-host.js' },
  }),
  'node_modules/storybook/child-host.js': '',
};

let root: string | undefined;

function project(files: Record<string, string>): string {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'open-service-child-host-')));
  for (const [path, content] of Object.entries({ 'package.json': '{}', ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

afterEach(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe('resolveChildHostScript', () => {
  it.each([
    {
      name: 'prefers the open-service entry',
      files: { ...OPEN_SERVICE, ...LEGACY_STORYBOOK },
      expected: 'node_modules/@storybook/open-service/child-host.js',
    },
    {
      name: 'falls back to the storybook entry of older installations',
      files: LEGACY_STORYBOOK,
      expected: 'node_modules/storybook/child-host.js',
    },
  ])('$name', ({ files, expected }) => {
    const dir = project(files);

    expect(resolveChildHostScript(dir)).toBe(join(dir, expected));
  });

  it('throws when neither entry resolves', () => {
    expect(() => resolveChildHostScript(project({}))).toThrow(
      "Cannot find module '@storybook/open-service/child-host'"
    );
  });
});

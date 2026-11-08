import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { expect, it, onTestFinished } from 'vitest';

import { make, record } from './workspace-links.ts';

const repo = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'workspace-links-')));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of [
    'code/core',
    'code/addons/a11y',
    'scripts/rules',
    'node_modules/semver',
    'node_modules/@storybook',
    'node_modules/.bin',
    'code/node_modules',
  ]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(join(root, 'code/core/package.json'), '{}');
  symlinkSync('../code/core', join(root, 'node_modules/storybook'));
  symlinkSync('../../code/addons/a11y', join(root, 'node_modules/@storybook/addon-a11y'));
  // A portal, as eslint-plugin-local-rules is.
  symlinkSync('../scripts/rules', join(root, 'node_modules/eslint-plugin-local-rules'));
  symlinkSync('../core', join(root, 'code/node_modules/storybook'));
  symlinkSync('../semver/bin.js', join(root, 'node_modules/.bin/semver'));
  return root;
};

it('records every link into the repository, scoped and nested ones too, but not the bin links', () => {
  const root = repo();
  expect(record(root, ['./node_modules', './code/node_modules']).sort()).toEqual([
    ['./code/node_modules/storybook', 'code/core'],
    ['./node_modules/@storybook/addon-a11y', 'code/addons/a11y'],
    ['./node_modules/eslint-plugin-local-rules', 'scripts/rules'],
    ['./node_modules/storybook', 'code/core'],
  ]);
});

it('makes the links a restore lacks, and replaces a directory tar left in place of one', () => {
  const root = repo();
  const links = record(root, ['./node_modules', './code/node_modules']);
  rmSync(join(root, 'node_modules/storybook'));
  rmSync(join(root, 'node_modules/@storybook/addon-a11y'));
  rmSync(join(root, 'node_modules/eslint-plugin-local-rules'));
  mkdirSync(join(root, 'node_modules/eslint-plugin-local-rules/stale'), { recursive: true });

  expect(make(root, links)).toBe(3);
  expect(make(root, links)).toBe(0);
  expect(lstatSync(join(root, 'node_modules/eslint-plugin-local-rules')).isSymbolicLink()).toBe(
    true
  );
  for (const [link, target] of [
    ['node_modules/storybook', 'code/core'],
    ['node_modules/@storybook/addon-a11y', 'code/addons/a11y'],
    ['node_modules/eslint-plugin-local-rules', 'scripts/rules'],
  ]) {
    expect(realpathSync(join(root, link))).toBe(realpathSync(join(root, target)));
  }
  // Relative, as Yarn makes them; on Windows a junction, which holds an absolute path.
  if (process.platform !== 'win32') {
    expect(readlinkSync(join(root, 'node_modules/@storybook/addon-a11y'))).toBe(
      '../../code/addons/a11y'
    );
  }
});

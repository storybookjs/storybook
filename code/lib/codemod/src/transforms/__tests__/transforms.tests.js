import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { applyTransform } from 'jscodeshift/dist/testUtils';

vi.mock('@storybook/core/node-logger');

const inputRegExp = /\.input\.js$/;

const fixturesDir = resolve(__dirname, '../__testfixtures__');
readdirSync(fixturesDir).forEach((transformName) => {
  // FIXME: delete after https://github.com/storybookjs/storybook/issues/19497

  // FIXME: delete after https://github.com/storybookjs/storybook/issues/19497
  if (transformName === 'mdx-to-csf') {
    return;
  }

  const transformFixturesDir = join(fixturesDir, transformName);
  describe(`${transformName}`, () => {
    fs.readdirSync(transformFixturesDir)
      .filter((fileName) => inputRegExp.test(fileName))
      .forEach((fileName) => {
        const inputPath = join(transformFixturesDir, fileName);
        it(`transforms correctly using "${fileName}" data`, () =>
          expect(
            applyTransform(require(join(__dirname, '..', transformName)), null, {
              path: inputPath,
              source: fs.readFileSync(inputPath, 'utf8'),
            })
          ).toMatchFileSnapshot(inputPath.replace(inputRegExp, '.output.snapshot')));
      });
  });
});

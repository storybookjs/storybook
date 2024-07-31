import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { applyTransform } from 'jscodeshift/dist/testUtils';

vi.mock('@storybook/core/node-logger');

const inputRegExp = /\.input\.js$/;

const fixturesDir = path.resolve(__dirname, '../__testfixtures__');
fs.readdirSync(fixturesDir).forEach((transformName) => {
  // FIXME: delete after https://github.com/storybookjs/storybook/issues/19497
  if (transformName === 'mdx-to-csf') return;

  const transformFixturesDir = path.join(fixturesDir, transformName);
  describe(`${transformName}`, () => {
    fs.readdirSync(transformFixturesDir)
      .filter((fileName) => inputRegExp.test(fileName))
      .forEach((fileName) => {
        const inputPath = path.join(transformFixturesDir, fileName);
        it(`transforms correctly using "${fileName}" data`, () =>
          expect(
            applyTransform(require(path.join(__dirname, '..', transformName)), null, {
              path: inputPath,
              source: fs.readFileSync(inputPath, 'utf8'),
            })
          ).toMatchFileSnapshot(inputPath.replace(inputRegExp, '.output.snapshot')));
      });
  });
});

// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { sync as spawnSync } from 'cross-spawn';
import tmp from 'tmp';

import { extractArgTypesFromElements } from './custom-elements';

// File hierarchy:
// __testfixtures__ / some-test-case / input.*
const inputRegExp = /^input\..*$/;

const runWebComponentsAnalyzer = (inputPath: string) => {
  const { name: tmpDir, removeCallback } = tmp.dirSync();
  const customElementsFile = `${tmpDir}/custom-elements.json`;
  spawnSync(
    join(__dirname, '../../../../node_modules/.bin/wca'),
    ['analyze', inputPath, '--outFile', customElementsFile],
    {
      stdio: 'ignore',
      shell: true,
    }
  );
  const output = readFileSync(customElementsFile, 'utf8');
  try {
    removeCallback();
  } catch (e) {
    //
  }
  return output;
};

describe('web-components component properties', () => {
  // we need to mock lit and dynamically require custom-elements
  // because lit is distributed as ESM not CJS
  // https://github.com/Polymer/lit-html/issues/516
  vi.mock('lit', () => ({ default: {} }));
  vi.mock('lit/directive-helpers.js', () => ({ default: {} }));

  const fixturesDir = join(__dirname, '__testfixtures__');
  readdirSync(fixturesDir, { withFileTypes: true }).forEach((testEntry) => {
    if (testEntry.isDirectory()) {
      const testDir = join(fixturesDir, testEntry.name);
      const testFile = readdirSync(testDir).find((fileName) => inputRegExp.test(fileName));
      if (testFile) {
        it(`${testEntry.name}`, () => {
          const inputPath = join(testDir, testFile);

          // snapshot the output of wca
          const customElementsJson = runWebComponentsAnalyzer(inputPath);
          const customElements = JSON.parse(customElementsJson);
          customElements.tags.forEach((tag: any) => {
            tag.path = 'dummy-path-to-component';
          });
          expect(customElements).toMatchFileSnapshot(join(testDir, 'custom-elements.snapshot'));

          // snapshot the properties
          const properties = extractArgTypesFromElements('input', customElements);
          expect(properties).toMatchFileSnapshot(join(testDir, 'properties.snapshot'));
        });
      }
    }
  });
});

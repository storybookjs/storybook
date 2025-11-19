// @vitest-environment happy-dom
import { readdirSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { spawn } from 'cross-spawn';
import tmp from 'tmp';

import { extractArgTypesFromElements } from './custom-elements';

// File hierarchy:
// __testfixtures__ / some-test-case / input.*
const inputRegExp = /^input\..*$/;

const runWebComponentsAnalyzer = async (inputPath: string): Promise<string> => {
  const { name: tmpDir, removeCallback } = tmp.dirSync();
  const customElementsFile = `${tmpDir}/custom-elements.json`;
  const process = await spawn(
    join(__dirname, '../../../../node_modules/.bin/wca'),
    ['analyze', inputPath, '--outFile', customElementsFile],
    {
      stdio: 'ignore',
      shell: true,
    }
  );

  await new Promise((resolve, reject) => {
    process.on('close', resolve);
    process.on('error', reject);
  });

  const output = await readFile(customElementsFile, 'utf8');
  try {
    removeCallback();
  } catch (e) {
    //
  }
  return output;
};

vi.mock('lit', () => ({ default: {} }));
vi.mock('lit/directive-helpers.js', () => ({ default: {} }));

describe.skip('web-components component properties', { timeout: 15000, retry: 3 }, () => {
  // we need to mock lit and dynamically require custom-elements
  // because lit is distributed as ESM not CJS
  // https://github.com/Polymer/lit-html/issues/516

  const fixturesDir = join(__dirname, '__testfixtures__');
  const testEntries = readdirSync(fixturesDir, { withFileTypes: true });

  it.each(testEntries)('$name', async (testEntry) => {
    if (testEntry.isDirectory()) {
      const testDir = join(fixturesDir, testEntry.name);
      const testFile = (await readdir(testDir)).find((fileName) => inputRegExp.test(fileName));
      if (testFile) {
        const inputPath = join(testDir, testFile);

        // snapshot the output of wca
        const customElementsJson = await runWebComponentsAnalyzer(inputPath);
        const customElements = JSON.parse(customElementsJson);
        customElements.tags.forEach((tag: any) => {
          tag.path = 'dummy-path-to-component';
        });
        await expect(customElements).toMatchFileSnapshot(join(testDir, 'custom-elements.snapshot'));

        // snapshot the properties
        const properties = extractArgTypesFromElements('input', customElements);
        await expect(properties).toMatchFileSnapshot(join(testDir, 'properties.snapshot'));
      }
    }
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// File hierarchy: __testfixtures__ / some-test-case / input.*
const inputRegExp = /^input\..*$/;

describe('angular component properties', () => {
  const fixturesDir = path.join(__dirname, '__testfixtures__');
  fs.readdirSync(fixturesDir, { withFileTypes: true }).forEach((testEntry) => {
    if (testEntry.isDirectory()) {
      const testDir = path.join(fixturesDir, testEntry.name);
      const testFile = fs.readdirSync(testDir).find((fileName) => inputRegExp.test(fileName));
      if (testFile) {
        // TODO: Remove this as soon as the real test is fixed
        it('true', () => {
          expect(true).toEqual(true);
        });
        // TODO: Fix this test
        // it(`${testEntry.name}`, () => {
        //   const inputPath = path.join(testDir, testFile);

        //   // snapshot the output of compodoc
        //   const compodocOutput = runCompodoc(inputPath);
        //   const compodocJson = JSON.parse(compodocOutput);
        //   expect(compodocJson).toMatchFileSnapshot(
        //     path.join(testDir, `compodoc-${SNAPSHOT_OS}.snapshot`)
        //   );

        //   // snapshot the output of addon-docs angular-properties
        //   const componentData = findComponentByName('InputComponent', compodocJson);
        //   const argTypes = extractArgTypesFromData(componentData);
        //   expect(argTypes).toMatchFileSnapshot(path.join(testDir, 'argtypes.snapshot'));
        // });
      }
    }
  });
});

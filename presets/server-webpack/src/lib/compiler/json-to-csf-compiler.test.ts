import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import YAML from 'yaml';

import { compileCsfModule } from '.';

async function generate(filePath: string) {
  const content = await readFile(filePath, { encoding: 'utf8' });
  const parsed = filePath.endsWith('.json') ? JSON.parse(content) : YAML.parse(content);
  return compileCsfModule(parsed);
}

['json', 'ya?ml'].forEach((fileType) => {
  const inputRegExp = new RegExp(`.${fileType}$`);

  describe(`${fileType}-to-csf-compiler`, () => {
    const transformFixturesDir = join(__dirname, '__testfixtures__');
    readdirSync(transformFixturesDir)
      .filter((fileName: string) => inputRegExp.test(fileName))
      .forEach((fixtureFile: string) => {
        it(`${fixtureFile}`, async () => {
          const inputPath = join(transformFixturesDir, fixtureFile);
          const code = await generate(inputPath);
          expect(code).toMatchFileSnapshot(inputPath.replace(inputRegExp, '.snapshot'));
        });
      });
  });
});

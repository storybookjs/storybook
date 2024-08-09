import { describe, expect, it } from 'vitest';

import fs from 'fs-extra';
import path from 'path';
import YAML from 'yaml';

import { compileCsfModule } from '.';

async function generate(filePath: string) {
  const content = await fs.readFile(filePath, 'utf8');
  const parsed = filePath.endsWith('.json') ? JSON.parse(content) : YAML.parse(content);
  return compileCsfModule(parsed);
}

['json', 'ya?ml'].forEach((fileType) => {
  const inputRegExp = new RegExp(`.${fileType}$`);

  describe(`${fileType}-to-csf-compiler`, () => {
    const transformFixturesDir = path.join(__dirname, '__testfixtures__');
    fs.readdirSync(transformFixturesDir)
      .filter((fileName: string) => inputRegExp.test(fileName))
      .forEach((fixtureFile: string) => {
        it(`${fixtureFile}`, async () => {
          const inputPath = path.join(transformFixturesDir, fixtureFile);
          const code = await generate(inputPath);
          expect(code).toMatchFileSnapshot(inputPath.replace(inputRegExp, '.snapshot'));
        });
      });
  });
});

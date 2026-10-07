import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { docgenServer } from './docgen-server.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const configDir = '/project/.storybook';
const mainConfigPath = '/project/.storybook/main.ts';
const project = {
  packageManager: {} as JsPackageManager,
  configDir,
  mainConfigPath,
  mainConfig: { framework: '@storybook/react-vite', stories: [] } as StorybookConfigRaw,
  storybookVersion: '11.0.0',
  storiesPaths: [],
};

const migrate = async (source: string) => {
  vol.fromJSON({ [mainConfigPath]: source });
  if (!(await checkFix(docgenServer, project))) {
    return source;
  }
  const failures = await runFix(docgenServer, { ...project, result: {} });
  if (failures.length > 0) {
    throw new Error(failures.map(({ message }) => message).join('\n'));
  }
  return vol.readFileSync(mainConfigPath, 'utf8') as string;
};

beforeEach(() => {
  vol.reset();
  vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
  vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
});

afterEach(() => {
  vi.mocked(fsp.readFile).mockRestore();
  vi.mocked(fsp.writeFile).mockRestore();
});

describe('docgen-server', () => {
  it('renames the flag and keeps its value', async () => {
    expect(
      await migrate('export default { features: { experimentalDocgenServer: false } };')
    ).toMatchInlineSnapshot(`"export default { features: { docgenServer: false } };"`);
  });

  it('drops the old flag when docgenServer is already set', async () => {
    expect(
      await migrate(
        'export default { features: { docgenServer: true, experimentalDocgenServer: false } };'
      )
    ).toMatchInlineSnapshot(`
      "export default { features: {
        docgenServer: true
      } };"
    `);
  });

  it.each([
    'export default {};',
    'export default { features: { docgenServer: false } };',
    '// experimentalDocgenServer was removed\nexport default {};',
  ])('is not offered without the old flag: %s', async (source) => {
    vol.fromJSON({ [mainConfigPath]: source });
    expect(await checkFix(docgenServer, project)).toBeNull();
  });
});

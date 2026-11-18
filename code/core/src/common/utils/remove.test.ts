import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { fs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import type { JsPackageManager } from '../js-package-manager/JsPackageManager.ts';
import { removeAddon } from './remove.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

const CONFIG_DIR = resolve('/project/.storybook');
const MAIN = resolve('/project/.storybook/main.ts');
const ADDON = '@storybook/addon-svelte-csf';

const mainConfigFile = (addons: string) => dedent`
  export default {
    addons: [${addons}],
  };
`;

describe('removeAddon', () => {
  const packageManager = {
    removeDependencies: vi.fn(),
    installDependencies: vi.fn(),
  } as unknown as JsPackageManager;

  const remove = () =>
    removeAddon(ADDON, { packageManager, configDir: CONFIG_DIR, skipInstall: true });

  beforeEach(() => {
    vol.reset();
    vi.mocked(existsSync).mockImplementation(fs.existsSync as typeof existsSync);
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(packageManager.removeDependencies).mockResolvedValue(undefined);
  });

  it('removes the addon from the dependencies and from addons', async () => {
    vol.fromJSON({ [MAIN]: mainConfigFile(`'@storybook/addon-docs', '${ADDON}'`) });

    await remove();

    expect(packageManager.removeDependencies).toHaveBeenCalledWith([ADDON]);
    expect(fs.readFileSync(MAIN, 'utf8')).toContain("addons: ['@storybook/addon-docs']");
  });

  it.each([
    ['its preset', `'${ADDON}/preset'`],
    ['an absolute path to it', `'/project/node_modules/${ADDON}/dist/preset.js'`],
    ['the object form', `{ name: '${ADDON}', options: { legacyTemplate: true } }`],
    ['the addon twice', `'${ADDON}', '${ADDON}/preset'`],
  ])('removes an entry that names %s', async (_, entry) => {
    vol.fromJSON({ [MAIN]: mainConfigFile(`'@storybook/addon-docs', ${entry}`) });

    await remove();

    expect(fs.readFileSync(MAIN, 'utf8')).toContain("addons: ['@storybook/addon-docs']");
  });

  it('leaves the main config unchanged when it does not list the addon', async () => {
    const main = mainConfigFile(`'@storybook/addon-docs'`);
    vol.fromJSON({ [MAIN]: main });

    await remove();

    expect(fs.readFileSync(MAIN, 'utf8')).toBe(main);
  });

  it('warns when it cannot read the addons entries', async () => {
    const main = dedent`
      const shared = ['@storybook/addon-docs'];
      export default { addons: [...shared, '${ADDON}'] };
    `;
    vol.fromJSON({ [MAIN]: main });

    await remove();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to remove '${ADDON}'`)
    );
    expect(fs.readFileSync(MAIN, 'utf8')).toBe(main);
  });
});

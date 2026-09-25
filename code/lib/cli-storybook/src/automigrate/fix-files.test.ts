import { readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { createFixFiles } from './fix-files.ts';

vi.mock('node:fs/promises', { spy: true });

const main = resolve('.storybook/main.ts');
const story = resolve('Button.stories.ts');
const broken = resolve('Broken.stories.ts');

describe('createFixFiles', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(unlink).mockImplementation(fs.promises.unlink as typeof unlink);
    vol.fromJSON({
      [main]: "export default { addons: ['a'] };",
      [story]: "import { fn } from '@storybook/test'; export default {};",
      [broken]: 'export default {',
    });
  });

  it('writes staged edits only on commit, and later edits see earlier ones', async () => {
    const { files, commit } = createFixFiles();
    await files.editConfig(main, (config) => config.set(['framework'], 'x'));
    await files.edit(main, (source) => `// banner\n${source}`);
    files.write(resolve('.storybook/new.ts'), 'export {};');

    expect(fs.readFileSync(main, 'utf8')).toBe("export default { addons: ['a'] };");

    await commit();
    expect(fs.readFileSync(main, 'utf8')).toMatchInlineSnapshot(`
      "// banner
      export default {
        addons: ['a'],
        framework: 'x'
      };"
    `);
    expect(fs.readFileSync(resolve('.storybook/new.ts'), 'utf8')).toBe('export {};');
  });

  it('attempts every file and reports each failure in one error', async () => {
    const { files, commit } = createFixFiles();
    const edited: string[] = [];

    await expect(
      files.editCsf([broken, story, resolve('Missing.stories.ts')], (_, path) => {
        edited.push(path);
      })
    ).rejects.toThrow(/Broken\.stories\.ts[\s\S]*Missing\.stories\.ts/);
    expect(edited).toEqual([story]);

    await commit();
    expect(fs.readFileSync(story, 'utf8')).toBe(
      "import { fn } from '@storybook/test'; export default {};"
    );
  });

  it('rejects config edits that leave mutation diagnostics', async () => {
    const { files } = createFixFiles();
    fs.writeFileSync(main, 'export default { ...shared };');

    await expect(files.editConfig(main, (config) => config.remove(['addons']))).rejects.toThrow(
      main
    );
  });

  it('skips unchanged files and resolves with the changed paths', async () => {
    const { files } = createFixFiles();

    expect(
      await files.edit([story, main, story], (source) =>
        source.replace('@storybook/test', 'storybook/test')
      )
    ).toEqual([story]);
  });

  it('refuses to overwrite a file another writer changed after it was read', async () => {
    const { files, commit } = createFixFiles();
    await files.edit(story, (source) => source.replace('@storybook/test', 'storybook/test'));
    await files.editConfig(main, (config) => config.set(['framework'], 'x'));
    fs.writeFileSync(main, "export default { addons: ['a', 'b'] };");

    await expect(commit()).rejects.toThrow(main);
    expect(fs.readFileSync(main, 'utf8')).toBe("export default { addons: ['a', 'b'] };");
    expect(fs.readFileSync(story, 'utf8')).toContain('@storybook/test');
  });

  it('removes a file on commit and rejects later reads of it', async () => {
    const { files, commit } = createFixFiles();
    files.remove(story);

    await expect(files.read(story)).rejects.toThrow('was removed by this migration');
    expect(fs.existsSync(story)).toBe(true);

    await commit();
    expect(fs.existsSync(story)).toBe(false);
  });
});

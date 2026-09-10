import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { loadConfig, writeConfig } from './ConfigFile.ts';

vi.mock('node:fs/promises', { spy: true });

const fileName = resolve('main.ts');
const source = "export default { addons: ['old'], deviceAddons: ['existing'] };";

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ [fileName]: source });
  vi.mocked(writeFile).mockImplementation(async (file, data) => {
    await fs.promises.writeFile(file.toString(), data.toString());
  });
});

describe('writeConfig', () => {
  it('writes successful set operations', async () => {
    const config = loadConfig(source, fileName).parse();
    config.set(['features', 'enabled'], true);

    await writeConfig(config);

    const output = loadConfig(fs.readFileSync(fileName, 'utf8').toString()).parse();
    expect(output.getFieldValue(['features', 'enabled'])).toBe(true);
    expect(output.getFieldValue(['addons'])).toEqual(['old']);
  });

  it('leaves the file unchanged after a failed mutation', async () => {
    const config = loadConfig(source, fileName).parse();
    config.set(['features', 'enabled'], true);
    config.rename(['addons'], 'deviceAddons');

    await expect(writeConfig(config)).rejects.toThrow('occupied destination');
    expect(fs.readFileSync(fileName, 'utf8')).toBe(source);
  });
});

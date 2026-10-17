import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { componentSubtitle } from './component-subtitle.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const previewConfigPath = resolve('.storybook/preview.ts');
const storyPath = resolve('src/Button.stories.ts');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath: resolve('.storybook/main.ts'),
  configDir: resolve('.storybook'),
  storybookVersion: '11.0.0',
  previewConfigPath,
  storiesPaths: [storyPath],
};

const migrate = async (files: { preview?: string; story?: string }) => {
  vol.fromJSON({ [previewConfigPath]: files.preview ?? '', [storyPath]: files.story ?? '' });
  const failures = await runFix(componentSubtitle, { ...options, result: {} });
  return {
    failures,
    preview: fs.readFileSync(previewConfigPath, 'utf8'),
    story: fs.readFileSync(storyPath, 'utf8'),
  };
};

describe('component-subtitle', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  it('applies only when a file uses componentSubtitle', async () => {
    vol.fromJSON({ [previewConfigPath]: 'export default {};', [storyPath]: 'export default {};' });
    expect(await checkFix(componentSubtitle, options)).toBeNull();

    fs.writeFileSync(storyPath, "export default { parameters: { componentSubtitle: 'A' } };");
    expect(await checkFix(componentSubtitle, options)).toEqual({});
  });

  it('leaves MDX docs that mention componentSubtitle to the author', async () => {
    const docsPath = resolve('src/Intro.mdx');
    vol.fromJSON({
      [previewConfigPath]: 'export default {};',
      [docsPath]: "<Meta parameters={{ componentSubtitle: 'A' }} />",
    });

    expect(await checkFix(componentSubtitle, { ...options, storiesPaths: [docsPath] })).toBeNull();
  });

  it('moves componentSubtitle to docs.subtitle in the preview and meta, where the Subtitle block read it', async () => {
    const { failures, preview, story } = await migrate({
      preview: "export default { parameters: { componentSubtitle: 'Preview' } };",
      story: [
        "export default { parameters: { componentSubtitle: 'Meta', docs: { source: { type: 'code' } } } };",
        "export const Primary = { parameters: { componentSubtitle: 'Story' } };",
      ].join('\n'),
    });

    expect(failures).toEqual([]);
    expect(preview).toMatchInlineSnapshot(
      `"export default { parameters: { docs: { subtitle: 'Preview' } } };"`
    );
    expect(story).toMatchInlineSnapshot(`
      "export default { parameters: { docs: { source: { type: 'code' }, subtitle: 'Meta' } } };
      export const Primary = { parameters: { componentSubtitle: 'Story' } };"
    `);
  });

  it('keeps an existing docs.subtitle, which the Subtitle block preferred', async () => {
    const { story } = await migrate({
      story:
        "export default { parameters: { componentSubtitle: 'Legacy', docs: { subtitle: 'Current' } } };",
    });

    expect(story).toMatchInlineSnapshot(
      `"export default { parameters: { docs: { subtitle: 'Current' } } };"`
    );
  });

  it('skips a file it cannot migrate safely and reports it', async () => {
    const story =
      "import { shared } from './shared';\nexport default { parameters: { ...shared, componentSubtitle: 'A' } };";

    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.any(String) },
    ]);
    expect(result.story).toBe(story);
  });
});

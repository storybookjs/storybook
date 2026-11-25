import type { Rollup } from 'vite';
import { describe, expect, it } from 'vitest';

import { injectExportOrderPlugin } from './inject-export-order-plugin.ts';

const transform = async (code: string, id: string) => {
  const plugin = await injectExportOrderPlugin();
  const context = {
    error(error: Rollup.RollupError, pos?: number) {
      throw { ...error, pos };
    },
  } as Rollup.TransformPluginContext;
  return plugin.transform.handler.call(context, code, id);
};

describe('injectExportOrderPlugin', () => {
  it('appends the named exports in source order', async () => {
    const result = await transform(
      'export default { title: "Button" };\nexport const Primary = {};\nexport const Secondary = {};',
      '/src/Button.stories.js'
    );

    expect(result?.code).toContain(';export const __namedExportsOrder = ["Primary","Secondary"];');
  });

  it('suggests a JSX extension when a .js story file cannot be parsed', async () => {
    await expect(
      transform(
        'export default { title: "Button" };\nexport const Primary = () => <button>Hi</button>;',
        '/src/Button.stories.js'
      )
    ).rejects.toMatchObject({
      message:
        'Failed to parse the story file. If you are using JSX, make sure to name the file with the .jsx or .tsx extension.',
      pos: 85,
    });
  });

  it('does not suggest a JSX extension for .jsx story files', async () => {
    await expect(
      transform('export const Primary = () => <button>Hi</button>;', '/src/Button.stories.jsx')
    ).rejects.toMatchObject({
      message: 'Failed to parse the story file.',
    });
  });
});

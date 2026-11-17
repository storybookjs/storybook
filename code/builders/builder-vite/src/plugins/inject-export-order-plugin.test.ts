import type { Rollup } from 'vite';
import { describe, expect, it } from 'vitest';

import { injectExportOrderPlugin } from './inject-export-order-plugin.ts';

const transform = async (code: string, id: string) => {
  const plugin = await injectExportOrderPlugin();
  const context: Pick<Rollup.TransformPluginContext, 'error'> = {
    error(error) {
      throw error;
    },
  };
  return plugin.transform.handler.call(context as Rollup.TransformPluginContext, code, id);
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
        'Failed to parse the story file: Parse error @:2:50. If the file contains JSX, rename it to use the .jsx or .tsx extension.',
      pos: 85,
    });
  });

  it('does not suggest a JSX extension for .jsx story files', async () => {
    await expect(
      transform('export const Primary = () => <button>Hi</button>;', '/src/Button.stories.jsx')
    ).rejects.toMatchObject({
      message: 'Failed to parse the story file: Parse error @:1:50.',
    });
  });
});

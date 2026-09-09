import { describe, expect, it } from 'vitest';

import { printCsf } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { transformStoryFile } from './addon-globals-api.ts';

const transform = (source: string) => {
  const result = transformStoryFile(source, {
    needsViewportMigration: true,
    needsBackgroundsMigration: true,
    viewportsOptions: undefined,
    backgroundsOptions: undefined,
  });
  return result ? printCsf(result).code : null;
};

describe('addon-globals-api story objects', () => {
  it('migrates CSF2 story annotations in place', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = () => null;
      Primary.parameters = {
        backgrounds: { disable: true },
      };
    `;

    expect(transform(source)).toMatchInlineSnapshot(`
      "export default { title: 'Button' };
      export const Primary = () => null;
      Primary.parameters = {
        backgrounds: { disabled: true },
      };"
    `);
  });

  it('preserves CSF2 defaults that require a separate globals annotation', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = () => null;
      Primary.parameters = {
        backgrounds: { default: 'Dark' },
      };
    `;

    expect(transform(source)).toBeNull();
  });

  it('migrates CSF4 story objects', () => {
    const source = dedent`
      import preview from './preview';
      const meta = preview.meta({ title: 'Button' });
      export const Primary = meta.story({
        parameters: { viewport: { defaultViewport: 'mobile' } },
      });
    `;

    expect(transform(source)).toMatchInlineSnapshot(`
      "import preview from './preview';
      const meta = preview.meta({ title: 'Button' });
      export const Primary = meta.story({
        globals: {
          viewport: {
            value: "mobile",
            isRotated: false
          }
        },
      });"
    `);
  });

  it('leaves unsafe story objects unchanged', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        ...base,
        parameters: { backgrounds: { default: 'Dark' } },
      };
    `;

    expect(transform(source)).toBeNull();
  });
});

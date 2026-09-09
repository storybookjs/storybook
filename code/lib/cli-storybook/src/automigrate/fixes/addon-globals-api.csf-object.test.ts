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
            value: 'mobile',
            isRotated: false
          }
        },
      });"
    `);
  });

  it('migrates parameters an earlier spread cannot shadow', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        ...base,
        parameters: { backgrounds: { disable: true } },
      };
    `;

    expect(transform(source)).toMatchInlineSnapshot(`
      "export default { title: 'Button' };
      export const Primary = {
        ...base,
        parameters: { backgrounds: { disabled: true } },
      };"
    `);
  });

  it('leaves story objects with a shadowing spread unchanged', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        parameters: { backgrounds: { disable: true } },
        ...base,
      };
    `;

    expect(transform(source)).toBeNull();
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

  it('keeps default orientation when it cannot write isRotated', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        globals: { viewport: { value: 'mobile' } },
        parameters: { viewport: { defaultOrientation: 'portrait' } },
      };
    `;

    expect(transform(source)).toBeNull();
  });

  it('keeps dynamic default orientation', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        parameters: { viewport: { defaultViewport: 'mobile', defaultOrientation: orientation } },
      };
    `;

    expect(transform(source)).toContain('defaultOrientation: orientation');
  });

  it('preserves an existing rotation when adding a viewport value', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        globals: { viewport: { isRotated: true } },
        parameters: { viewport: { defaultViewport: 'mobile', defaultOrientation: 'landscape' } },
      };
    `;

    expect(transform(source)).toContain(`isRotated: true`);
    expect(transform(source)).toContain(`defaultOrientation: 'landscape'`);
  });

  it('removes deprecated disable when disabled already exists', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        parameters: { backgrounds: { disable: true, disabled: false } },
      };
    `;

    expect(transform(source)).toContain('disabled: false');
    expect(transform(source)).not.toMatch(/\bdisable:/);
  });

  it('removes deprecated viewport disable when disabled already exists', () => {
    const source = dedent`
      export default { title: 'Button' };
      export const Primary = {
        parameters: { viewport: { disable: true, disabled: false } },
      };
    `;

    expect(transform(source)).toContain('disabled: false');
    expect(transform(source)).not.toMatch(/\bdisable:/);
  });
});

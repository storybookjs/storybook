import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadCsf } from 'storybook/internal/csf-tools';

import { resolveMetaComponent } from './resolve-component.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const storyPath = join(fixturesDir, 'Button.stories.ts');

const parse = (source: string) => loadCsf(source, { makeTitle: () => 'Example/Button' }).parse();

describe('resolveMetaComponent', () => {
  it('resolves a default-imported SFC to its file and default export', () => {
    const csf = parse(`
      import Button from './Button.vue';
      export default { component: Button };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toEqual({
      component: {
        localName: 'Button',
        importId: './Button.vue',
        path: join(fixturesDir, 'Button.vue'),
        exportName: 'default',
      },
    });
  });

  it('carries the imported export name through a named import', () => {
    const csf = parse(`
      import { Button as Btn } from './Button.vue';
      export default { component: Btn };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toMatchObject({
      component: { localName: 'Btn', exportName: 'Button' },
    });
  });

  it('reports no-meta-component when the story file declares no component', () => {
    const csf = parse(`
      export default { title: 'Example/Button' };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toEqual({ reason: 'no-meta-component' });
  });

  it('reports no-component-import when the component is defined locally', () => {
    const csf = parse(`
      const Button = { template: '<button />' };
      export default { component: Button };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toEqual({ reason: 'no-component-import' });
  });

  it('reports no-component-import when the import cannot be resolved on disk', () => {
    const csf = parse(`
      import Button from './DoesNotExist.vue';
      export default { component: Button };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toEqual({ reason: 'no-component-import' });
  });

  it('ignores a type-only import of the same name', () => {
    const csf = parse(`
      import type { Button } from './Button.vue';
      export default { component: Button };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toEqual({ reason: 'no-component-import' });
  });
});

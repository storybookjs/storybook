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

  // `create-vue` scaffolds an `@/*` alias by default, so a Vue component is as likely to be imported
  // through a tsconfig path as relatively. This only works because the resolver sets
  // `tsconfig: 'auto'`; without it the alias silently fails to resolve and the component gets no
  // docgen at all.
  it('resolves a tsconfig paths alias', () => {
    const csf = parse(`
      import Button from '@ui/AliasedButton.vue';
      export default { component: Button };
      export const Default = {};
    `);

    expect(resolveMetaComponent(csf, storyPath)).toEqual({
      component: {
        localName: 'Button',
        importId: '@ui/AliasedButton.vue',
        path: join(fixturesDir, 'aliased', 'AliasedButton.vue'),
        exportName: 'default',
      },
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

import { describe, expect, it } from 'vitest';

import { loadCsf } from '../../csf-tools/index.ts';
import { createMetaComponentResolver } from './resolve-meta-component.ts';

const resolveMetaComponent = createMetaComponentResolver();

// Every case here uses an unresolvable specifier on purpose, so the assertions are about which
// identifier is followed rather than about module resolution reading the real filesystem.
const resolve = (source: string) =>
  resolveMetaComponent(
    loadCsf(source, { makeTitle: () => 'Button' }).parse(),
    '/project/x.stories.ts'
  );

describe('createMetaComponentResolver', () => {
  it('follows a named import to the name the module exports', () => {
    expect(
      resolve(`import { ButtonComponent as Btn } from './nowhere';
               export default { component: Btn };`)
    ).toEqual({
      component: {
        localName: 'Btn',
        importId: './nowhere',
        exportName: 'ButtonComponent',
        path: undefined,
      },
    });
  });

  it('unwraps type arguments, which are type-level only', () => {
    // Matching the printed source text instead would look for a binding named `Button<Props>`.
    expect(
      resolve(`import { Button } from './nowhere';
               export default { component: Button<Props> };`)
    ).toEqual({
      component: {
        localName: 'Button',
        importId: './nowhere',
        exportName: 'Button',
        path: undefined,
      },
    });
  });

  it('reports a component declared in the story file at the story file itself', () => {
    expect(
      resolve(`class Button {}
               export default { component: Button };`)
    ).toEqual({
      component: { localName: 'Button', exportName: 'Button', path: '/project/x.stories.ts' },
    });
  });

  it('follows no binding for a member expression', () => {
    expect(
      resolve(`import * as Buttons from './nowhere';
               export default { component: Buttons.Button };`)
    ).toEqual({ reason: 'no-meta-component' });
  });

  it('follows no binding for a call expression', () => {
    expect(
      resolve(`import { makeButton } from './nowhere';
               export default { component: makeButton() };`)
    ).toEqual({ reason: 'no-meta-component' });
  });

  it('reports a type-only import as unsupported rather than local', () => {
    expect(
      resolve(`import type { Button } from './nowhere';
               export default { component: Button };`)
    ).toEqual({ reason: 'no-component-import' });
  });
});

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadCsf } from '../../csf-tools/index.ts';
import { createMetaComponentResolver } from './resolve-meta-component.ts';

const resolveMetaComponent = createMetaComponentResolver();

// Cases that assert which identifier is followed use an unresolvable specifier on purpose, so they
// are not about module resolution reading the real filesystem. Cases that follow a reference into
// another module do read it, from the fixtures next to this file.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const resolve = (source: string, storyPath = '/project/x.stories.ts') =>
  resolveMetaComponent(loadCsf(source, { makeTitle: () => 'Button' }).parse(), storyPath);

const resolveInFixtures = (source: string) => resolve(source, join(FIXTURES, 'x.stories.ts'));

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

  it('follows a property access on a namespace import to the module that owns the component', () => {
    expect(
      resolveInFixtures(`import * as internal from './story-config';
                         export default { component: internal.config.component };`)
    ).toEqual({
      component: {
        localName: 'ButtonComponent',
        importId: './button.component',
        exportName: 'ButtonComponent',
        path: join(FIXTURES, 'button.component.ts'),
      },
    });
  });

  it('follows a property access on a local object', () => {
    expect(
      resolveInFixtures(`import { ButtonComponent } from './button.component';
                         const config = { component: ButtonComponent };
                         export default { component: config.component };`)
    ).toEqual({
      component: {
        localName: 'ButtonComponent',
        importId: './button.component',
        exportName: 'ButtonComponent',
        path: join(FIXTURES, 'button.component.ts'),
      },
    });
  });

  it("reads a namespace import's export as the named import it stands for", () => {
    expect(
      resolve(`import * as Buttons from './nowhere';
               export default { component: Buttons.Button };`)
    ).toEqual({
      component: {
        localName: 'Button',
        importId: './nowhere',
        exportName: 'Button',
        path: undefined,
      },
    });
  });

  it('reports a member expression it cannot follow, rather than no component at all', () => {
    expect(
      resolve(`import * as internal from './nowhere';
               export default { component: internal.config.component };`)
    ).toEqual({
      reason: 'unreadable-component-expression',
      expression: 'internal.config.component',
    });
  });

  it('reports a call expression, which only running the story could evaluate', () => {
    expect(
      resolve(`import { makeButton } from './nowhere';
               export default { component: makeButton() };`)
    ).toEqual({
      reason: 'unreadable-component-expression',
      expression: 'makeButton()',
    });
  });

  it('reports no component at all when the meta declares none', () => {
    expect(resolve(`export default { title: 'Button' };`)).toEqual({
      reason: 'no-meta-component',
    });
  });

  it('reports a type-only import as unsupported rather than local', () => {
    expect(
      resolve(`import type { Button } from './nowhere';
               export default { component: Button };`)
    ).toEqual({ reason: 'no-component-import' });
  });

  // A member copied in by a spread was written in another module, so the names inside it resolve
  // against that module rather than the one the chain lands in. Rather than track a scope per
  // member, a value carrying free names is refused once it crosses a module boundary: the caller
  // reports an unreadable expression, which is visible, instead of a class it guessed at.
  describe('a spread copies a component from a third module', () => {
    it('refuses rather than picking the spreading module same-named import', () => {
      // internal2.ts spreads `base` (which owns `component: ButtonComponent` from ./lib/button)
      // and separately imports an unrelated class under the identical local name `ButtonComponent`
      // from ./legacy/button. Resolving the copied identifier against internal2's own imports would
      // silently return the legacy class.
      expect(
        resolveInFixtures(`import * as internal from './internal2';
                           export default { component: internal.config.component };`)
      ).toEqual({
        reason: 'unreadable-component-expression',
        expression: 'internal.config.component',
      });
    });

    it('refuses rather than naming a module that never mentions the class', () => {
      // internal3.ts spreads the same `base`, but binds no local name `ButtonComponent` at all, so
      // resolving in its scope would report a path to a file with no such class.
      expect(
        resolveInFixtures(`import * as internal from './internal3';
                           export default { component: internal.config.component };`)
      ).toEqual({
        reason: 'unreadable-component-expression',
        expression: 'internal.config.component',
      });
    });
  });

  describe('a literal component beside an unresolvable spread', () => {
    it('resolves when the unresolvable spread runs before it', () => {
      expect(
        resolveInFixtures(`import * as internal from './spread-after';
                           export default { component: internal.config.component };`)
      ).toEqual({
        component: {
          localName: 'ButtonComponent',
          importId: './button.component',
          exportName: 'ButtonComponent',
          path: join(FIXTURES, 'button.component.ts'),
        },
      });
    });

    it('stays unresolved when the unresolvable spread runs after it, since it may still shadow it', () => {
      expect(
        resolveInFixtures(`import * as internal from './spread-before';
                           export default { component: internal.config.component };`)
      ).toEqual({
        reason: 'unreadable-component-expression',
        expression: 'internal.config.component',
      });
    });
  });
});

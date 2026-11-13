import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadCsf } from '../../csf-tools/index.ts';
import { extractDeclaredSubcomponents } from './subcomponents.ts';
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

  describe('a namespace a barrel re-exports', () => {
    it.each([
      ['`export * as`', 'UI', './ui'],
      ['a namespace import it exports by name', 'Imported', './ui'],
      ['a namespace export it forwards by name', 'Forwarded', './ui'],
      ['a namespace export it forwards with `export *`', 'Starred', './ui'],
    ])('follows %s to the module the namespace stands for', (_, namespace, importId) => {
      expect(
        resolveInFixtures(`import { ${namespace} } from './barrel';
                           export default { component: ${namespace}.Button };`)
      ).toEqual({
        component: {
          localName: 'Button',
          importId,
          exportName: 'Button',
          path: join(FIXTURES, 'barrel', 'ui', 'index.ts'),
        },
      });
    });

    it('prefers an explicit export over an `export *` written before it', () => {
      // ES modules let an explicit export shadow a star export, whatever the statement order.
      expect(
        resolveInFixtures(`import { UI } from './barrel/precedence';
                           export default { component: UI.Button };`)
      ).toMatchObject({ component: { path: join(FIXTURES, 'barrel', 'ui', 'index.ts') } });
    });

    it('does not follow an `export *` that a declared export of the same name shadows', () => {
      // `UI` is the object the barrel declares, so its `Button` is the class the object holds.
      expect(
        resolveInFixtures(`import { UI } from './barrel/declared';
                           export default { component: UI.Button };`)
      ).toMatchObject({ component: { path: join(FIXTURES, 'button.component.ts') } });
    });

    it('does not follow an `export *` that a destructured export of the same name shadows', () => {
      expect(
        resolveInFixtures(`import { UI } from './barrel/destructured';
                           export default { component: UI.Button };`)
      ).toEqual({ reason: 'unreadable-component-expression', expression: 'UI.Button' });
    });

    it('reports a named import that is not a namespace as unreadable', () => {
      expect(
        resolveInFixtures(`import { ButtonComponent } from './button.component';
                           export default { component: ButtonComponent.Button };`)
      ).toEqual({
        reason: 'unreadable-component-expression',
        expression: 'ButtonComponent.Button',
      });
    });
  });

  it('follows a `.js` specifier to the TypeScript file it stands for', () => {
    expect(
      resolveInFixtures(`import { UI } from './barrel/index.js';
                         export default { component: UI.Button };`)
    ).toMatchObject({
      component: { exportName: 'Button', path: join(FIXTURES, 'barrel', 'ui', 'index.ts') },
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

  // Declared subcomponents resolve through the same pass as the meta component, by passing the
  // component expression `extractDeclaredSubcomponents` found instead of the meta annotation.
  describe('a declared subcomponent node', () => {
    const resolveDeclared = (source: string, storyPath = '/project/x.stories.ts') => {
      const csf = loadCsf(source, { makeTitle: () => 'Button' }).parse();
      const declared = extractDeclaredSubcomponents(csf)[0];
      if (!declared) {
        throw new Error('Fixture declares no subcomponents');
      }
      return resolveMetaComponent(csf, storyPath, declared.node);
    };

    it('resolves like the meta component it is declared beside', () => {
      expect(
        resolveDeclared(`import { ButtonComponent as Btn } from './nowhere';
                         export default { subcomponents: { Header: Btn } };`)
      ).toEqual({
        component: {
          localName: 'Btn',
          importId: './nowhere',
          exportName: 'ButtonComponent',
          path: undefined,
        },
      });
    });

    it("reads a namespace import's property access", () => {
      expect(
        resolveDeclared(`import * as Buttons from './nowhere';
                         export default { subcomponents: { Header: Buttons.Button } };`)
      ).toEqual({
        component: {
          localName: 'Button',
          importId: './nowhere',
          exportName: 'Button',
          path: undefined,
        },
      });
    });

    it('resolves through a subcomponents object held in a local variable', () => {
      expect(
        resolveDeclared(`import { ButtonComponent } from './nowhere';
                         const parts = { Header: ButtonComponent };
                         export default { subcomponents: parts };`)
      ).toEqual({
        component: {
          localName: 'ButtonComponent',
          importId: './nowhere',
          exportName: 'ButtonComponent',
          path: undefined,
        },
      });
    });

    it('resolves a declared subcomponent to its file on disk', () => {
      expect(
        resolveDeclared(
          `import { ButtonComponent } from './button.component';
           export default { subcomponents: { Header: ButtonComponent } };`,
          join(FIXTURES, 'x.stories.ts')
        )
      ).toEqual({
        component: {
          localName: 'ButtonComponent',
          importId: './button.component',
          exportName: 'ButtonComponent',
          path: join(FIXTURES, 'button.component.ts'),
        },
      });
    });
  });
});

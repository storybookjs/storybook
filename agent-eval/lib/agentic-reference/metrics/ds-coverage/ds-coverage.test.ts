import { vol } from 'memfs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { analyzeDsCoverage } from './index.ts';

vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { ...memfs.fs, default: memfs.fs };
});

const ROOT = '/project';

function analyze(files: Record<string, string>, dsPackages = ['@ds/*']) {
  vol.fromJSON(files, ROOT);
  return analyzeDsCoverage({ projectDir: ROOT, dsPackages });
}

afterEach(() => {
  vol.reset();
});

describe('census include and exclude', () => {
  function analyzeFiltered(
    files: Record<string, string>,
    censusInclude: string[],
    censusExclude: string[] = []
  ) {
    vol.fromJSON(files, ROOT);
    return analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      censusInclude,
      censusExclude,
    });
  }

  // The whole point of the option: a monorepo that vendors its own design
  // system should not count the DS implementing itself as application UI,
  // but dropping those files from the graph would strand every import into
  // them. Both halves are asserted here — the count loses the directory, the
  // resolution does not.
  const VENDORED = {
    'packages/ui/src/Button.tsx': 'export const Button = () => <button><span /></button>',
    'src/App.tsx': [
      "import { Button } from '../packages/ui/src/Button'",
      'export const App = () => <main><Button /></main>',
    ].join('\n'),
  };

  it('counts a vendored design system’s own markup by default', () => {
    const report = analyzeFiltered(VENDORED, []);
    expect(report.nodes).toMatchObject({ all: 4, host: 3, component: 1, unresolved: 0 });
    expect(report.censusInclude).toEqual([]);
    expect(report.censusExclude).toEqual([]);
  });

  it('drops an excluded glob from the count while still resolving into it', () => {
    const report = analyzeFiltered(VENDORED, [], ['packages/ui/**']);
    // App.tsx's two elements only; Button.tsx's <button><span/> are gone.
    expect(report.nodes).toMatchObject({ all: 2, host: 1, component: 1, unresolved: 0 });
    // Still attributed to the file it came from, which is the half that
    // would break if the filter had gone through the module graph.
    expect(report.components['packages/ui/src/Button.tsx#Button']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.censusExclude).toEqual(['packages/ui/**']);
    expect(report.perFile['packages/ui/src/Button.tsx']).toBeUndefined();
  });

  it('counts only what an include glob selects', () => {
    const report = analyzeFiltered(VENDORED, ['src/**']);
    expect(report.nodes).toMatchObject({ all: 2, host: 1, component: 1 });
    expect(report.perFile['packages/ui/src/Button.tsx']).toBeUndefined();
  });

  it('lets an exclude carve out of an include', () => {
    const report = analyzeFiltered(
      {
        'src/App.tsx': 'export const App = () => <div />',
        'src/debug/Panel.tsx': 'export const Panel = () => <div />',
        'other/Thing.tsx': 'export const Thing = () => <div />',
      },
      ['src/**'],
      ['src/debug/**']
    );
    expect(report.nodes.all).toBe(1);
    expect(report.perFile['src/App.tsx']).toBeDefined();
  });

  it('reports files as the number the census actually walked', () => {
    expect(analyzeFiltered(VENDORED, []).files).toBe(2);
    expect(analyzeFiltered(VENDORED, [], ['packages/ui/**']).files).toBe(1);
  });

  // ROOT is what the caller passed as projectDir, so this is the path you
  // would paste from a shell rather than the one the report prints.
  it('accepts an absolute glob inside the analyzed tree', () => {
    const report = analyzeFiltered(VENDORED, [], [`${ROOT}/packages/ui/**`]);
    expect(report.nodes).toMatchObject({ all: 2, host: 1, component: 1, unresolved: 0 });
    expect(report.components['packages/ui/src/Button.tsx#Button']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('refuses an absolute glob pointing outside the tree', () => {
    expect(() => analyzeFiltered(VENDORED, [], ['/elsewhere/**'])).toThrow(
      /outside the analyzed tree/
    );
  });

  // `*` stopping at a separator is the whole reason `**` exists, and getting
  // this backwards silently counts a nested directory you meant to drop.
  it('does not let a single * cross a directory boundary', () => {
    const nested = {
      'packages/ui/Flat.tsx': 'export const Flat = () => <div />',
      'packages/ui/deep/Nested.tsx': 'export const Nested = () => <div />',
    };
    expect(analyzeFiltered(nested, [], ['packages/ui/*']).nodes.all).toBe(1);
    expect(analyzeFiltered(nested, [], ['packages/ui/**']).nodes.all).toBe(0);
  });

  it('excludes a DS-consuming directory without losing its DS attribution elsewhere', () => {
    const report = analyzeFiltered(
      {
        'internal/Debug.tsx': [
          "import { Button } from '@ds/core'",
          'export const Debug = () => <Button />',
        ].join('\n'),
        'src/App.tsx': [
          "import { Button } from '@ds/core'",
          'export const App = () => <Button />',
        ].join('\n'),
      },
      [],
      ['internal/**']
    );
    expect(report.nodes).toMatchObject({ all: 1, ds: 1 });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.dsShareOfComponentNodes).toBe(1);
  });
});

describe('identification through the module graph', () => {
  it('classifies a direct DS import, a renamed one, and an external package', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Button } from '@ds/core'",
        "import { Input as Field } from '@ds/forms'",
        "import { Link } from 'react-router-dom'",
        'export const App = () => <main><Button /><Field /><Link to="/" /></main>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/forms#Input']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['react-router-dom#Link']).toEqual({
      category: 'external',
      count: 1,
      instances: 1,
    });
    expect(report.nodes).toMatchObject({ all: 4, host: 1, ds: 2, external: 1, unresolved: 0 });
  });

  it('follows named re-exports through a barrel file', () => {
    const report = analyze({
      'src/ui/index.ts': "export { Button as AppButton } from '@ds/core'",
      'src/App.tsx': [
        "import { AppButton } from './ui'",
        'export const App = () => <AppButton />',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('follows export * chains, into files and out to packages', () => {
    const report = analyze({
      'src/ui/local.ts': 'export const Card = () => null',
      'src/ui/buttons.ts': "export * from '@ds/buttons'",
      'src/ui/index.ts': ["export * from './local'", "export * from './buttons'"].join('\n'),
      'src/App.tsx': [
        "import { Button, Card } from './ui'",
        'export const App = () => <main><Button /><Card /></main>',
      ].join('\n'),
    });
    expect(report.components['@ds/buttons#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['src/ui/local.ts#Card']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.unresolved).toBe(0);
  });

  it('survives circular star re-exports and reports the name as unresolved', () => {
    const report = analyze({
      'src/a.ts': "export * from './b'",
      'src/b.ts': "export * from './a'",
      'src/App.tsx': ["import { Ghost } from './a'", 'export const App = () => <Ghost />'].join(
        '\n'
      ),
    });
    expect(report.nodes.unresolved).toBe(1);
    expect(report.unresolvedElements).toHaveLength(1);
  });

  it('resolves through a barrel cycle to a star target that provides the name', () => {
    // a <-> b star-cycle with the real provider listed after the cycling star:
    // legal ESM that Node resolves fine, and order must not matter.
    const files = (order: 'cycle-first' | 'provider-first') => ({
      'src/features/a/index.ts': "export * from '../b'",
      'src/features/b/index.ts':
        order === 'cycle-first'
          ? ["export * from '../a'", "export * from './Button'"].join('\n')
          : ["export * from './Button'", "export * from '../a'"].join('\n'),
      'src/features/b/Button.ts': "export { Button } from '@ds/core'",
      'src/App.tsx': [
        "import { Button } from './features/b'",
        'export const App = () => <Button />',
      ].join('\n'),
    });
    for (const order of ['cycle-first', 'provider-first'] as const) {
      const report = analyze(files(order));
      expect(report.components['@ds/core#Button'], order).toEqual({
        category: 'ds',
        count: 1,
        instances: 1,
      });
      expect(report.nodes.unresolved, order).toBe(0);
    }
  });

  it('does not serve a cycle placeholder to later, non-cyclic callers', () => {
    const report = analyze({
      'src/features/a/index.ts': "export * from '../b'",
      'src/features/b/index.ts': ["export * from '../a'", "export * from './Button'"].join('\n'),
      'src/features/b/Button.ts': "export { Button } from '@ds/core'",
      'src/SmallButton.tsx': [
        "import { Button } from './features/b'",
        'export const SmallButton = (props: object) => <Button size="small" {...props} />',
      ].join('\n'),
      'src/App.tsx': [
        "import { SmallButton } from './SmallButton'",
        'export const App = () => <SmallButton />',
      ].join('\n'),
    });
    // The subsetting wrapper still reaches the DS through the cyclic barrel,
    // statically. Weighted, only the wrapper's own body renders a real
    // Button; the use site is now a `local` SmallButton node.
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 2,
      instances: 1,
    });
  });

  it('resolves tsconfig path aliases through the graph', () => {
    const report = analyze({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } },
      }),
      'src/ui/index.ts': "export { Button } from '@ds/core'",
      'src/App.tsx': ["import { Button } from '@/ui'", 'export const App = () => <Button />'].join(
        '\n'
      ),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.unresolved).toBe(0);
  });

  it('credits the DS when an alias maps straight onto its package', () => {
    const report = analyze({
      'package.json': JSON.stringify({ dependencies: { '@ds/core': '^1.0.0' } }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/ds': ['@ds/core'] } } }),
      'src/App.tsx': ["import { Button } from '@/ds'", 'export const App = () => <Button />'].join(
        '\n'
      ),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.unresolved).toBe(0);
    expect(report.dsShareOfComponentNodes).toBe(1);
  });

  it('credits the DS when a subpath import maps onto its package', () => {
    const report = analyze({
      'package.json': JSON.stringify({
        dependencies: { '@ds/core': '^1.0.0' },
        imports: { '#ds': { browser: '@ds/core', default: '@ds/core' } },
      }),
      'src/App.tsx': ["import { Button } from '#ds'", 'export const App = () => <Button />'].join(
        '\n'
      ),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.unresolved).toBe(0);
  });

  it('reports alias-shaped specifiers without a mapping as unresolved, not external', () => {
    const report = analyze({
      'src/App.tsx': ["import { Button } from '@/ui'", 'export const App = () => <Button />'].join(
        '\n'
      ),
    });
    expect(report.nodes.unresolved).toBe(1);
    expect(report.nodes.external).toBe(0);
  });

  it('resolves extensionless specifiers in the order the bundler would (.ts before .tsx)', () => {
    const report = analyze({
      'src/b.ts': "export { Button } from '@ds/core'",
      'src/b.tsx': 'export const Button = () => <button />',
      'src/App.tsx': ["import { Button } from './b'", 'export const App = () => <Button />'].join(
        '\n'
      ),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('reports a name star re-exported from packages that disagree on DS-ness as unresolved', () => {
    const report = analyze({
      'src/ui/index.ts': ["export * from 'react-icons'", "export * from '@ds/icons'"].join('\n'),
      'src/App.tsx': [
        "import { GearIcon } from './ui'",
        'export const App = () => <GearIcon />',
      ].join('\n'),
    });
    expect(report.nodes.unresolved).toBe(1);
    expect(report.nodes.ds).toBe(0);
    expect(report.nodes.external).toBe(0);
  });

  it('resolves namespace imports member by member', () => {
    const report = analyze({
      'src/forms.ts': "export { Input } from '@ds/forms'",
      'src/App.tsx': [
        "import * as DS from '@ds/core'",
        "import * as Forms from './forms'",
        'export const App = () => <main><DS.Button /><Forms.Input /></main>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/forms#Input']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('keeps compound-component member tags on a DS import in the DS', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Dialog } from '@ds/core/dialog'",
        'export const App = () => <Dialog.Root><Dialog.Popup /></Dialog.Root>',
      ].join('\n'),
    });
    expect(report.components['@ds/core/dialog#Dialog.Root']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core/dialog#Dialog.Popup']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('resolves local compound components via property assignment', () => {
    const report = analyze({
      'src/Card.tsx': [
        "import { Header } from '@ds/core'",
        'export const Card = () => null',
        'Card.Header = Header',
      ].join('\n'),
      'src/App.tsx': [
        "import { Card } from './Card'",
        'export const App = () => <Card.Header />',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Header']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('resolves members of an exported object of components', () => {
    const report = analyze({
      'src/app-ui.ts': [
        "import { Button } from '@ds/core'",
        'export const AppUI = { Button, Plain: () => null }',
      ].join('\n'),
      'src/App.tsx': [
        "import { AppUI } from './app-ui'",
        'export const App = () => <main><AppUI.Button /><AppUI.Plain /></main>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.local).toBe(1);
  });
});

// Destructuring is aliased member access: `const { Root } = Checkbox` says
// exactly what `<Checkbox.Root>` says, so it resolves the same way — and
// degrades to `unresolved` wherever the value it reads from does.
describe('destructured bindings', () => {
  it('resolves a destructured DS namespace in a function scope', () => {
    const report = analyze(
      {
        'src/ExampleCheckbox.tsx': [
          "import { Checkbox } from '@base-ui/react/checkbox'",
          "import styles from './index.module.css'",
          'export default function ExampleCheckbox() {',
          '	const { Root, Indicator } = Checkbox',
          '	return (',
          '		<label className={styles.Label}>',
          '			<Root defaultChecked className={styles.Checkbox}>',
          '				<Indicator className={styles.Indicator} />',
          '			</Root>',
          '			Enable notifications',
          '		</label>',
          '	)',
          '}',
        ].join('\n'),
      },
      ['@base-ui/react']
    );
    expect(report.components['@base-ui/react/checkbox#Checkbox.Root']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@base-ui/react/checkbox#Checkbox.Indicator']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes).toMatchObject({ ds: 2, host: 1, unresolved: 0 });
  });

  it('resolves a module-scope destructuring, an alias, and a nested pattern', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox, Menu } from '@ds/core'",
        'const { Root, Indicator: Mark } = Checkbox',
        'const { Item: { Label } } = Menu',
        'export const App = () => <Root><Mark /><Label /></Root>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Checkbox.Root']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#Checkbox.Indicator']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#Menu.Item.Label']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('resolves a destructured namespace import and object literal', () => {
    const report = analyze({
      'src/app-ui.ts': [
        "import { Button } from '@ds/core'",
        'export const AppUI = { Button, Plain: () => null }',
      ].join('\n'),
      'src/App.tsx': [
        "import * as Forms from '@ds/forms'",
        "import { AppUI } from './app-ui'",
        'const { Input } = Forms',
        'const { Button, Plain } = AppUI',
        'export const App = () => <main><Input /><Button /><Plain /></main>',
      ].join('\n'),
    });
    expect(report.components['@ds/forms#Input']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.components['src/app-ui.ts#Plain']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('follows a destructured re-export through a barrel', () => {
    const report = analyze({
      'src/ui/index.ts': [
        "import { Checkbox } from '@ds/core'",
        'export const { Root } = Checkbox',
      ].join('\n'),
      'src/App.tsx': ["import { Root } from './ui'", 'export const App = () => <Root />'].join(
        '\n'
      ),
    });
    expect(report.components['@ds/core#Checkbox.Root']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('lets a locally attached member win over the destructured base identity', () => {
    const report = analyze({
      'src/Card.tsx': [
        "import { DS } from '@ds/core'",
        'export const { Card } = DS',
        'const Header = () => <header>h</header>',
        'Card.Header = Header',
      ].join('\n'),
      'src/App.tsx': [
        "import { Card } from './Card'",
        'export const App = () => <Card.Header />',
      ].join('\n'),
    });
    expect(report.components['src/Card.tsx#Header']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#DS.Card.Header']).toBeUndefined();
  });

  it('leaves rest, computed, array, defaulted, and loop bindings unresolved', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox, key, items } from '@ds/core'",
        'const { ...Rest } = Checkbox',
        'const { [key]: Computed } = Checkbox',
        'const [Positional] = Checkbox',
        'const { Defaulted = Checkbox } = Checkbox',
        'export const App = () => {',
        '	for (const { Item } of items) return <Item />',
        '	return <main><Rest /><Computed /><Positional /><Defaulted /></main>',
        '}',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 5 });
  });

  // A loop pattern has an attributable path but no initializer to read it
  // from. Referencing it from outside the loop is not valid JS, but it parses,
  // and the census walks whatever the tree contains.
  it('survives a loop pattern referenced outside the loop', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { items } from '@ds/core'",
        'export const App = () => {',
        '	for (const { Item } of items) { void Item }',
        '	return <Item />',
        '}',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 1 });
  });

  // Spelling the elements out must not widen where the binding is visible:
  // the loop scopes its own declaration, so a reference after the loop is
  // out of scope and stays unattributed.
  it('does not resolve a loop binding referenced outside the loop', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox } from '@ds/core'",
        'export const App = () => {',
        '\tfor (const { Root } of [Checkbox]) { void Root }',
        '\treturn <Root />',
        '}',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Checkbox.Root']).toBeUndefined();
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 1 });
  });

  // A `for…of` pattern binds an *element* of the iterated value, so the value
  // it reads is only knowable when the loop spells its elements out.
  it('resolves a loop binding over an array literal', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox } from '@ds/core'",
        'export const App = () => {',
        '	for (const { Root } of [Checkbox]) return <Root />',
        '	return null',
        '}',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Checkbox.Root']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes).toMatchObject({ ds: 1, unresolved: 0 });
  });

  it('resolves a loop binding when every element agrees on the identity', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox } from '@ds/core'",
        "import { Checkbox as Same } from '@ds/core'",
        'export const App = () => {',
        '	for (const { Root } of [Checkbox, Same]) return <Root />',
        '	return null',
        '}',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Checkbox.Root']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes).toMatchObject({ ds: 1, unresolved: 0 });
  });

  it('leaves a loop binding unresolved when the elements disagree', () => {
    // Each iteration would attribute `Root` to a different component, so no
    // single identity is true of the body.
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox, Menu } from '@ds/core'",
        'export const App = () => {',
        '	for (const { Root } of [Checkbox, Menu]) return <Root />',
        '	return null',
        '}',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 1 });
    expect(report.unresolvedElements[0]?.reason).toMatch(/disagree/);
  });

  it('leaves a loop binding over a spread or a non-literal iterable unresolved', () => {
    // Neither names its elements: reading `items.Item` off the iterable
    // would fabricate a component the package does not export.
    const report = analyze({
      'src/App.tsx': [
        "import { Checkbox, extra, items } from '@ds/core'",
        'export const App = () => {',
        '	for (const { Root } of [Checkbox, ...extra]) return <Root />',
        '	for (const { Item } of items) return <Item />',
        '	return null',
        '}',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 2 });
    expect(report.components['@ds/core#items.Item']).toBeUndefined();
    for (const element of report.unresolvedElements) {
      expect(element.reason).toMatch(/not statically known/);
    }
  });

  it('leaves a loop binding over an empty array unresolved', () => {
    const report = analyze({
      'src/App.tsx': [
        'export const App = () => {',
        '	for (const { Root } of []) return <Root />',
        '	return null',
        '}',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 1 });
    expect(report.unresolvedElements[0]?.reason).toMatch(/empty array/);
  });

  it('leaves a destructured prop and a destructured call result unresolved', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { useParts } from './parts'",
        'export const App = ({ slots }: { slots: { Icon: () => null } }) => {',
        '	const { Icon } = slots',
        '	const { Tooltip } = useParts()',
        '	return <main><Icon /><Tooltip /></main>',
        '}',
      ].join('\n'),
      'src/parts.ts': 'export const useParts = () => ({ Tooltip: () => null })',
    });
    expect(report.nodes).toMatchObject({ ds: 0, unresolved: 2 });
  });
});

describe('wrapper and styled attribution', () => {
  it('counts styled.div as its host element, not a component', () => {
    const report = analyze({
      'src/App.tsx': [
        "import styled from 'styled-components'",
        'const Box = styled.div`margin: 0`',
        'export const App = () => <Box />',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ all: 1, host: 1, component: 0 });
    expect(report.components.div).toEqual({ category: 'host', count: 1, instances: 1 });
  });

  // `styled('div')` is the same construction as `styled.div`, and the only
  // spelling for a tag the property form cannot express. Storybook's own
  // components are written this way throughout, so missing it left every one
  // of them unattributed.
  it("counts styled('div') as its host element, like the property form", () => {
    const report = analyze({
      'src/App.tsx': [
        "import styled from 'styled-components'",
        "const Box = styled('div')({ margin: 0 })",
        "const Custom = styled('my-element')`margin: 0`",
        'export const App = () => <main><Box /><Custom /></main>',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ all: 3, host: 3, component: 0, unresolved: 0 });
    expect(report.components.div).toEqual({ category: 'host', count: 1, instances: 1 });
    expect(report.components['my-element']).toEqual({ category: 'host', count: 1, instances: 1 });
  });

  it("counts styled('div') wrapped again as the same host element", () => {
    const report = analyze({
      'src/App.tsx': [
        "import styled from 'styled-components'",
        "const Base = styled('span')({ margin: 0 })",
        'const Bigger = styled(Base)({ fontSize: 20 })',
        'export const App = () => <Bigger />',
      ].join('\n'),
    });
    expect(report.components.span).toEqual({ category: 'host', count: 1, instances: 1 });
    expect(report.nodes).toMatchObject({ host: 1, unresolved: 0 });
  });

  it('counts styled(X) as X, through .attrs chains and generic double calls', () => {
    const report = analyze({
      'src/App.tsx': [
        "import styled, { css } from 'styled-components'",
        "import { Button, Dialog } from '@ds/core'",
        'const S1 = styled(Button)`margin: 0`',
        'const S2 = styled(Dialog.Popup).attrs({ tabIndex: 0 })`margin: 0`',
        'const S3 = styled(Button)<{ $big: boolean }>(({ $big }) => css`padding: ${$big ? 2 : 1}rem`)',
        'export const App = () => <main><S1 /><S2 /><S3 /></main>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 2,
      instances: 2,
    });
    expect(report.components['@ds/core#Dialog.Popup']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.ds).toBe(3);
  });

  it('counts styled(LocalComponent) as the local component', () => {
    const report = analyze({
      'src/Heading.tsx': 'export const Heading = () => <h1>hi</h1>',
      'src/App.tsx': [
        "import styled from 'styled-components'",
        "import { Heading } from './Heading'",
        'const Styled = styled(Heading)`margin: 0`',
        'export const App = () => <Styled />',
      ].join('\n'),
    });
    expect(report.components['src/Heading.tsx#Heading']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('counts a wrapper that merely subsets a DS component as that component', () => {
    const report = analyze({
      'src/SmallButton.tsx': [
        "import { Button } from '@ds/core'",
        'export const SmallButton = (props: object) => <Button size="small" {...props} />',
      ].join('\n'),
      'src/App.tsx': [
        "import { SmallButton } from './SmallButton'",
        'export const App = () => <SmallButton />',
      ].join('\n'),
    });
    // Both the wrapper's own render and the use site attribute to the DS,
    // statically. Weighted, the use site is now the wrapper's own instance
    // (a `local` node, credited to SmallButton's multiplier) rather than a
    // second DS node: only the wrapper's own body renders a real Button.
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 2,
      instances: 1,
    });
  });

  it('reaches the DS through nested wrappers', () => {
    const report = analyze({
      'src/buttons.tsx': [
        "import { Button } from '@ds/core'",
        'export const Small = (props: object) => <Button size="small" {...props} />',
        'export const SmallDanger = (props: object) => <Small tone="danger" {...props} />',
      ].join('\n'),
      'src/App.tsx': [
        "import { SmallDanger } from './buttons'",
        'export const App = () => <SmallDanger />',
      ].join('\n'),
    });
    // Statically, each wrapper level and the use site all attribute to the
    // DS. Weighted, only Small's own body renders a real Button — SmallDanger
    // and its use site are both `local` nodes now.
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 3,
      instances: 1,
    });
  });

  it('keeps a DS-rooted component local when it does not forward props', () => {
    // A page hard-coding its whole subtree under a DS Card is a composition,
    // not a subset of Card — no spread, no attribution to the DS.
    const report = analyze({
      'src/Dashboard.tsx': [
        "import { Card } from '@ds/core'",
        'export const Dashboard = () => (',
        '	<Card>',
        '		<div>content</div>',
        '	</Card>',
        ')',
      ].join('\n'),
      'src/App.tsx': [
        "import { Dashboard } from './Dashboard'",
        'export const App = () => <Dashboard />',
      ].join('\n'),
    });
    expect(report.components['src/Dashboard.tsx#Dashboard']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#Card']).toEqual({ category: 'ds', count: 1, instances: 1 });
  });

  it('keeps a prop-forwarding wrapper local when it hard-codes its children', () => {
    // The spread says "same props", but the hard-coded subtree says this is
    // content of the app's own, not the DS component with props fixed.
    const report = analyze({
      'src/Banner.tsx': [
        "import { Card } from '@ds/core'",
        'export const Banner = (props: object) => <Card {...props}>Welcome back!</Card>',
      ].join('\n'),
      'src/App.tsx': [
        "import { Banner } from './Banner'",
        'export const App = () => <Banner />',
      ].join('\n'),
    });
    expect(report.components['src/Banner.tsx#Banner']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#Card']).toEqual({ category: 'ds', count: 1, instances: 1 });
  });

  it('counts a prop-forwarding wrapper that passes children through as the DS component', () => {
    const report = analyze({
      'src/Panel.tsx': [
        "import { Card } from '@ds/core'",
        'export const Panel = ({ children, ...rest }: { children?: unknown }) => (',
        '	<Card padding="sm" {...rest}>{children}</Card>',
        ')',
      ].join('\n'),
      'src/App.tsx': [
        "import { Panel } from './Panel'",
        'export const App = () => <Panel>hi</Panel>',
      ].join('\n'),
    });
    // Weighted, only Panel's own body renders a real Card; the use site is
    // now a `local` Panel node instead of a second DS node.
    expect(report.components['@ds/core#Card']).toEqual({ category: 'ds', count: 2, instances: 1 });
  });

  it('counts a wrapper that forwards props.children through as the DS component', () => {
    const report = analyze({
      'src/Panel.tsx': [
        "import { Card } from '@ds/core'",
        'export const Panel = (props: { children?: unknown }) => (',
        '	<Card padding="sm" {...props}>{props.children}</Card>',
        ')',
      ].join('\n'),
      'src/App.tsx': [
        "import { Panel } from './Panel'",
        'export const App = () => <Panel>hi</Panel>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Card']).toEqual({ category: 'ds', count: 2, instances: 1 });
  });

  it('keeps a wrapper local when it decorates the forwarded children', () => {
    const report = analyze({
      'src/Panel.tsx': [
        "import { Card } from '@ds/core'",
        'export const Panel = ({ children, ...rest }: { children?: unknown }) => (',
        '	<Card {...rest}><header>Panel</header>{children}</Card>',
        ')',
      ].join('\n'),
      'src/App.tsx': [
        "import { Panel } from './Panel'",
        'export const App = () => <Panel>hi</Panel>',
      ].join('\n'),
    });
    expect(report.components['src/Panel.tsx#Panel']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('keeps a component with a bare-return guard local', () => {
    const report = analyze({
      'src/MaybeButton.tsx': [
        "import { Button } from '@ds/core'",
        'export const MaybeButton = (props: { show?: boolean }) => {',
        '	if (!props.show) return',
        '	return <Button {...props} />',
        '}',
      ].join('\n'),
      'src/App.tsx': [
        "import { MaybeButton } from './MaybeButton'",
        'export const App = () => <MaybeButton show />',
      ].join('\n'),
    });
    expect(report.components['src/MaybeButton.tsx#MaybeButton']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('lets a local compound member win over its base identity', () => {
    // Card resolves into the DS via the subsetting wrapper, but Card.Header
    // is a locally attached component — it must not become a fabricated DS
    // name like Box.Header.
    const report = analyze({
      'src/Card.tsx': [
        "import { Box } from '@ds/core'",
        'export const Card = (props: object) => <Box {...props} />',
        'const Header = () => <header>h</header>',
        'Card.Header = Header',
      ].join('\n'),
      'src/App.tsx': [
        "import { Card } from './Card'",
        'export const App = () => <Card.Header />',
      ].join('\n'),
    });
    expect(report.components['src/Card.tsx#Header']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.components['@ds/core#Box.Header']).toBeUndefined();
  });

  it('lets scope shadowing win over module imports', () => {
    const report = analyze({
      'src/Chart.tsx': [
        "import { Tooltip } from '@ds/core'",
        "import { useChartParts } from './parts'",
        'export const Chart = () => {',
        '	const { Tooltip } = useChartParts()',
        '	return <Tooltip />',
        '}',
        'export const Legend = () => <Tooltip />',
      ].join('\n'),
      'src/parts.ts': 'export const useChartParts = () => ({ Tooltip: () => null })',
    });
    // The destructured Tooltip is unresolvable; the module-scope one is DS.
    expect(report.nodes.unresolved).toBe(1);
    expect(report.components['@ds/core#Tooltip']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('resolves components declared inside a function scope', () => {
    const report = analyze({
      'src/App.tsx': [
        "import styled from 'styled-components'",
        "import { Button } from '@ds/core'",
        'export const App = () => {',
        '	const Inner = styled(Button)`margin: 0`',
        '	return <div><Inner /></div>',
        '}',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('follows withComponent to the replacement target', () => {
    const report = analyze({
      'src/App.tsx': [
        "import styled from 'styled-components'",
        "import { Button, Text } from '@ds/core'",
        "const AsAnchor = styled(Button)`margin: 0`.withComponent('a')",
        'const AsText = styled(Button)`margin: 0`.withComponent(Text)',
        'export const App = () => <main><AsAnchor /><AsText /></main>',
      ].join('\n'),
    });
    expect(report.components.a).toEqual({ category: 'host', count: 1, instances: 1 });
    expect(report.components['@ds/core#Text']).toEqual({ category: 'ds', count: 1, instances: 1 });
    expect(report.components['@ds/core#Button']).toBeUndefined();
  });

  it('recognizes a styled factory exported by the DS itself', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { styled, Button } from '@ds/core'",
        'const Fancy = styled(Button)`margin: 0`',
        'export const App = () => <Fancy />',
      ].join('\n'),
    });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
  });

  it('does not dissolve a page into its non-DS root', () => {
    const report = analyze({
      'src/Panel.tsx': [
        "import { Button } from '@ds/core'",
        'export const Panel = () => <div><Button /></div>',
      ].join('\n'),
      'src/App.tsx': ["import { Panel } from './Panel'", 'export const App = () => <Panel />'].join(
        '\n'
      ),
    });
    expect(report.components['src/Panel.tsx#Panel']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
    expect(report.nodes).toMatchObject({ ds: 1, local: 1, host: 1 });
  });

  it('keeps a component with multiple returns local even when one root is DS', () => {
    const report = analyze({
      'src/Maybe.tsx': [
        "import { Button } from '@ds/core'",
        'export const Maybe = ({ on }: { on: boolean }) => {',
        '	if (!on) return null',
        '	return <Button />',
        '}',
      ].join('\n'),
      'src/App.tsx': [
        "import { Maybe } from './Maybe'",
        'export const App = () => <Maybe on />',
      ].join('\n'),
    });
    expect(report.components['src/Maybe.tsx#Maybe']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('looks through memo and forwardRef', () => {
    const report = analyze({
      'src/Fancy.tsx': [
        "import { forwardRef, memo } from 'react'",
        "import { Button } from '@ds/core'",
        'export const Fancy = memo(forwardRef((props: object, ref) => <Button ref={ref} {...props} />))',
      ].join('\n'),
      'src/App.tsx': ["import { Fancy } from './Fancy'", 'export const App = () => <Fancy />'].join(
        '\n'
      ),
    });
    // Weighted, only Fancy's own body renders a real Button; the use site is
    // now a `local` Fancy node.
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 2,
      instances: 1,
    });
  });

  it('resolves lazy(() => import(...)) to the target default export', () => {
    const report = analyze({
      'src/Home.tsx': 'export default function Home() { return <div /> }',
      'src/App.tsx': [
        "import { lazy } from 'react'",
        "const Home = lazy(() => import('./Home'))",
        'export const App = () => <Home />',
      ].join('\n'),
    });
    expect(report.components['src/Home.tsx#Home']).toEqual({
      category: 'local',
      count: 1,
      instances: 1,
    });
  });

  it('classifies createGlobalStyle in both forms as its package, not unresolved', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { createGlobalStyle, css } from 'styled-components'",
        'const GlobalStyle = createGlobalStyle`body { margin: 0 }`',
        'const OtherStyle = createGlobalStyle(css`body { margin: 0 }`)',
        'export const App = () => <main><GlobalStyle /><OtherStyle /></main>',
      ].join('\n'),
    });
    expect(report.components['styled-components#createGlobalStyle']).toEqual({
      category: 'external',
      count: 2,
      instances: 2,
    });
    expect(report.nodes.unresolved).toBe(0);
  });

  it('reports unknown HOC factories as unresolved rather than guessing', () => {
    const report = analyze({
      'src/Connected.tsx': [
        "import { connect } from 'react-redux'",
        "import { Button } from '@ds/core'",
        'export const Connected = connect()(Button)',
      ].join('\n'),
      'src/App.tsx': [
        "import { Connected } from './Connected'",
        'export const App = () => <Connected />',
      ].join('\n'),
    });
    expect(report.nodes.unresolved).toBe(1);
    expect(report.unresolvedElements[0]).toMatchObject({ file: 'src/App.tsx', tag: 'Connected' });
  });
});

describe('census weights and coverage', () => {
  it('computes both shares over weighted nodes', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Button } from '@ds/core'",
        'export const App = () => (',
        '	<div>',
        '		<Button>hi</Button>',
        '		<span>text</span>',
        '	</div>',
        ')',
      ].join('\n'),
    });
    expect(report.nodes).toEqual({
      all: 3,
      host: 2,
      component: 1,
      ds: 1,
      external: 0,
      local: 0,
      unresolved: 0,
    });
    expect(report.dsShareOfAllNodes).toBe(0.3333);
    expect(report.dsShareOfComponentNodes).toBe(1);
  });

  it('counts children element by element with no inheritance from the parent', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Card } from '@ds/core'",
        'export const App = () => <Card><div><span /></div></Card>',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ all: 3, ds: 1, host: 2 });
  });

  it('gives full weight against falsy and literal alternatives, half against JSX', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Button, Spinner } from '@ds/core'",
        'export const App = ({ on }: { on: boolean }) => (',
        '	<div>',
        '		{on ? <Button /> : null}',
        "		{on ? <Button /> : 'loading'}",
        '		{on ? <Button /> : 42}',
        '		{on && <Button />}',
        '		{on ? <Button /> : <Spinner />}',
        '	</div>',
        ')',
      ].join('\n'),
    });
    // 4 full-weight Buttons + one half-weight Button and half-weight Spinner.
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 4.5,
      instances: 4.5,
    });
    expect(report.components['@ds/core#Spinner']).toEqual({
      category: 'ds',
      count: 0.5,
      instances: 0.5,
    });
    expect(report.nodes.all).toBe(6);
  });

  it('halves again for nested conditionals', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { A, B, C } from '@ds/core'",
        'export const App = ({ x, y }: { x: boolean; y: boolean }) => (',
        '	<div>{x ? <A /> : y ? <B /> : <C />}</div>',
        ')',
      ].join('\n'),
    });
    expect(report.components['@ds/core#A']).toEqual({ category: 'ds', count: 0.5, instances: 0.5 });
    expect(report.components['@ds/core#B']).toEqual({
      category: 'ds',
      count: 0.25,
      instances: 0.25,
    });
    expect(report.components['@ds/core#C']).toEqual({
      category: 'ds',
      count: 0.25,
      instances: 0.25,
    });
  });

  it('weights whole subtrees on each side of a conditional', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Button } from '@ds/core'",
        'export const App = ({ on }: { on: boolean }) => (',
        '	<div>{on ? <section><Button /></section> : <p>empty</p>}</div>',
        ')',
      ].join('\n'),
    });
    expect(report.nodes.all).toBe(2.5); // div + (section .5 + Button .5) + p .5
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 0.5,
      instances: 0.5,
    });
  });

  it('counts JSX passed through props', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Route } from 'react-router-dom'",
        "import { Button } from '@ds/core'",
        'export const App = () => <Route element={<Button />} />',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ external: 1, ds: 1, all: 2 });
  });

  it('halves both sides of a logical chain when each contains JSX', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { A, B } from '@ds/core'",
        'export const App = ({ on }: { on: boolean }) => <div>{(on && <A />) || <B />}</div>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#A']).toEqual({ category: 'ds', count: 0.5, instances: 0.5 });
    expect(report.components['@ds/core#B']).toEqual({ category: 'ds', count: 0.5, instances: 0.5 });
  });

  it('treats a named-Fragment alternative like its <> spelling', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Fragment } from 'react'",
        "import { A, B } from '@ds/core'",
        'export const App = ({ on }: { on: boolean }) => (',
        '	<div>',
        '		{on ? <A /> : <Fragment />}',
        '		{on ? <A /> : <Fragment><B /></Fragment>}',
        '	</div>',
        ')',
      ].join('\n'),
    });
    // An empty Fragment renders nothing (full weight, like `: null`); one
    // with an element inside is a real subtree (halved, like `: <B/>`).
    expect(report.components['@ds/core#A']).toEqual({ category: 'ds', count: 1.5, instances: 1.5 });
    expect(report.components['@ds/core#B']).toEqual({ category: 'ds', count: 0.5, instances: 0.5 });
  });

  it('ignores fragments in both syntaxes', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Fragment } from 'react'",
        'export const App = () => (',
        '	<>',
        '		<Fragment><div /></Fragment>',
        '	</>',
        ')',
      ].join('\n'),
    });
    expect(report.nodes).toEqual({
      all: 1,
      host: 1,
      component: 0,
      ds: 0,
      external: 0,
      local: 0,
      unresolved: 0,
    });
  });

  // A context Provider renders only its children, exactly like a Fragment.
  // Counted, it would pad the component total with elements no design system
  // could ever have supplied, quietly depressing the DS share.
  it('ignores a context Provider and Consumer', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { createContext } from 'react'",
        "import { Button } from '@ds/core'",
        'const Ctx = createContext(null)',
        'export const App = () => (',
        '	<Ctx.Provider value={null}>',
        '		<Ctx.Consumer>{() => <Button />}</Ctx.Consumer>',
        '	</Ctx.Provider>',
        ')',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ all: 1, component: 1, ds: 1, unresolved: 0 });
    expect(report.dsShareOfComponentNodes).toBe(1);
  });

  // The context object is reached through a file boundary here, so this also
  // pins that the identity survives a re-export rather than only working when
  // createContext sits in the rendering file.
  it('ignores a context Provider imported from another module', () => {
    const report = analyze({
      'src/ctx.ts': [
        "import { createContext } from 'react'",
        'export const Ctx = createContext(null)',
      ].join('\n'),
      'src/App.tsx': [
        "import { Ctx } from './ctx'",
        "import { Button } from '@ds/core'",
        'export const App = () => <Ctx.Provider value={null}><Button /></Ctx.Provider>',
      ].join('\n'),
    });
    expect(report.nodes).toMatchObject({ all: 1, ds: 1, unresolved: 0 });
  });

  // A design system's own ThemeProvider is a real exported component, not a
  // member of a createContext result, and must keep counting.
  it('still counts a design system’s own Provider component', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { ThemeProvider, Button } from '@ds/core'",
        'export const App = () => <ThemeProvider><Button /></ThemeProvider>',
      ].join('\n'),
    });
    expect(report.components['@ds/core#ThemeProvider']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes).toMatchObject({ all: 2, ds: 2, unresolved: 0 });
  });

  it('ignores raw createElement calls', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { createElement } from 'react'",
        "import { Button } from '@ds/core'",
        "export const App = () => createElement(Button, null, 'hi')",
      ].join('\n'),
    });
    expect(report.nodes.all).toBe(0);
    expect(report.dsShareOfAllNodes).toBeNull();
    expect(report.dsShareOfComponentNodes).toBeNull();
  });

  it('reports components passed as props as unresolved, with location', () => {
    const report = analyze({
      'src/App.tsx': ['export const Slot = ({ as: As }: { as: React.ElementType }) => <As />'].join(
        '\n'
      ),
    });
    expect(report.nodes.unresolved).toBe(1);
    expect(report.unresolvedElements[0]).toMatchObject({
      file: 'src/App.tsx',
      line: 1,
      tag: 'As',
      weight: 1,
    });
  });

  it('summarizes per file for spot validation', () => {
    const report = analyze({
      'src/a.tsx': "import { B } from '@ds/core'\nexport const A = () => <B />",
      'src/b.tsx': 'export const C = () => <div />',
      'src/no-jsx.ts': 'export const n = 1',
    });
    expect(Object.keys(report.perFile).sort()).toEqual(['src/a.tsx', 'src/b.tsx']);
    expect(report.perFile['src/a.tsx']).toMatchObject({ all: 1, ds: 1 });
    expect(report.perFile['src/b.tsx']).toMatchObject({ all: 1, host: 1 });
  });

  it('orders per-component attribution by weight', () => {
    const report = analyze({
      'src/App.tsx': [
        "import { Button } from '@ds/core'",
        'export const App = () => <div><Button /><Button /><span /></div>',
      ].join('\n'),
    });
    expect(Object.keys(report.components)).toEqual(['@ds/core#Button', 'div', 'span']);
  });
});

describe('includeNodes', () => {
  const FILES = {
    'src/App.tsx': [
      "import { Button } from '@ds/react'",
      'export const App = () => <div><Button /></div>',
    ].join('\n'),
  };

  // Absent, not `undefined`: the report is a contract callers read fields off,
  // and a key that exists holding nothing invites a truthiness check where the
  // question is presence.
  it('omits the nodeList key entirely when not asked', () => {
    vol.fromJSON(FILES, ROOT);
    const report = analyzeDsCoverage({ projectDir: ROOT, dsPackages: ['@ds/*'] });
    expect('nodeList' in report).toBe(false);
  });

  // The other spelling of "no", and the one that actually ships: a CLI flag
  // defaulting to false passes it explicitly rather than omitting the option.
  it('omits the nodeList key when includeNodes is explicitly false', () => {
    vol.fromJSON(FILES, ROOT);
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: false,
    });
    expect('nodeList' in report).toBe(false);
  });

  // The wrapping `div` is not itself a record — hosts are not a DS decision —
  // but it still names a segment of the path: the path describes where the node
  // sits in the source, not which of its ancestors were worth judging.
  it('emits one record per counted component element when asked', () => {
    vol.fromJSON(FILES, ROOT);
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
    });
    expect(report.nodeList).toEqual([
      {
        path: 'App/div[0]/Button[0]',
        file: 'src/App.tsx',
        line: 2,
        tag: 'Button',
        category: 'ds',
        module: '@ds/react',
        name: 'Button',
        weight: 1,
        props: [],
      },
    ]);
  });

  it('omits host and unresolved elements', () => {
    vol.fromJSON(
      {
        'src/App.tsx': [
          "import { Button } from '@ds/react'",
          "import Mystery from './missing'",
          'export const App = () => <div><Button /><Mystery /></div>',
        ].join('\n'),
      },
      ROOT
    );
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
    });
    expect(report.nodeList?.map((node) => node.tag)).toEqual(['Button']);
    expect(report.unresolvedElements.map((element) => element.tag)).toEqual(['Mystery']);
  });

  // The `#n` suffix counts calls to the path builder, so it is only meaningful
  // against the traversal that actually feeds it. node-path's own tests drive it
  // from a walk over every JSX element; the census feeds it a strict subset, so
  // the collision behaviour is pinned here too, against the real caller.
  //
  // Two further things are deliberate. The weights are fractional: both branches
  // of the ternary render JSX, so each side halves, and this is the only place a
  // fraction is asserted to survive into a record the judge reads. And the paths
  // are `App/Button[0]`, not `App/div[0]/Button[0]` — the ternary sits in a JSX
  // expression container, which is the first limitation documented in the header
  // of react/node-path.ts: a chain does not pass through a non-JSX node.
  it('numbers colliding paths by the order the census records them', () => {
    vol.fromJSON(
      {
        'src/App.tsx': [
          "import { Button } from '@ds/react'",
          'export const App = ({ ok }) => <div>{ok ? <Button /> : <Button />}</div>',
        ].join('\n'),
      },
      ROOT
    );
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
    });
    expect(report.nodeList?.map((node) => [node.path, node.weight])).toEqual([
      ['App/Button[0]', 0.5],
      ['App/Button[0]#2', 0.5],
    ]);
  });

  // censusInclude is how the judge keeps its treatment-side census small: the
  // graph is still whole, so imports resolve, but only touched files are listed.
  it('lists only files the census counts', () => {
    vol.fromJSON(
      {
        'src/Kept.tsx': "import { Button } from '@ds/react'\nexport const Kept = () => <Button />",
        'src/Skipped.tsx':
          "import { Button } from '@ds/react'\nexport const Skipped = () => <Button />",
      },
      ROOT
    );
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
      censusInclude: ['src/Kept.tsx'],
    });
    expect(report.nodeList?.map((node) => node.file)).toEqual(['src/Kept.tsx']);
  });

  // Restricting the census must subset the node list, never rewrite it: the
  // judge pairs a narrowed treatment census against a whole-tree baseline, and
  // any path that shifts between the two reads as a node that moved when
  // nothing did.
  //
  // All three files declare the same component name on purpose, which is what
  // gives this test teeth. Paths are only file-scoped because the builder is
  // built per file; hoisting it to census scope is the tempting simplification,
  // and with per-file declaration names it would be undetectable. Here it is
  // caught: a shared builder numbers Kept's pair `#2`/`#3` behind the skipped
  // file's `App/Button[0]`, so dropping that file from the census would shift
  // Kept's paths — the phantom move this whole scheme exists to avoid.
  it('gives a restricted census the same paths as the whole-tree one', () => {
    const files = {
      'src/Before.tsx': "import { Button } from '@ds/react'\nexport const App = () => <Button />",
      'src/Kept.tsx': [
        "import { Button } from '@ds/react'",
        'export const App = ({ ok }) => <div><Button />{ok ? <Button /> : <Button />}</div>',
      ].join('\n'),
      'src/Zed.tsx': "import { Button } from '@ds/react'\nexport const App = () => <Button />",
    };
    vol.fromJSON(files, ROOT);
    const whole = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
    });
    const restricted = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
      censusInclude: ['src/Kept.tsx'],
    });

    const keptFromWhole = whole.nodeList?.filter((node) => node.file === 'src/Kept.tsx');
    expect(restricted.nodeList).toEqual(keptFromWhole);
    // Pinned literally so that two identical regressions cannot pass as agreement.
    // No `#n` above `#2` here: the numbering restarts per file.
    expect(keptFromWhole?.map((node) => node.path)).toEqual([
      'App/div[0]/Button[0]',
      'App/Button[0]',
      'App/Button[0]#2',
    ]);
  });
});

describe('instance weighting', () => {
  it('counts JSX inside a reused component once per instantiation', () => {
    const report = analyze({
      'src/Button.tsx': [
        "import { DSButton } from '@ds/button'",
        'export const LocalButton = () => <div><DSButton /></div>',
      ].join('\n'),
      'src/App.tsx': [
        "import { LocalButton } from './Button'",
        'export const App = () => <main><LocalButton /><LocalButton /><LocalButton /></main>',
      ].join('\n'),
    });
    // Static counting is untouched: three usage sites, one body.
    expect(report.nodes).toMatchObject({ all: 6, host: 2, ds: 1, local: 3 });
    // Instances: LocalButton's body renders once per usage.
    expect(report.instances.nodes).toEqual({
      all: 10,
      host: 4,
      component: 6,
      ds: 3,
      external: 0,
      local: 3,
      unresolved: 0,
    });
    expect(report.instances.dsShareOfAllNodes).toBe(0.3);
    expect(report.instances.multipliers).toEqual({ 'src/Button.tsx#LocalButton': 3 });
    expect(report.components['@ds/button#DSButton']).toEqual({
      category: 'ds',
      count: 1,
      instances: 3,
    });
  });

  it('collects usage edges from files the census filter excludes', () => {
    vol.fromJSON(
      {
        'src/Button.tsx': [
          "import { DSButton } from '@ds/button'",
          'export const LocalButton = () => <div><DSButton /></div>',
        ].join('\n'),
        'src/App.tsx': [
          "import { LocalButton } from './Button'",
          'export const App = () => <main><LocalButton /><LocalButton /><LocalButton /></main>',
        ].join('\n'),
      },
      ROOT
    );
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      censusInclude: ['src/Button.tsx'],
    });
    // Only Button.tsx is counted, but its multiplier is a whole-app fact.
    expect(report.nodes).toMatchObject({ all: 2, host: 1, ds: 1 });
    expect(report.instances.nodes).toMatchObject({ all: 6, host: 3, ds: 3 });
  });

  it('keeps the floor of 1 for components nothing uses', () => {
    const report = analyze({
      'src/Unused.tsx': [
        "import { DSButton } from '@ds/button'",
        'export const Unused = () => <DSButton />',
      ].join('\n'),
    });
    expect(report.instances.nodes).toEqual(report.nodes);
    expect(report.instances.multipliers).toEqual({});
  });

  it('composes multipliers through a chain', () => {
    const report = analyze({
      'src/B.tsx': "import { DSButton } from '@ds/button'\nexport const B = () => <DSButton />",
      'src/A.tsx': "import { B } from './B'\nexport const A = () => <section><B /><B /></section>",
      'src/Page.tsx': "import { A } from './A'\nexport const Page = () => <><A /><A /></>",
    });
    expect(report.instances.multipliers).toEqual({ 'src/B.tsx#B': 4, 'src/A.tsx#A': 2 });
    expect(report.instances.nodes.ds).toBe(4);
  });

  it('sums usage from several owners', () => {
    const report = analyze({
      'src/Shared.tsx':
        "import { DSButton } from '@ds/button'\nexport const Shared = () => <DSButton />",
      'src/Widget.tsx':
        "import { Shared } from './Shared'\nexport const Widget = () => <div><Shared /></div>",
      'src/Page.tsx': [
        "import { Shared } from './Shared'",
        "import { Widget } from './Widget'",
        'export const Page = () => <main><Shared /><Widget /></main>',
      ].join('\n'),
    });
    expect(report.instances.multipliers).toEqual({ 'src/Shared.tsx#Shared': 2 });
    expect(report.instances.nodes.ds).toBe(2);
  });

  it('keeps a self-recursive component finite, counted at its external usage', () => {
    const report = analyze({
      'src/Tree.tsx': 'export const Tree = () => <li><Tree /></li>',
      'src/Page.tsx': [
        "import { Tree } from './Tree'",
        'export const Page = () => <ul><Tree /><Tree /><Tree /></ul>',
      ].join('\n'),
    });
    expect(report.instances.multipliers).toEqual({ 'src/Tree.tsx#Tree': 3 });
    // Three page sites ×1 plus the recursive site ×3.
    expect(report.instances.nodes.local).toBe(6);
    expect(report.instances.nodes.host).toBe(1 + 3);
  });

  it('shares the entering usage across mutual recursion', () => {
    const report = analyze({
      'src/AB.tsx': [
        "import { DSButton } from '@ds/button'",
        'export const A = () => <div><B /></div>',
        'export const B = () => <span><A /><DSButton /></span>',
      ].join('\n'),
      'src/Page.tsx': "import { A } from './AB'\nexport const Page = () => <><A /><A /></>",
    });
    expect(report.instances.multipliers).toEqual({ 'src/AB.tsx#A': 2, 'src/AB.tsx#B': 2 });
    expect(report.instances.nodes.ds).toBe(2);
  });

  it('propagates conditional halving into multipliers', () => {
    const report = analyze({
      'src/Button.tsx':
        "import { DSButton } from '@ds/button'\nexport const LocalButton = () => <DSButton />",
      'src/App.tsx': [
        "import { LocalButton } from './Button'",
        'export const App = ({ x }) => x ? <LocalButton /> : <section />',
      ].join('\n'),
    });
    expect(report.instances.multipliers).toEqual({ 'src/Button.tsx#LocalButton': 0.5 });
    expect(report.instances.nodes.ds).toBe(0.5);
  });

  it('multiplies a compound component by its member usage', () => {
    const report = analyze({
      'src/Card.tsx': [
        "import { DSBox } from '@ds/box'",
        'export const Card = () => <div />',
        'Card.Header = () => <DSBox />',
      ].join('\n'),
      'src/App.tsx': [
        "import { Card } from './Card'",
        'export const App = () => <main><Card.Header /><Card.Header /></main>',
      ].join('\n'),
    });
    expect(report.instances.multipliers).toEqual({ 'src/Card.tsx#Header': 2 });
    expect(report.instances.nodes.ds).toBe(2);
    // Card itself is never rendered: its body keeps the floor of 1.
    expect(report.components['div']).toEqual({ category: 'host', count: 1, instances: 1 });
  });

  it('projects a member access through a subsetting wrapper onto the DS member', () => {
    const report = analyze({
      'src/Branded.tsx': [
        "import { Card } from '@ds/core'",
        'export const Branded = (props) => <Card {...props} />',
      ].join('\n'),
      'src/App.tsx': [
        "import { Branded } from './Branded'",
        'export const App = () => <main><Branded.Header /></main>',
      ].join('\n'),
    });
    // No `Branded.Header = …` assignment sits beside the declaration, so this
    // falls past the compound-component check into the wrapped-ds member
    // case: it resolves onto the DS member it subsets, never `unresolved`.
    expect(report.components['@ds/core#Card.Header']).toEqual({
      category: 'ds',
      count: 1,
      instances: 1,
    });
    expect(report.nodes.unresolved).toBe(0);
    // The member access resolves straight to `ds`, not `wrapped-ds`, so it
    // behaves like any other ds member access: no edge into Branded's own
    // bucket, and instances stay consistent with statics.
    expect(report.instances.multipliers).toEqual({});
  });

  it('does not double-count children passed through a local component', () => {
    const report = analyze({
      'src/Card.tsx': 'export const Card = ({ children }) => <div>{children}</div>',
      'src/App.tsx': [
        "import { DSButton } from '@ds/button'",
        "import { Card } from './Card'",
        'export const App = () => <Card><DSButton /></Card>',
      ].join('\n'),
    });
    // The child is App's markup, counted once; only Card's own div multiplies.
    expect(report.instances.nodes.ds).toBe(1);
  });

  it('multiplies a subsetting wrapper through its own usage sites, statics unchanged', () => {
    const report = analyze({
      'src/Branded.tsx': [
        "import { DSButton } from '@ds/button'",
        'export const Branded = (props) => <DSButton {...props} />',
      ].join('\n'),
      'src/App.tsx': [
        "import { Branded } from './Branded'",
        'export const App = () => <main><Branded /><Branded /></main>',
      ].join('\n'),
    });
    // Static: unchanged from a plain `ds` resolution — every usage of
    // Branded is its own ds node (2), plus the wrapper's own DSButton (1).
    expect(report.nodes).toEqual({
      all: 4,
      host: 1,
      component: 3,
      ds: 3,
      external: 0,
      local: 0,
      unresolved: 0,
    });
    // Weighted: each `<Branded/>` usage now feeds Branded's own owner
    // bucket as a `local` edge — the wrapper is used twice, so its
    // multiplier is 2, not the floor of 1 a subsetting wrapper without
    // this fix would keep. The two use sites themselves count as `local`
    // nodes (2); only the wrapper's own DSButton, multiplied, counts `ds`.
    expect(report.instances.multipliers).toEqual({ 'src/Branded.tsx#Branded': 2 });
    expect(report.instances.nodes).toEqual({
      all: 5,
      host: 1,
      component: 4,
      ds: 2,
      external: 0,
      local: 2,
      unresolved: 0,
    });
  });

  it('gives a subsetting wrapper its usage-derived multiplier, and its local slot child inherits it', () => {
    // The PageTemplate/Footer shape: a subsetting wrapper (forwards props to
    // a single DS root) that also hardcodes a local component into one of
    // that root's own props. Before this fix, PageTemplate collapsed
    // straight to the DS identity, so no usage edge ever reached its own
    // owner bucket — its multiplier floored at 1, and Footer floored with
    // it despite PageTemplate being used 3 times.
    const report = analyze({
      'src/Footer.tsx': 'export const Footer = () => <footer>f</footer>',
      'src/PageTemplate.tsx': [
        "import { DSPage } from '@ds/page'",
        "import { Footer } from './Footer'",
        'export const PageTemplate = (props) => <DSPage {...props} footer={<Footer />} />',
      ].join('\n'),
      'src/App.tsx': [
        "import { PageTemplate } from './PageTemplate'",
        'export const App = () => (',
        '	<main>',
        '		<PageTemplate />',
        '		<PageTemplate />',
        '		<PageTemplate />',
        '	</main>',
        ')',
      ].join('\n'),
    });
    // Static: PageTemplate collapses to the DS identity at each of its 3
    // usages plus its own declaration (4); the footer slot resolves to the
    // local Footer, counted once, exactly at its syntactic site.
    expect(report.components['@ds/page#DSPage']).toEqual({
      category: 'ds',
      count: 4,
      instances: 3,
    });
    expect(report.components['src/Footer.tsx#Footer']).toEqual({
      category: 'local',
      count: 1,
      instances: 3,
    });
    // Weighted: PageTemplate's 3 usages now feed its own owner bucket, so
    // its multiplier is usage-derived (3), not floored at 1 — and Footer,
    // rooted in that same bucket, inherits the identical multiplier.
    expect(report.instances.multipliers).toEqual({
      'src/PageTemplate.tsx#PageTemplate': 3,
      'src/Footer.tsx#Footer': 3,
    });
    // The wrapper's own inner DS node (DSPage, counted once statically at
    // PageTemplate's declaration) carries the wrapper's multiplier: 1 × 3.
    expect(report.instances.nodes.ds).toBe(3);
    expect(report.instances.nodes).toEqual({
      all: 13,
      host: 4,
      component: 9,
      ds: 3,
      external: 0,
      local: 6,
      unresolved: 0,
    });
  });

  it('composes a wrapper multiplier through an already-multiplied caller', () => {
    const report = analyze({
      'src/Branded.tsx': [
        "import { DSButton } from '@ds/button'",
        'export const Branded = (props) => <DSButton {...props} />',
      ].join('\n'),
      'src/Row.tsx': [
        "import { Branded } from './Branded'",
        'export const Row = () => <div><Branded /><Branded /></div>',
      ].join('\n'),
      'src/App.tsx': [
        "import { Row } from './Row'",
        'export const App = () => <main><Row /><Row /><Row /></main>',
      ].join('\n'),
    });
    // Row (used 3x) multiplies Branded (used 2x per Row): the wrapper's
    // multiplier composes the two chained usage counts, not just its own
    // immediate call count.
    expect(report.instances.multipliers).toEqual({
      'src/Row.tsx#Row': 3,
      'src/Branded.tsx#Branded': 6,
    });
    // Branded's own DSButton, counted once statically, carries the full
    // composed multiplier.
    expect(report.instances.nodes.ds).toBe(6);
  });

  it('roots an entry-point render call at multiplier 1', () => {
    const report = analyze({
      'src/App.tsx': "import { DSButton } from '@ds/button'\nexport const App = () => <DSButton />",
      'src/main.tsx': "import { App } from './App'\nrender(<App />)",
    });
    // The loose <App /> sits in main.tsx's module bucket, itself a root.
    expect(report.instances.multipliers).toEqual({});
    expect(report.instances.nodes.ds).toBe(1);
  });

  it('multiplies through a default-exported component', () => {
    const report = analyze({
      'src/page.tsx': [
        "import { DSButton } from '@ds/button'",
        'export default function Page() { return <DSButton /> }',
      ].join('\n'),
      'src/App.tsx': "import Page from './page'\nexport const App = () => <><Page /><Page /></>",
    });
    expect(report.instances.multipliers).toEqual({ 'src/page.tsx#Page': 2 });
    expect(report.instances.nodes.ds).toBe(2);
  });

  it('attributes a function-scoped component to its enclosing declaration', () => {
    const report = analyze({
      'src/Page.tsx': [
        "import { DSButton } from '@ds/button'",
        'export const Page = () => { const Inner = () => <DSButton />; return <div><Inner /><Inner /></div> }',
      ].join('\n'),
    });
    // Inner is not a *top-level* declaration, so ownerName() cannot give it a
    // bucket of its own: DSButton is attributed to Page and counts once, at
    // Page's multiplier (the point of this scenario). The <Inner/> tags
    // themselves still resolve normally to `local` — resolveScopedName
    // analyzes function-scope declarations like any other, exactly as
    // 'resolves components declared inside a function scope' above already
    // pins — so they are not unresolved.
    expect(report.instances.nodes.ds).toBe(1);
    expect(report.instances.nodes.local).toBe(2);
    expect(report.instances.nodes.unresolved).toBe(0);
  });

  it('weights the component share but keeps node records unweighted', () => {
    vol.fromJSON(
      {
        'src/Button.tsx': [
          "import { DSButton } from '@ds/button'",
          'export const LocalButton = () => <div><DSButton /></div>',
        ].join('\n'),
        'src/App.tsx': [
          "import { LocalButton } from './Button'",
          'export const App = () => <main><LocalButton /><LocalButton /><LocalButton /></main>',
        ].join('\n'),
      },
      ROOT
    );
    const report = analyzeDsCoverage({
      projectDir: ROOT,
      dsPackages: ['@ds/*'],
      includeNodes: true,
    });
    // ds instances = 3 of 6 component instances.
    expect(report.instances.dsShareOfComponentNodes).toBe(0.5);
    // The record stays one-per-source-element with no instance figure: the
    // ds-misuse judge reads records, and weighting belongs to the aggregates.
    const dsRecord = report.nodeList?.find((record) => record.name === 'DSButton');
    expect(dsRecord).toMatchObject({ weight: 1 });
    expect(dsRecord).not.toHaveProperty('instances');
    expect(report.nodeList).toHaveLength(4);
  });

  it('weights unresolved elements by the owner multiplier', () => {
    const report = analyze({
      'src/Box.tsx': 'export const Box = ({ as: As }) => <As />',
      'src/App.tsx': [
        "import { Box } from './Box'",
        'export const App = () => <main><Box /><Box /></main>',
      ].join('\n'),
    });
    const unresolved = report.unresolvedElements.find((element) => element.tag === 'As');
    expect(unresolved).toMatchObject({ weight: 1, instances: 2 });
  });
});

// One app, both metrics, side by side — the scenario that motivates instance
// weighting. A DS-built card is reused across a listing page while a one-off
// settings page is mostly hand-rolled markup; a subsetting wrapper sits in
// between. The static census sees one copy of everything; the weighted census
// multiplies each component's body by how often it is instantiated, so the
// reused DS-heavy card pulls the weighted share up — and the wrapper's call
// site, `ds` statically, counts as `local` weighted because the DS node inside
// the wrapper's body already carries its multiplier.
describe('weighted vs unweighted coverage (integration)', () => {
  const APP = {
    // DS-heavy and reused: 3 DS nodes, instantiated 4×.
    'src/ProductCard.tsx': [
      "import { Card, Badge, Button } from '@ds/core'",
      'export const ProductCard = () => (',
      '	<Card>',
      '		<Badge />',
      '		<Button />',
      '	</Card>',
      ')',
    ].join('\n'),
    // A subsetting wrapper: statically it IS the DS Button; weighted, its
    // call sites are its own local nodes.
    'src/SaveButton.tsx': [
      "import { Button } from '@ds/core'",
      'export const SaveButton = (props: object) => <Button tone="primary" {...props} />',
    ].join('\n'),
    'src/Catalog.tsx': [
      "import { ProductCard } from './ProductCard'",
      'export const Catalog = () => (',
      '	<main>',
      '		<ProductCard />',
      '		<ProductCard />',
      '		<ProductCard />',
      '		<ProductCard />',
      '	</main>',
      ')',
    ].join('\n'),
    // One-off and host-heavy: rendered once, so weighting cannot inflate it.
    'src/Settings.tsx': [
      "import { SaveButton } from './SaveButton'",
      'export const Settings = () => (',
      '	<form>',
      '		<fieldset>',
      '			<legend />',
      '			<input />',
      '			<input />',
      '		</fieldset>',
      '		<SaveButton />',
      '	</form>',
      ')',
    ].join('\n'),
  };

  it('the same tree reads 5/9 DS statically and 13/18 weighted', () => {
    const report = analyze(APP);

    // Static: every source element once. ds 5 = ProductCard's body (3)
    // + SaveButton's body (1) + SaveButton's call site (wrapped-ds → ds).
    // local 4 = the <ProductCard /> call sites.
    expect(report.nodes).toEqual({
      all: 15,
      host: 6,
      component: 9,
      ds: 5,
      external: 0,
      local: 4,
      unresolved: 0,
    });
    expect(report.dsShareOfComponentNodes).toBe(0.5556); // 5/9, rounded

    // Weighted: ProductCard's body counts once per instantiation (×4),
    // so ds 13 = 3×4 + SaveButton's body (1); local 5 = the four
    // <ProductCard /> call sites + the <SaveButton /> call site, which
    // flipped from ds to local.
    expect(report.instances.multipliers).toEqual({ 'src/ProductCard.tsx#ProductCard': 4 });
    expect(report.instances.nodes).toEqual({
      all: 24,
      host: 6,
      component: 18,
      ds: 13,
      external: 0,
      local: 5,
      unresolved: 0,
    });
    expect(report.instances.dsShareOfComponentNodes).toBe(0.7222); // 13/18, rounded

    // The divergence is the point: reuse concentrated in DS-built
    // components means true adoption is higher than the file-by-file read.
    expect(report.instances.dsShareOfComponentNodes).toBeGreaterThan(
      report.dsShareOfComponentNodes ?? 0
    );

    // Per-identity view of the same split: Card appears once in source but
    // renders 4×. Button is written 3× (ProductCard's body, SaveButton's
    // body, the wrapper call site); weighted, the reused body carries ×4,
    // the wrapper body ×1, and the call site moved to SaveButton's own
    // local identity — 5, not 3 and not 8.
    expect(report.components['@ds/core#Card']).toEqual({ category: 'ds', count: 1, instances: 4 });
    expect(report.components['@ds/core#Button']).toEqual({
      category: 'ds',
      count: 3,
      instances: 5,
    });
  });
});

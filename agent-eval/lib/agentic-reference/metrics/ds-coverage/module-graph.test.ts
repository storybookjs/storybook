import { vol } from 'memfs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildModuleGraph } from './module-graph.ts';

// The graph only ever reads, so an in-memory tree serves it as well as a real
// one — and a fixed root cannot collide between parallel test files the way a
// shared tmpdir can.
vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return { ...memfs.fs, default: memfs.fs };
});

const root = '/project';

/** Lays down a fresh project tree, replacing whatever the last test wrote. */
function tree(files: Record<string, string>): string {
  vol.reset();
  vol.fromJSON(files, root);
  return root;
}

afterEach(() => {
  vol.reset();
});

describe('buildModuleGraph', () => {
  it('collects script files and skips tests, stories, and dependencies', () => {
    const dir = tree({
      'src/App.tsx': 'export const App = () => null',
      'src/App.test.tsx': 'export {}',
      'src/App.stories.tsx': 'export {}',
      'src/__tests__/helper.ts': 'export {}',
      'node_modules/x/index.js': 'module.exports = 1',
      'src/logo.svg': '<svg/>',
    });
    const graph = buildModuleGraph(dir);
    expect([...graph.files.keys()]).toEqual(['src/App.tsx']);
  });

  it('records parse failures instead of dropping the file silently', () => {
    const dir = tree({ 'src/broken.ts': 'const = = =' });
    const graph = buildModuleGraph(dir);
    expect(graph.parseFailures).toEqual(['src/broken.ts']);
    expect(graph.files.has('src/broken.ts')).toBe(false);
  });

  it('extracts default, named, renamed, and namespace imports', () => {
    const dir = tree({
      'src/a.tsx': [
        "import styled, { css as c } from 'styled-components'",
        "import * as React from 'react'",
        "import { Button } from './Button'",
      ].join('\n'),
      'src/Button.tsx': 'export const Button = () => null',
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.locals.get('styled')).toEqual({
      type: 'import',
      from: 'styled-components',
      name: 'default',
    });
    expect(file?.locals.get('c')).toEqual({
      type: 'import',
      from: 'styled-components',
      name: 'css',
    });
    expect(file?.locals.get('React')).toEqual({ type: 'namespaceImport', from: 'react' });
    expect(file?.locals.get('Button')).toEqual({
      type: 'import',
      from: './Button',
      name: 'Button',
    });
  });

  it('ignores type-only imports', () => {
    const dir = tree({
      'src/a.ts': ["import type { A } from './b'", "import { type B, C } from './b'"].join('\n'),
      'src/b.ts': 'export const A = 1, B = 2, C = 3',
    });
    const file = buildModuleGraph(dir).files.get('src/a.ts');
    expect(file?.locals.has('A')).toBe(false);
    expect(file?.locals.has('B')).toBe(false);
    expect(file?.locals.get('C')).toEqual({ type: 'import', from: './b', name: 'C' });
  });

  it('extracts local declarations and their export status', () => {
    const dir = tree({
      'src/a.tsx': [
        'export const One = () => null',
        'const Two = () => null',
        'export default function Three() { return null }',
        'export class Four {}',
      ].join('\n'),
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.locals.get('One')?.type).toBe('declaration');
    expect(file?.locals.get('Two')?.type).toBe('declaration');
    expect(file?.exports.get('One')).toEqual({ type: 'local', name: 'One' });
    expect(file?.exports.has('Two')).toBe(false);
    expect(file?.exports.get('default')).toEqual({ type: 'local', name: 'Three' });
    expect(file?.exports.get('Four')).toEqual({ type: 'local', name: 'Four' });
  });

  it('binds destructured names to their property path into the initializer', () => {
    const dir = tree({
      'src/a.tsx': [
        "import { Checkbox } from '@ds/core'",
        'const { Root, Indicator } = Checkbox',
      ].join('\n'),
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.locals.get('Root')).toMatchObject({ type: 'destructured', path: ['Root'] });
    expect(file?.locals.get('Indicator')).toMatchObject({
      type: 'destructured',
      path: ['Indicator'],
    });
  });

  it('walks nested patterns and reads through aliases', () => {
    const dir = tree({
      'src/a.tsx': ["import { Lib } from '@ds/core'", 'const { Checkbox: { Root: R } } = Lib'].join(
        '\n'
      ),
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.locals.get('R')).toMatchObject({
      type: 'destructured',
      path: ['Checkbox', 'Root'],
    });
    expect(file?.locals.has('Root')).toBe(false);
  });

  it('leaves rest, computed, array, and defaulted names unbound', () => {
    const dir = tree({
      'src/a.tsx': [
        "import { Lib, key } from '@ds/core'",
        'const { Root, ...rest } = Lib',
        'const { [key]: Computed } = Lib',
        'const [First] = Lib',
        'const { Fallback = Root } = Lib',
      ].join('\n'),
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.locals.get('Root')).toMatchObject({ type: 'destructured', path: ['Root'] });
    for (const name of ['rest', 'Computed', 'First', 'Fallback']) {
      expect(file?.locals.has(name)).toBe(false);
    }
  });

  // An unbound name still has to be listed, or asking this file for it would
  // fall through the star chain and come back as `@ds/core`'s export.
  it('exports every destructured name, attributable or not', () => {
    const dir = tree({
      'src/a.tsx': [
        "export * from '@ds/core'",
        "import { Lib } from '@ds/other'",
        'export const { Button, ...rest } = Lib',
      ].join('\n'),
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.exports.get('Button')).toEqual({ type: 'local', name: 'Button' });
    expect(file?.exports.get('rest')).toEqual({ type: 'local', name: 'rest' });
  });

  it('extracts re-exports, star exports, and namespace re-exports', () => {
    const dir = tree({
      'src/index.ts': [
        "export { Button, Input as Field } from './forms'",
        "export * from './Button'",
        "export * as icons from './icons'",
        "export { default as Header } from './Header'",
      ].join('\n'),
      'src/forms.tsx': 'export const Button = 1, Input = 2',
      'src/Button.tsx': 'export const Button = () => null',
      'src/icons.tsx': 'export const Star = () => null',
      'src/Header.tsx': 'export default function Header() { return null }',
    });
    const file = buildModuleGraph(dir).files.get('src/index.ts');
    expect(file?.exports.get('Button')).toEqual({
      type: 'reexport',
      from: './forms',
      name: 'Button',
    });
    expect(file?.exports.get('Field')).toEqual({
      type: 'reexport',
      from: './forms',
      name: 'Input',
    });
    expect(file?.exports.get('icons')).toEqual({ type: 'namespaceReexport', from: './icons' });
    expect(file?.exports.get('Header')).toEqual({
      type: 'reexport',
      from: './Header',
      name: 'default',
    });
    expect(file?.starReexports).toEqual(['./Button']);
  });

  it('records export { X } of a local binding and export default <identifier>', () => {
    const dir = tree({
      'src/a.tsx': ['const Card = () => null', 'export { Card }', 'export default Card'].join('\n'),
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.exports.get('Card')).toEqual({ type: 'local', name: 'Card' });
    expect(file?.exports.get('default')).toEqual({ type: 'local', name: 'Card' });
  });

  it('returns an empty graph for a root that does not exist', () => {
    tree({ 'src/a.tsx': 'export const A = 1' });
    const graph = buildModuleGraph('/no-such-project');
    expect(graph.files.size).toBe(0);
    expect(graph.parseFailures).toEqual([]);
  });

  it('records unreadable files instead of dropping them silently', () => {
    const dir = tree({ 'src/App.tsx': 'export const App = () => null' });
    // A dangling symlink is listed by the directory walk but throws on read.
    vol.symlinkSync('/project/src/nowhere.tsx', '/project/src/Dangling.tsx');
    const graph = buildModuleGraph(dir);
    expect(graph.readFailures).toEqual(['src/Dangling.tsx']);
    expect(graph.files.has('src/Dangling.tsx')).toBe(false);
  });

  it('ignores type-only export declarations and inline type specifiers', () => {
    const dir = tree({
      'src/index.ts': ["export type { A } from './b'", "export { type B, C } from './b'"].join(
        '\n'
      ),
      'src/b.ts': 'export const A = 1, B = 2, C = 3',
    });
    const file = buildModuleGraph(dir).files.get('src/index.ts');
    expect(file?.exports.has('A')).toBe(false);
    expect(file?.exports.has('B')).toBe(false);
    expect(file?.exports.get('C')).toEqual({ type: 'reexport', from: './b', name: 'C' });
  });

  it('gives an anonymous default function a local slot to point at', () => {
    const dir = tree({ 'src/a.tsx': 'export default function () { return null }' });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.exports.get('default')).toEqual({ type: 'local', name: 'default' });
    expect(file?.locals.get('default')?.type).toBe('declaration');
  });

  it('records a non-identifier default export as an expression', () => {
    const dir = tree({ 'src/a.tsx': 'export default () => null' });
    const binding = buildModuleGraph(dir).files.get('src/a.tsx')?.exports.get('default');
    expect(binding?.type).toBe('expression');
  });

  it('skips array holes and leaves array-destructured names unattributed', () => {
    const dir = tree({
      'src/a.tsx': ["import { pair } from './p'", 'export const [, Second] = pair'].join('\n'),
      'src/p.ts': 'export const pair = [1, 2]',
    });
    const file = buildModuleGraph(dir).files.get('src/a.tsx');
    expect(file?.exports.get('Second')).toEqual({ type: 'local', name: 'Second' });
    // An array position names no property, so there is no origin to carry.
    expect(file?.locals.has('Second')).toBe(false);
  });

  it('records module-scope property assignments for compound components', () => {
    const dir = tree({
      'src/Card.tsx': [
        'export const Card = () => null',
        'const Header = () => null',
        'Card.Header = Header',
      ].join('\n'),
    });
    const file = buildModuleGraph(dir).files.get('src/Card.tsx');
    expect(file?.propertyAssignments.has('Card.Header')).toBe(true);
  });
});

describe('resolveSpecifier', () => {
  it('resolves relative specifiers with extension and index guessing', () => {
    const dir = tree({
      'src/a.tsx': "import { B } from './b'",
      'src/b.tsx': 'export const B = 1',
      'src/c.tsx': "import { D } from './d'",
      'src/d/index.ts': 'export const D = 1',
    });
    const graph = buildModuleGraph(dir);
    expect(graph.resolveSpecifier('src/a.tsx', './b')).toEqual({ type: 'file', path: 'src/b.tsx' });
    expect(graph.resolveSpecifier('src/c.tsx', './d')).toEqual({
      type: 'file',
      path: 'src/d/index.ts',
    });
  });

  it('resolves ESM-style .js specifiers to their .ts sources', () => {
    const dir = tree({
      'src/a.ts': "import { B } from './b.js'",
      'src/b.ts': 'export const B = 1',
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.ts', './b.js')).toEqual({
      type: 'file',
      path: 'src/b.ts',
    });
  });

  it('resolves parent-directory traversal', () => {
    const dir = tree({
      'src/pages/Home.tsx': "import { Button } from '../components/Button'",
      'src/components/Button.tsx': 'export const Button = 1',
    });
    expect(
      buildModuleGraph(dir).resolveSpecifier('src/pages/Home.tsx', '../components/Button')
    ).toEqual({ type: 'file', path: 'src/components/Button.tsx' });
  });

  it('classifies bare specifiers as packages', () => {
    const dir = tree({ 'src/a.tsx': "import { B } from '@base-ui/react/button'" });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@base-ui/react/button')).toEqual({
      type: 'package',
      specifier: '@base-ui/react/button',
    });
  });

  it('reports unresolvable relative specifiers as missing', () => {
    const dir = tree({ 'src/a.tsx': "import ladies from './ladies.svg'" });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', './ladies.svg')).toEqual({
      type: 'missing',
      specifier: './ladies.svg',
    });
  });
});

describe('resolveSpecifier: what cannot be a package name', () => {
  it('rejects a root-alias specifier no mapping claimed', () => {
    const dir = tree({ 'src/a.tsx': "import { Button } from '~/components/Button'" });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '~/components/Button')).toEqual({
      type: 'missing',
      specifier: '~/components/Button',
    });
  });

  it('rejects an absolute specifier and an empty scope', () => {
    const dir = tree({ 'src/a.tsx': 'export const A = 1' });
    const graph = buildModuleGraph(dir);
    expect(graph.resolveSpecifier('src/a.tsx', '/ui/Button')).toEqual({
      type: 'missing',
      specifier: '/ui/Button',
    });
    expect(graph.resolveSpecifier('src/a.tsx', '@/ui')).toEqual({
      type: 'missing',
      specifier: '@/ui',
    });
  });

  it('allows a bare tilde name, which npm would accept, through as a package', () => {
    const dir = tree({ 'src/a.tsx': "import { B } from '~tilde-pkg'" });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '~tilde-pkg')).toEqual({
      type: 'package',
      specifier: '~tilde-pkg',
    });
  });
});

describe('resolveSpecifier: aliases that name packages', () => {
  it('resolves an alias target under node_modules to the package it names', () => {
    const dir = tree({
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@/ds': ['node_modules/@droppy/design-system'] },
        },
      }),
      'src/a.tsx': "import { Button } from '@/ds'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@/ds')).toEqual({
      type: 'package',
      specifier: '@droppy/design-system',
    });
  });

  it('resolves an alias target naming a dependency to that package', () => {
    const dir = tree({
      'package.json': JSON.stringify({ dependencies: { '@droppy/design-system': '^1.0.0' } }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@/ds': ['@droppy/design-system'] } },
      }),
      'src/a.tsx': "import { Button } from '@/ds'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@/ds')).toEqual({
      type: 'package',
      specifier: '@droppy/design-system',
    });
  });

  it('carries the captured subpath into the package specifier', () => {
    const dir = tree({
      'package.json': JSON.stringify({ dependencies: { '@droppy/design-system': '^1.0.0' } }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@/ds/*': ['@droppy/design-system/*'] } },
      }),
      'src/a.tsx': "import { Button } from '@/ds/button'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@/ds/button')).toEqual({
      type: 'package',
      specifier: '@droppy/design-system/button',
    });
  });

  it('prefers a resolvable file target over a package target listed before it', () => {
    const dir = tree({
      'package.json': JSON.stringify({ dependencies: { '@droppy/design-system': '^1.0.0' } }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@/ds': ['@droppy/design-system', 'src/ds-shim'] } },
      }),
      'src/ds-shim.tsx': "export { Button } from '@droppy/design-system'",
      'src/a.tsx': "import { Button } from '@/ds'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@/ds')).toEqual({
      type: 'file',
      path: 'src/ds-shim.tsx',
    });
  });

  it('leaves an alias target that names neither a file nor a dependency unresolved', () => {
    const dir = tree({
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
      'src/a.tsx': "import { Button } from '@/gone'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@/gone')).toEqual({
      type: 'missing',
      specifier: '@/gone',
    });
  });

  it('treats a declared alias prefix as authoritative when nothing it maps to resolves', () => {
    const dir = tree({
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { 'lib/*': ['src/lib/*'] } } }),
      'src/lib/Real.tsx': 'export const Real = () => null',
      'src/a.tsx': "import { Gone } from 'lib/Gone'",
    });
    const graph = buildModuleGraph(dir);
    expect(graph.resolveSpecifier('src/a.tsx', 'lib/Real')).toEqual({
      type: 'file',
      path: 'src/lib/Real.tsx',
    });
    // `lib/` is the tree's own word for "local", so an unresolved `lib/Gone` is
    // a broken local import — not a package named `lib`.
    expect(graph.resolveSpecifier('src/a.tsx', 'lib/Gone')).toEqual({
      type: 'missing',
      specifier: 'lib/Gone',
    });
  });

  it('still classifies real packages under a catch-all alias', () => {
    const dir = tree({
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
      'tsconfig.json': JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '*': ['src/*'] } },
      }),
      'src/a.tsx': "import * as React from 'react'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', 'react')).toEqual({
      type: 'package',
      specifier: 'react',
    });
  });
});

describe('resolveSpecifier: config the tree may get wrong', () => {
  it('ignores a paths key carrying more than one wildcard', () => {
    const dir = tree({
      'tsconfig.json': JSON.stringify({
        // Two `*` is invalid in tsconfig. Read as one, this would half-match
        // as prefix `lib/` + suffix `.svg` and capture `icons/Star`.
        compilerOptions: { paths: { 'lib/*.svg*': ['src/*.tsx'], 'lib/*': ['src/lib/*'] } },
      }),
      'src/icons/Star.tsx': 'export const Star = () => null',
      'src/a.tsx': "import { Star } from 'lib/icons/Star.svg'",
    });
    // Only the well-formed `lib/*` entry may apply, and it maps nowhere.
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', 'lib/icons/Star.svg')).toEqual({
      type: 'missing',
      specifier: 'lib/icons/Star.svg',
    });
  });

  it('ignores a paths entry whose targets are not an array', () => {
    const dir = tree({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { 'lib/*': 'src/lib/*', '@/*': ['src/*'] } },
      }),
      'src/ui.tsx': 'export const Button = () => null',
      'src/a.tsx': "import { Button } from '@/ui'",
    });
    const graph = buildModuleGraph(dir);
    expect(graph.resolveSpecifier('src/a.tsx', '@/ui')).toEqual({
      type: 'file',
      path: 'src/ui.tsx',
    });
    expect(graph.resolveSpecifier('src/a.tsx', 'lib/thing')).toEqual({
      type: 'package',
      specifier: 'lib/thing',
    });
  });

  it('matches an alias pattern that has a suffix as well as a prefix', () => {
    const dir = tree({
      'tsconfig.json': JSON.stringify({
        compilerOptions: { paths: { '@icons/*.svg': ['src/icons/*.tsx'] } },
      }),
      'src/icons/Star.tsx': 'export const Star = () => null',
      'src/a.tsx': "import { Star } from '@icons/Star.svg'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@icons/Star.svg')).toEqual({
      type: 'file',
      path: 'src/icons/Star.tsx',
    });
  });

  it('resolves root-relative specifiers through a bare baseUrl', () => {
    const dir = tree({
      'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.' } }),
      'src/ui/Button.tsx': 'export const Button = () => null',
      'src/a.tsx': "import { Button } from 'src/ui/Button'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', 'src/ui/Button')).toEqual({
      type: 'file',
      path: 'src/ui/Button.tsx',
    });
  });

  it('tolerates a malformed package.json by treating the tree as declaring nothing', () => {
    const dir = tree({
      'package.json': '{ this is not json',
      'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/ds': ['@ds/core'] } } }),
      'src/a.tsx': "import { Button } from '@/ds'",
    });
    // With no readable manifest the alias target has no corroboration, so it
    // stays unproven rather than being invented as a package.
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '@/ds')).toEqual({
      type: 'missing',
      specifier: '@/ds',
    });
  });

  it('rejects specifiers npm naming rules forbid outright', () => {
    const dir = tree({ 'src/a.tsx': 'export const A = 1' });
    const graph = buildModuleGraph(dir);
    expect(graph.resolveSpecifier('src/a.tsx', '_private/Button')).toEqual({
      type: 'missing',
      specifier: '_private/Button',
    });
    expect(graph.resolveSpecifier('src/a.tsx', '@scope/')).toEqual({
      type: 'missing',
      specifier: '@scope/',
    });
  });
});

describe('resolveSpecifier: subpath imports', () => {
  it('resolves a subpath import to the package its entry names', () => {
    const dir = tree({
      'package.json': JSON.stringify({ imports: { '#ds': '@droppy/design-system' } }),
      'src/a.tsx': "import { Button } from '#ds'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '#ds')).toEqual({
      type: 'package',
      specifier: '@droppy/design-system',
    });
  });

  it('resolves a wildcard subpath import to a file in the tree', () => {
    const dir = tree({
      'package.json': JSON.stringify({ imports: { '#ui/*': './src/ui/*.tsx' } }),
      'src/ui/Button.tsx': 'export const Button = () => null',
      'src/a.tsx': "import { Button } from '#ui/Button'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '#ui/Button')).toEqual({
      type: 'file',
      path: 'src/ui/Button.tsx',
    });
  });

  it('takes the branch of a conditional subpath import that names a file in the tree', () => {
    const dir = tree({
      'package.json': JSON.stringify({
        imports: { '#dep': { node: 'dep-node-native', default: './src/polyfill.tsx' } },
      }),
      'src/polyfill.tsx': 'export const Button = () => null',
      'src/a.tsx': "import { Button } from '#dep'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '#dep')).toEqual({
      type: 'file',
      path: 'src/polyfill.tsx',
    });
  });

  it('tries the entries of a fallback array in order', () => {
    const dir = tree({
      'package.json': JSON.stringify({
        imports: { '#dep': ['./src/missing.tsx', './src/real.tsx'] },
      }),
      'src/real.tsx': 'export const Button = () => null',
      'src/a.tsx': "import { Button } from '#dep'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '#dep')).toEqual({
      type: 'file',
      path: 'src/real.tsx',
    });
  });

  it('treats a blocked entry as unresolvable rather than as a target', () => {
    const dir = tree({
      'package.json': JSON.stringify({ imports: { '#dep': null } }),
      'src/a.tsx': "import { Button } from '#dep'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '#dep')).toEqual({
      type: 'missing',
      specifier: '#dep',
    });
  });

  it('reports a subpath import with no matching entry as missing', () => {
    const dir = tree({
      'package.json': JSON.stringify({ imports: { '#ds': '@droppy/design-system' } }),
      'src/a.tsx': "import { Button } from '#gone'",
    });
    expect(buildModuleGraph(dir).resolveSpecifier('src/a.tsx', '#gone')).toEqual({
      type: 'missing',
      specifier: '#gone',
    });
  });
});

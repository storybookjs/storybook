import { loadCsf } from 'storybook/internal/csf-tools';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ResolvedMetaComponent } from 'storybook/internal/common';
import { createMetaComponentResolver } from 'storybook/internal/common';
import { resolveStoryComponent } from './resolve-component.ts';

const resolveMetaComponent = createMetaComponentResolver();

// Module resolution reads the real filesystem, so the modules the story sources import are real
// files rather than a memfs volume.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const storyPath = join(fixtures, 'button.stories.ts');

const parse = (source: string) => loadCsf(source, { makeTitle: () => 'Button' }).parse();

describe('resolveMetaComponent', () => {
  const resolvedCases: [name: string, source: string, expected: ResolvedMetaComponent][] = [
    [
      'a named import',
      `import { ButtonComponent } from './button.component';
       export default { component: ButtonComponent };`,
      {
        localName: 'ButtonComponent',
        importId: './button.component',
        exportName: 'ButtonComponent',
        path: join(fixtures, 'button.component.ts'),
      },
    ],
    [
      // `meta.component` reads `Btn`; Compodoc keys the entry on `ButtonComponent`.
      'the exported name behind an import alias',
      `import { ButtonComponent as Btn } from './button.component';
       export default { component: Btn };`,
      {
        localName: 'Btn',
        importId: './button.component',
        exportName: 'ButtonComponent',
        path: join(fixtures, 'button.component.ts'),
      },
    ],
    [
      'a default import, whose class name the story file never mentions',
      `import Button from './default-button.component';
       export default { component: Button };`,
      {
        localName: 'Button',
        importId: './default-button.component',
        exportName: 'default',
        path: join(fixtures, 'default-button.component.ts'),
      },
    ],
    [
      // Angular projects alias their own sources as a matter of course; the resolver's
      // `tsconfig: 'auto'` is what makes this work.
      'an import through a tsconfig paths alias',
      `import { AliasedButtonComponent } from '@ui/aliased-button.component';
       export default { component: AliasedButtonComponent };`,
      {
        localName: 'AliasedButtonComponent',
        importId: '@ui/aliased-button.component',
        exportName: 'AliasedButtonComponent',
        path: join(fixtures, 'aliased', 'aliased-button.component.ts'),
      },
    ],
    [
      // Compodoc never scans a component declared in a story file, but the story file is still
      // where it lives, and saying so is what lets the caller explain the miss.
      'a component declared in the story file, located at the story file',
      `class ButtonComponent {}
       export default { component: ButtonComponent };`,
      { localName: 'ButtonComponent', exportName: 'ButtonComponent', path: storyPath },
    ],
    [
      'a component whose module does not exist, with no path to match on',
      `import { ButtonComponent } from './nope.component';
       export default { component: ButtonComponent };`,
      {
        localName: 'ButtonComponent',
        importId: './nope.component',
        exportName: 'ButtonComponent',
        path: undefined,
      },
    ],
  ];

  it.each(resolvedCases)('resolves %s', (_name, source, expected) => {
    expect(resolveMetaComponent(parse(source), storyPath)).toEqual({ component: expected });
  });

  const unresolvedCases: [name: string, source: string, reason: string][] = [
    [
      'a file that declares no meta.component',
      `export default { title: 'Button' };`,
      'no-meta-component',
    ],
    [
      'a type-only import, which binds no class Compodoc could document',
      `import type { ButtonComponent } from './button.component';
       export default { component: ButtonComponent };`,
      'no-component-import',
    ],
    [
      'a namespace import',
      `import * as ButtonComponent from './button.component';
       export default { component: ButtonComponent };`,
      'no-component-import',
    ],
  ];

  it.each(unresolvedCases)('reports %s', (_name, source, reason) => {
    expect(resolveMetaComponent(parse(source), storyPath)).toEqual({ reason });
  });
});

describe('resolveStoryComponent', () => {
  it('parses the story file off disk', () => {
    expect(resolveStoryComponent(storyPath)).toEqual({
      component: {
        localName: 'ButtonComponent',
        importId: './button.component',
        exportName: 'ButtonComponent',
        path: join(fixtures, 'button.component.ts'),
      },
    });
  });

  it('reports no component for a file that cannot be read', () => {
    expect(resolveStoryComponent(join(fixtures, 'missing.stories.ts'))).toEqual({
      reason: 'no-meta-component',
    });
  });
});

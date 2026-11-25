import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseReferenceModule } from '../../csf-tools/story-shape/reference-context.ts';
import { jsTsSourceExtensions } from '../../shared/constants/extensions.ts';
import { type ExportReader, followExport } from './follow-export.ts';
import { createModuleResolver } from './module-resolver.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const BARREL = join(FIXTURES, 'barrel');
const BUTTON = join(FIXTURES, 'button.component.ts');

const reader: ExportReader = {
  resolver: createModuleResolver({ extensions: [...jsTsSourceExtensions] }),
};

describe('followExport', () => {
  it('follows a re-export to the declaration it comes from', () => {
    expect(followExport(reader, join(BARREL, 'ui', 'index.ts'), 'Button')).toEqual({
      kind: 'declaration',
      filePath: BUTTON,
      exportName: 'ButtonComponent',
      localName: 'ButtonComponent',
    });
  });

  it('reports a namespace export with the module that writes its specifier', () => {
    expect(followExport(reader, join(BARREL, 'index.ts'), 'Forwarded')).toEqual({
      kind: 'namespace',
      importId: './ui',
      importer: join(BARREL, 'forwarded.ts'),
      path: join(BARREL, 'ui', 'index.ts'),
    });
  });

  it('follows a default export that names an import', () => {
    expect(followExport(reader, join(BARREL, 'default-export.ts'), 'default')).toEqual({
      kind: 'declaration',
      filePath: BUTTON,
      exportName: 'ButtonComponent',
      localName: 'ButtonComponent',
    });
  });

  it('reports a name an `export *` cycle leads back to as missing', () => {
    expect(followExport(reader, join(BARREL, 'cycle-a.ts'), 'Button')).toEqual({ kind: 'missing' });
  });

  it('reports a name no module on the way exports as missing', () => {
    expect(followExport(reader, join(BARREL, 'index.ts'), 'Nope')).toEqual({ kind: 'missing' });
  });

  it('follows a default export of a local constant to the constant', () => {
    expect(followExport(reader, join(BARREL, 'default-renamed.ts'), 'Button')).toEqual({
      kind: 'declaration',
      filePath: join(BARREL, 'default-const.ts'),
      exportName: 'default',
      localName: 'Impl',
    });
  });

  it('reads each module through the reader, and stops at an export the reader says a file owns', () => {
    const read: string[] = [];
    const origin = followExport(
      {
        ...reader,
        readModule: (filePath) => {
          read.push(filePath);
          return parseReferenceModule(filePath);
        },
        ownsExport: (filePath, exportName) =>
          filePath === join(BARREL, 'ui', 'index.ts') && exportName === 'Button',
      },
      join(BARREL, 'forwarded.ts'),
      'Forwarded'
    );
    expect(origin).toMatchObject({ kind: 'namespace', path: join(BARREL, 'ui', 'index.ts') });
    expect(read).toEqual([join(BARREL, 'forwarded.ts')]);

    expect(
      followExport(
        { ...reader, ownsExport: (filePath) => filePath === join(BARREL, 'ui', 'index.ts') },
        join(BARREL, 'ui', 'index.ts'),
        'Button'
      )
    ).toEqual({
      kind: 'declaration',
      filePath: join(BARREL, 'ui', 'index.ts'),
      exportName: 'Button',
      localName: 'Button',
    });
  });
});

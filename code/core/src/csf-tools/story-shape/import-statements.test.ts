import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import {
  type ImportRef,
  buildImportStatements,
  resolveComponentImport,
} from './import-statements.ts';
import { collectImportBindings } from './imports.ts';

const bindingsOf = (code: string) =>
  collectImportBindings(loadCsf(code, { makeTitle: (title) => title ?? 'title' }).program);

const resolve = (code: string, componentName: string) =>
  resolveComponentImport(componentName, bindingsOf(code));

const statementsFor = (
  code: string,
  componentNames: string[],
  packageName?: string,
  options?: { isPackage?: boolean }
) => {
  const bindings = bindingsOf(code);
  return buildImportStatements({
    refs: componentNames.map((name) => ({
      ...resolveComponentImport(name, bindings),
      ...(options?.isPackage === undefined ? {} : { isPackage: options.isPackage }),
    })),
    packageName,
  });
};

describe('resolveComponentImport', () => {
  it('resolves a named import', () => {
    expect(resolve(`import { Button } from './button';`, 'Button')).toMatchInlineSnapshot(`
      {
        "componentName": "Button",
        "importId": "./button",
        "importName": "Button",
        "localImportName": "Button",
      }
    `);
  });

  it('keeps the exported name when the local name is an alias', () => {
    expect(resolve(`import { ButtonComponent as Btn } from './button';`, 'Btn'))
      .toMatchInlineSnapshot(`
      {
        "componentName": "Btn",
        "importId": "./button",
        "importName": "ButtonComponent",
        "localImportName": "Btn",
      }
    `);
  });

  it('resolves a default import', () => {
    expect(resolve(`import Button from './Button.vue';`, 'Button')).toMatchInlineSnapshot(`
      {
        "componentName": "Button",
        "importId": "./Button.vue",
        "importName": "default",
        "localImportName": "Button",
      }
    `);
  });

  it('marks a bare namespace binding as a namespace', () => {
    expect(resolve(`import * as Icons from './icons';`, 'Icons')).toMatchInlineSnapshot(`
      {
        "componentName": "Icons",
        "importId": "./icons",
        "importName": "*",
        "localImportName": "Icons",
        "namespace": "Icons",
      }
    `);
  });

  it('resolves a compound name through a namespace import to the member export', () => {
    expect(resolve(`import * as Accordion from './accordion';`, 'Accordion.Root'))
      .toMatchInlineSnapshot(`
      {
        "componentName": "Accordion.Root",
        "importId": "./accordion",
        "importName": "Root",
        "localImportName": "Accordion",
        "member": "Root",
        "namespace": "Accordion",
      }
    `);
  });

  it('resolves a compound name through a named import to the base export', () => {
    expect(resolve(`import { Accordion } from './accordion';`, 'Accordion.Root'))
      .toMatchInlineSnapshot(`
      {
        "componentName": "Accordion.Root",
        "importId": "./accordion",
        "importName": "Accordion",
        "localImportName": "Accordion",
        "member": "Root",
      }
    `);
  });

  it('splits a compound name on the first dot only', () => {
    expect(resolve(`import * as A from './a';`, 'A.B.C')).toMatchObject({
      importName: 'B.C',
      member: 'B.C',
      namespace: 'A',
    });
  });

  it('reports no binding for a component declared in the story file', () => {
    expect(resolve(`const Button = () => null;`, 'Button')).toMatchInlineSnapshot(`
      {
        "componentName": "Button",
      }
    `);
  });

  it('reports no binding for a compound name whose base is not imported', () => {
    expect(resolve(`const Accordion = {};`, 'Accordion.Root')).toMatchInlineSnapshot(`
      {
        "componentName": "Accordion.Root",
        "member": "Root",
      }
    `);
  });

  it('reports no binding for a type-only import', () => {
    expect(resolve(`import type { Button } from './button';`, 'Button')).toMatchInlineSnapshot(`
      {
        "componentName": "Button",
      }
    `);
  });
});

describe('buildImportStatements', () => {
  it('emits nothing for refs without a source', () => {
    expect(buildImportStatements({ refs: [{ localImportName: 'Button' }] })).toEqual([]);
  });

  it('emits single-quoted declarations per specifier kind', () => {
    expect(
      statementsFor(
        dedent`
        import { Button } from './button';
        import { ButtonComponent as Btn } from './aliased';
        import Panel from './Panel.vue';
        import * as Icons from './icons';
      `,
        ['Button', 'Btn', 'Panel', 'Icons']
      )
    ).toMatchInlineSnapshot(`
      [
        "import { Button } from './button';",
        "import { ButtonComponent as Btn } from './aliased';",
        "import Panel from './Panel.vue';",
        "import * as Icons from './icons';",
      ]
    `);
  });

  it('merges a default and named specifiers from the same source into one declaration', () => {
    expect(
      statementsFor(
        dedent`
        import Link, { Banner, Dialog } from '@primer/react';
        import { CopilotIcon } from '@primer/octicons-react';
      `,
        ['Banner', 'CopilotIcon', 'Dialog', 'Link']
      )
    ).toMatchInlineSnapshot(`
      [
        "import Link, { Banner, Dialog } from '@primer/react';",
        "import { CopilotIcon } from '@primer/octicons-react';",
      ]
    `);
  });

  it('keeps a namespace declaration separate from named specifiers of the same source', () => {
    expect(
      statementsFor(
        dedent`
        import * as PR from '@primer/react';
        import { Banner } from '@primer/react';
      `,
        ['Banner', 'PR.Box']
      )
    ).toMatchInlineSnapshot(`
      [
        "import * as PR from '@primer/react';",
        "import { Banner } from '@primer/react';",
      ]
    `);
  });

  it('emits a namespace import once for several members', () => {
    expect(statementsFor(`import * as A from './a';`, ['A.Root', 'A.Item', 'A.Trigger']))
      .toMatchInlineSnapshot(`
      [
        "import * as A from './a';",
      ]
    `);
  });

  it('deduplicates repeated refs', () => {
    const ref: ImportRef = {
      importId: './button',
      importName: 'Button',
      localImportName: 'Button',
    };
    expect(buildImportStatements({ refs: [ref, { ...ref }] })).toMatchInlineSnapshot(`
      [
        "import { Button } from './button';",
      ]
    `);
  });

  it('wraps a declaration that exceeds the print width', () => {
    const names = [
      'Aaaaaaaaaaaaaaaaaaaaaaaa',
      'Bbbbbbbbbbbbbbbbbbbbbbbb',
      'Cccccccccccccccccccccccc',
      'Dddddddddddddddddddddddd',
    ];
    expect(
      buildImportStatements({
        refs: names.map((name) => ({
          importId: './ui',
          importName: name,
          localImportName: name,
        })),
      })
    ).toMatchInlineSnapshot(`
      [
        "import {
        Aaaaaaaaaaaaaaaaaaaaaaaa,
        Bbbbbbbbbbbbbbbbbbbbbbbb,
        Cccccccccccccccccccccccc,
        Dddddddddddddddddddddddd,
      } from './ui';",
      ]
    `);
  });

  it('buckets by first-seen source order', () => {
    expect(
      statementsFor(
        dedent`
        import { A } from './a';
        import { B } from './b';
        import { A2 } from './a';
      `,
        ['B', 'A', 'A2']
      )
    ).toMatchInlineSnapshot(`
      [
        "import { B } from './b';",
        "import { A, A2 } from './a';",
      ]
    `);
  });

  describe('packageName rewriting', () => {
    it('rewrites a relative source to the package name', () => {
      expect(statementsFor(`import { Button } from './button';`, ['Button'], 'my-design-system'))
        .toMatchInlineSnapshot(`
        [
          "import { Button } from 'my-design-system';",
        ]
      `);
    });

    it('keeps an unresolved package specifier', () => {
      expect(
        statementsFor(
          `import { MemoryRouter } from 'react-router-dom';`,
          ['MemoryRouter'],
          'my-design-system',
          { isPackage: true }
        )
      ).toMatchInlineSnapshot(`
        [
          "import { MemoryRouter } from 'react-router-dom';",
        ]
      `);
    });

    it('keeps an unresolved mixed-case package specifier', () => {
      expect(
        statementsFor(
          dedent`
            import { Button } from '@Company/ui';
            import JSONStream from 'JSONStream';
          `,
          ['Button', 'JSONStream'],
          'my-design-system',
          { isPackage: true }
        )
      ).toMatchInlineSnapshot(`
        [
          "import { Button } from '@Company/ui';",
          "import JSONStream from 'JSONStream';",
        ]
      `);
    });

    it('keeps an unresolved package subpath', () => {
      expect(
        statementsFor(`import format from 'date-fns/format';`, ['format'], 'my-design-system', {
          isPackage: true,
        })
      ).toMatchInlineSnapshot(`
        [
          "import format from 'date-fns/format';",
        ]
      `);
    });

    it('rewrites an absolute path to the package name', () => {
      expect(
        statementsFor(
          dedent`
            import Button from '/Users/me/Button';
            import WinButton from 'C:/Users/me/Button';
            import PosixButton from 'c:/users/me/button';
          `,
          ['Button', 'WinButton', 'PosixButton'],
          'my-design-system'
        )
      ).toMatchInlineSnapshot(`
        [
          "import { Button, WinButton, PosixButton } from 'my-design-system';",
        ]
      `);
    });

    it('rewrites a tilde or hash alias to the package name', () => {
      expect(
        statementsFor(
          dedent`
            import { Button } from '~/components/Button';
            import Btn from '#Button';
          `,
          ['Button', 'Btn'],
          'my-design-system'
        )
      ).toMatchInlineSnapshot(`
        [
          "import { Button, Btn } from 'my-design-system';",
        ]
      `);
    });

    it('leaves a source that already resolves as a package alone', () => {
      expect(
        buildImportStatements({
          refs: [
            {
              importId: '@primer/react',
              importName: 'Banner',
              localImportName: 'Banner',
              isPackage: true,
            },
          ],
          packageName: 'my-design-system',
        })
      ).toMatchInlineSnapshot(`
        [
          "import { Banner } from '@primer/react';",
        ]
      `);
    });

    it('turns a rewritten default import into a named import using the local name', () => {
      expect(statementsFor(`import Button from './button';`, ['Button'], 'my-design-system'))
        .toMatchInlineSnapshot(`
        [
          "import { Button } from 'my-design-system';",
        ]
      `);
    });

    it('turns a rewritten namespace member into a named import', () => {
      expect(statementsFor(`import * as A from './a';`, ['A.Root'], 'my-design-system'))
        .toMatchInlineSnapshot(`
        [
          "import { Root } from 'my-design-system';",
        ]
      `);
    });

    it('keeps a rewritten namespace that has no single member to name', () => {
      expect(statementsFor(`import * as Icons from './icons';`, ['Icons'], 'my-design-system'))
        .toMatchInlineSnapshot(`
        [
          "import * as Icons from 'my-design-system';",
        ]
      `);
    });

    it('keeps a rewritten namespace when the member is a nested path', () => {
      expect(statementsFor(`import * as A from './a';`, ['A.B.C'], 'my-design-system'))
        .toMatchInlineSnapshot(`
        [
          "import * as A from 'my-design-system';",
        ]
      `);
    });
  });

  describe('a name bound by both a component and an arg value', () => {
    // Component refs are rewritten to the package; arg refs keep their source and come after.
    const statementsWithArgs = (code: string, components: string[], argNames: string[]) => {
      const bindings = bindingsOf(code);
      return buildImportStatements({
        refs: [
          ...components.map((name) => resolveComponentImport(name, bindings)),
          ...argNames.map((name) => ({
            ...resolveComponentImport(name, bindings),
            isPackage: true,
          })),
        ],
        packageName: 'my-lib',
      });
    };

    it.each([
      {
        shape: 'named',
        code: `import { Button } from './Button'; import { Icon } from './Icon';`,
        components: ['Button', 'Icon'],
        args: ['Icon'],
        expected: [`import { Button, Icon } from 'my-lib';`],
      },
      {
        shape: 'aliased',
        code: `import { Button } from './Button'; import { Icon as Glyph } from './Icon';`,
        components: ['Button', 'Glyph'],
        args: ['Glyph'],
        expected: [`import { Button, Icon as Glyph } from 'my-lib';`],
      },
      {
        shape: 'default',
        code: `import { Button } from './Button'; import Icon from './Icon';`,
        components: ['Button', 'Icon'],
        args: ['Icon'],
        expected: [`import { Button, Icon } from 'my-lib';`],
      },
      {
        shape: 'namespace member',
        code: `import { Button } from './Button'; import * as Icons from './icons';`,
        components: ['Button', 'Icons.Check'],
        args: ['Icons'],
        expected: [`import { Button, Check } from 'my-lib';`, `import * as Icons from './icons';`],
      },
      {
        shape: 'deep namespace path',
        code: `import { Button } from './Button'; import * as Icons from './icons';`,
        components: ['Button', 'Icons.Solid.Check'],
        args: ['Icons'],
        expected: [`import * as Icons from 'my-lib';`, `import { Button } from 'my-lib';`],
      },
      {
        shape: 'non-JSX value',
        code: `import { Button } from './Button'; import { Icon } from './Icon';`,
        components: ['Button'],
        args: ['Icon'],
        expected: [`import { Button } from 'my-lib';`, `import { Icon } from './Icon';`],
      },
    ])('declares a $shape import once', ({ code, components, args, expected }) => {
      expect(statementsWithArgs(code, components, args)).toEqual(expected);
    });
  });

  describe('importOverride', () => {
    const button: ImportRef = {
      importId: './button',
      importName: 'Button',
      localImportName: 'Button',
    };

    it('takes precedence over packageName for the source', () => {
      expect(
        buildImportStatements({
          refs: [{ ...button, importOverride: `import { Button } from 'my-design-system';` }],
          packageName: 'ignored',
        })
      ).toMatchInlineSnapshot(`
        [
          "import { Button } from 'my-design-system';",
        ]
      `);
    });

    it('aliases the overridden export to the local name', () => {
      expect(
        buildImportStatements({
          refs: [{ ...button, importOverride: `import { PublicButton } from 'ds';` }],
        })
      ).toMatchInlineSnapshot(`
        [
          "import { PublicButton as Button } from 'ds';",
        ]
      `);
    });

    it('forces a default import while keeping the local name', () => {
      expect(
        buildImportStatements({
          refs: [{ ...button, importOverride: `import Whatever from 'ds';` }],
        })
      ).toMatchInlineSnapshot(`
        [
          "import Button from 'ds';",
        ]
      `);
    });

    it('uses a namespace override as written', () => {
      expect(
        buildImportStatements({
          refs: [{ ...button, importOverride: `import * as DS from 'ds';` }],
        })
      ).toMatchInlineSnapshot(`
        [
          "import * as DS from 'ds';",
        ]
      `);
    });

    it('keeps the overridden source when it carries no specifier', () => {
      expect(buildImportStatements({ refs: [{ ...button, importOverride: `import 'ds';` }] }))
        .toMatchInlineSnapshot(`
        [
          "import { Button } from 'ds';",
        ]
      `);
    });

    it('falls back to the declared import when the override does not parse', () => {
      expect(buildImportStatements({ refs: [{ ...button, importOverride: 'not an import' }] }))
        .toMatchInlineSnapshot(`
        [
          "import { Button } from './button';",
        ]
      `);
    });

    it('merges components overridden onto the same source', () => {
      expect(
        buildImportStatements({
          refs: [
            { ...button, importOverride: `import { Button } from 'ds';` },
            {
              importId: './card',
              importName: 'Card',
              localImportName: 'Card',
              importOverride: `import { Card } from 'ds';`,
            },
          ],
        })
      ).toMatchInlineSnapshot(`
        [
          "import { Button, Card } from 'ds';",
        ]
      `);
    });
  });
});

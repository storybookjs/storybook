import { describe, expect, it } from 'vitest';

import { flattenInheritance } from './flatten-inheritance.ts';
import type {
  ManifestAnyDeclaration,
  ManifestClassLikeDeclaration,
  ManifestDeclaration,
  ManifestPackage,
  ManifestReference,
} from './types.ts';

type BaseFlattenCase = {
  name: string;
  declarations?: ManifestAnyDeclaration[];
  manifest?: ManifestPackage;
  declarationName: string;
};

type NameFlattenCase = BaseFlattenCase & { expected: NamedOutput };

type OverrideFlattenCase = BaseFlattenCase & { expected: unknown[] };

type NamedOutput = {
  members?: string[];
  attributes?: string[];
  events?: string[];
  slots?: string[];
  cssParts?: string[];
  cssProperties?: string[];
  cssStates?: string[];
};

const MATERIAL_LIKE = {
  schemaVersion: '1.0.0',
  modules: [
    {
      kind: 'javascript-module',
      path: 'button/filled-button.js',
      declarations: [
        {
          name: 'MdFilledButton',
          kind: 'class',
          tagName: 'md-filled-button',
          customElement: true,
          superclass: {
            name: 'FilledButton',
            package: '@material/web',
            module: 'button/internal/filled-button.js',
          },
        },
      ],
      exports: [
        {
          kind: 'custom-element-definition',
          name: 'md-filled-button',
          declaration: { name: 'MdFilledButton', module: 'button/filled-button.js' },
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'button/internal/filled-button.js',
      declarations: [
        {
          name: 'FilledButton',
          kind: 'class',
          customElement: true,
          superclass: {
            name: 'Button',
            package: '@material/web',
            module: 'button/internal/button.js',
          },
          cssProperties: [{ name: '--md-filled-button-container-color' }],
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'button/internal/button.js',
      declarations: [
        {
          name: 'Button',
          kind: 'class',
          customElement: true,
          superclass: { name: 'LitElement', package: 'lit' },
          mixins: [
            {
              name: 'FormSubmitter',
              package: '@material/web',
              module: 'internal/controller/form-submitter.js',
            },
          ],
          members: [
            { kind: 'field', name: 'disabled' },
            { kind: 'field', name: 'type' },
          ],
          attributes: [{ name: 'disabled', fieldName: 'disabled' }],
          events: [{ name: 'md-focus', type: { text: 'CustomEvent<void>' } }],
          slots: [{ name: 'icon' }],
        },
      ],
    },
    {
      kind: 'javascript-module',
      path: 'internal/controller/form-submitter.js',
      declarations: [
        {
          name: 'FormSubmitter',
          kind: 'mixin',
          members: [
            { kind: 'field', name: 'type' },
            { kind: 'field', name: 'form', readonly: true },
          ],
        },
      ],
    },
  ],
} satisfies ManifestPackage;

describe('flattenInheritance', () => {
  it.each([
    {
      name: 'merges a superclass chain with a superclass mixin',
      manifest: MATERIAL_LIKE,
      declarationName: 'MdFilledButton',
      expected: {
        attributes: ['disabled<-Button'],
        cssProperties: ['--md-filled-button-container-color<-FilledButton'],
        events: ['md-focus<-Button'],
        members: ['disabled<-Button', 'type<-Button', 'form<-FormSubmitter'],
        slots: ['icon<-Button'],
      },
    },
    {
      name: 'skips a package reference without a module',
      manifest: MATERIAL_LIKE,
      declarationName: 'Button',
      expected: {
        attributes: ['disabled'],
        events: ['md-focus'],
        members: ['disabled', 'type', 'form<-FormSubmitter'],
        slots: ['icon'],
      },
    },
    {
      name: 'mixin wins over the superclass for a shared name',
      declarations: [
        {
          name: 'M',
          kind: 'mixin',
          members: [
            { kind: 'field', name: 'dup' },
            { kind: 'field', name: 'm' },
          ],
        },
        {
          name: 'B',
          kind: 'class',
          members: [
            { kind: 'field', name: 'dup' },
            { kind: 'field', name: 'b' },
          ],
        },
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          mixins: [{ name: 'M', module: 'x.js' }],
          superclass: { name: 'B', module: 'x.js' },
          members: [{ kind: 'field', name: 'a' }],
        },
      ],
      declarationName: 'A',
      expected: { members: ['a', 'dup<-M', 'm<-M', 'b<-B'] },
    },
    {
      name: 'diamond keeps the shared mixin once',
      declarations: [
        { name: 'M', kind: 'mixin', members: [{ kind: 'field', name: 'm' }] },
        {
          name: 'B',
          kind: 'class',
          mixins: [{ name: 'M', module: 'x.js' }],
          members: [{ kind: 'field', name: 'b' }],
        },
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          mixins: [{ name: 'M', module: 'x.js' }],
          superclass: { name: 'B', module: 'x.js' },
          members: [{ kind: 'field', name: 'a' }],
        },
      ],
      declarationName: 'A',
      expected: { members: ['a', 'm<-M', 'b<-B'] },
    },
    {
      name: 'self reference is ignored',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          superclass: { name: 'A', module: 'x.js' },
          members: [{ kind: 'field', name: 'a' }],
        },
      ],
      declarationName: 'A',
      expected: { members: ['a'] },
    },
    {
      name: 'inherits parts and states too',
      declarations: [
        {
          name: 'B',
          kind: 'class',
          cssParts: [{ name: 'label' }],
          cssStates: [{ name: 'checked' }],
        },
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          superclass: { name: 'B', module: 'x.js' },
        },
      ],
      declarationName: 'A',
      expected: { cssParts: ['label<-B'], cssStates: ['checked<-B'] },
    },
    {
      name: 'skips a null superclass',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          superclass: null,
          members: [{ kind: 'field', name: 'a' }],
        },
      ] as unknown as ManifestAnyDeclaration[],
      declarationName: 'A',
      expected: { members: ['a'] },
    },
    {
      name: 'skips null mixins',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          mixins: [null],
          members: [{ kind: 'field', name: 'a' }],
        },
      ] as unknown as ManifestAnyDeclaration[],
      declarationName: 'A',
      expected: { members: ['a'] },
    },
    {
      name: 'skips a non-array mixins value',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          mixins: { name: 'M' },
          members: [{ kind: 'field', name: 'a' }],
        },
      ] as unknown as ManifestAnyDeclaration[],
      declarationName: 'A',
      expected: { members: ['a'] },
    },
    {
      name: 'skips references to a missing module',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'child.js',
            declarations: [
              {
                name: 'Child',
                kind: 'class',
                customElement: true,
                superclass: { name: 'Missing', module: 'missing.js' },
                members: [{ kind: 'field', name: 'own' }],
              },
            ],
          },
        ],
      } satisfies ManifestPackage,
      declarationName: 'Child',
      expected: { members: ['own'] },
    },
    {
      name: 'skips a package reference whose module is not in the manifest',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          superclass: { name: 'B', package: 'other', module: 'missing.js' },
          members: [{ kind: 'field', name: 'a' }],
        },
      ],
      declarationName: 'A',
      expected: { members: ['a'] },
    },
    {
      name: 'resolves a reference without module in the referencing module',
      declarations: [
        { name: 'Base', kind: 'class', members: [{ kind: 'field', name: 'base' }] },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          superclass: { name: 'Base' },
          members: [{ kind: 'field', name: 'child' }],
        },
      ],
      declarationName: 'Child',
      expected: { members: ['child', 'base<-Base'] },
    },
    {
      name: 'stops on a cycle',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          superclass: { name: 'B' },
          members: [{ kind: 'field', name: 'a' }],
        },
        {
          name: 'B',
          kind: 'class',
          superclass: { name: 'A' },
          members: [{ kind: 'field', name: 'b' }],
        },
      ],
      declarationName: 'A',
      expected: { members: ['a', 'b<-B'] },
    },
    {
      name: 'keeps an own item over an inherited duplicate listed first',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          members: [
            {
              kind: 'method',
              name: 'focusIt',
              description: 'inherited base',
              inheritedFrom: { name: 'Base' },
            },
            { kind: 'method', name: 'focusIt', description: 'own override' },
          ],
        },
      ],
      declarationName: 'A',
      expected: { members: ['focusIt'] },
    },
    {
      name: 'keeps an own item over an inherited duplicate listed after it',
      declarations: [
        {
          name: 'A',
          kind: 'class',
          customElement: true,
          members: [
            { kind: 'method', name: 'focusIt', description: 'own override' },
            {
              kind: 'method',
              name: 'focusIt',
              description: 'inherited base',
              inheritedFrom: { name: 'Base' },
            },
          ],
        },
      ],
      declarationName: 'A',
      expected: { members: ['focusIt'] },
    },
    {
      name: 'matches module paths with and without a leading ./',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'base.js',
            declarations: [
              { name: 'Base', kind: 'class', members: [{ kind: 'field', name: 'base' }] },
            ],
          },
          {
            kind: 'javascript-module',
            path: 'child.js',
            declarations: [
              {
                name: 'Child',
                kind: 'class',
                customElement: true,
                superclass: { name: 'Base', module: './base.js' },
                members: [{ kind: 'field', name: 'child' }],
              },
            ],
          },
        ],
      } satisfies ManifestPackage,
      declarationName: 'Child',
      expected: { members: ['child', 'base<-Base'] },
    },
  ] satisfies NameFlattenCase[])('$name', (row) => {
    expect(outputNames(declarationFor(row) as ManifestDeclaration)).toEqual(row.expected);
  });

  it('leaves duplicate declarations after the first normalized key unflattened', () => {
    const manifest = {
      schemaVersion: '1.0.0',
      modules: [
        {
          kind: 'javascript-module',
          path: 'base.js',
          declarations: [
            { name: 'Base', kind: 'class', members: [{ kind: 'field', name: 'base' }] },
          ],
        },
        {
          kind: 'javascript-module',
          path: 'a.js',
          declarations: [{ name: 'X', kind: 'class', members: [{ kind: 'field', name: 'x' }] }],
        },
        {
          kind: 'javascript-module',
          path: './a.js',
          declarations: [
            {
              name: 'X',
              kind: 'class',
              superclass: { name: 'Base', module: 'base.js' },
              members: [{ kind: 'field', name: 'duplicate' }],
            },
          ],
        },
      ],
    } satisfies ManifestPackage;

    const xs = flattenInheritance(manifest).modules.flatMap((module) =>
      Array.isArray(module.declarations)
        ? module.declarations.filter(
            (declaration): declaration is ManifestClassLikeDeclaration =>
              (declaration.kind === 'class' || declaration.kind === 'mixin') &&
              declaration.name === 'X'
          )
        : []
    );

    expect(xs.map((declaration) => outputNames(declaration as ManifestDeclaration))).toEqual([
      { members: ['x'] },
      { members: ['duplicate'] },
    ]);
  });

  it.each([
    {
      name: 'merges an override over the parent item it redeclares',
      declarations: [
        {
          name: 'Base',
          kind: 'class',
          members: [
            {
              kind: 'field',
              name: 'label',
              type: { text: 'string' },
              default: "'base'",
              description: 'The label.',
            },
          ],
        },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          superclass: { name: 'Base' },
          members: [{ kind: 'field', name: 'label', default: "'child'" }],
        },
      ],
      declarationName: 'Child',
      expected: [
        {
          kind: 'field',
          name: 'label',
          type: { text: 'string' },
          default: "'child'",
          description: 'The label.',
        },
      ],
    },
    {
      name: 'keeps an override own when the parent inherited that item itself',
      declarations: [
        {
          name: 'G',
          kind: 'class',
          members: [{ kind: 'field', name: 'label', description: 'From the grandparent.' }],
        },
        { name: 'B', kind: 'class', superclass: { name: 'G' } },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          superclass: { name: 'B' },
          members: [{ kind: 'field', name: 'label', default: "'child'" }],
        },
      ],
      declarationName: 'Child',
      expected: [
        { kind: 'field', name: 'label', default: "'child'", description: 'From the grandparent.' },
      ],
    },
    {
      name: 'leaves an override the analyzer already flattened as it is',
      declarations: [
        {
          name: 'Base',
          kind: 'class',
          members: [{ kind: 'field', name: 'label', description: 'The label.' }],
        },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          superclass: { name: 'Base' },
          members: [
            { kind: 'field', name: 'label', default: "'child'", inheritedFrom: { name: 'Base' } },
          ],
        },
      ],
      declarationName: 'Child',
      expected: [
        { kind: 'field', name: 'label', default: "'child'", inheritedFrom: { name: 'Base' } },
      ],
    },
    {
      name: 'fills an override from every parent, the first one winning',
      declarations: [
        {
          name: 'M',
          kind: 'mixin',
          members: [{ kind: 'field', name: 'label', description: 'From the mixin.' }],
        },
        {
          name: 'B',
          kind: 'class',
          members: [
            {
              kind: 'field',
              name: 'label',
              description: 'From the superclass.',
              type: { text: 'string' },
            },
          ],
        },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          mixins: [{ name: 'M' }],
          superclass: { name: 'B' },
          members: [{ kind: 'field', name: 'label', default: "'child'" }],
        },
      ],
      declarationName: 'Child',
      expected: [
        {
          kind: 'field',
          name: 'label',
          default: "'child'",
          description: 'From the mixin.',
          type: { text: 'string' },
        },
      ],
    },
    {
      name: 'does not inherit access or mutability flags into overrides',
      declarations: [
        {
          name: 'Base',
          kind: 'class',
          members: [
            { kind: 'field', name: 'a', privacy: 'protected', description: 'A.' },
            { kind: 'field', name: 'b', readonly: true, description: 'B.' },
            { kind: 'field', name: 'c', static: true, description: 'C.' },
          ],
        },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          superclass: { name: 'Base' },
          members: [
            { kind: 'field', name: 'a' },
            { kind: 'field', name: 'b' },
            { kind: 'field', name: 'c' },
          ],
        },
      ],
      declarationName: 'Child',
      expected: [
        { kind: 'field', name: 'a', description: 'A.' },
        { kind: 'field', name: 'b', description: 'B.' },
        { kind: 'field', name: 'c', description: 'C.' },
      ],
    },
  ] satisfies OverrideFlattenCase[])('$name', (row) => {
    expect(declarationFor(row).members).toEqual(row.expected);
  });

  it('returns the declaration unchanged when nothing is inherited', () => {
    const manifest = manifestFor({
      declarations: [{ name: 'Plain', kind: 'class', customElement: true, tagName: 'x-plain' }],
    });

    const result = declarationFor({ manifest, declarationName: 'Plain' });

    expect(result).toEqual({
      name: 'Plain',
      kind: 'class',
      customElement: true,
      tagName: 'x-plain',
    });
    expect('members' in result).toBe(false);
  });

  it('replaces a non-array list on the child with the inherited items', () => {
    const manifest = manifestFor({
      declarations: [
        { name: 'Base', kind: 'class', members: [{ kind: 'field', name: 'base' }] },
        {
          name: 'Child',
          kind: 'class',
          customElement: true,
          superclass: { name: 'Base' },
          members: 'oops',
        },
      ] as unknown as ManifestAnyDeclaration[],
    });

    expect(names(declarationFor({ manifest, declarationName: 'Child' }).members ?? [])).toEqual([
      'base<-Base',
    ]);
  });

  it('does not mutate the input manifest', () => {
    const clone = structuredClone(MATERIAL_LIKE);

    flattenInheritance(MATERIAL_LIKE);

    expect(MATERIAL_LIKE).toEqual(clone);
  });
});

function manifestFor({
  manifest,
  declarations = [],
}: Pick<BaseFlattenCase, 'manifest' | 'declarations'>): ManifestPackage {
  return (
    manifest ?? {
      schemaVersion: '1.0.0',
      modules: [{ kind: 'javascript-module', path: 'x.js', declarations }],
    }
  );
}

function declarationFor(
  row: Pick<BaseFlattenCase, 'manifest' | 'declarations' | 'declarationName'>
): ManifestClassLikeDeclaration {
  const matches = flattenInheritance(manifestFor(row)).modules.flatMap((module) =>
    Array.isArray(module.declarations)
      ? module.declarations.filter(
          (declaration): declaration is ManifestClassLikeDeclaration =>
            (declaration.kind === 'class' || declaration.kind === 'mixin') &&
            declaration.name === row.declarationName
        )
      : []
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected one declaration named ${row.declarationName}, found ${matches.length}`
    );
  }
  return matches[0];
}

function outputNames(declaration: ManifestDeclaration): NamedOutput {
  return {
    ...(declaration.members ? { members: names(declaration.members) } : {}),
    ...(declaration.attributes ? { attributes: names(declaration.attributes) } : {}),
    ...(declaration.events ? { events: names(declaration.events) } : {}),
    ...(declaration.slots ? { slots: names(declaration.slots) } : {}),
    ...(declaration.cssParts ? { cssParts: names(declaration.cssParts) } : {}),
    ...(declaration.cssProperties ? { cssProperties: names(declaration.cssProperties) } : {}),
    ...(declaration.cssStates ? { cssStates: names(declaration.cssStates) } : {}),
  };
}

function names(
  list: Array<{ name: string; inheritedFrom?: Pick<ManifestReference, 'name'> }>
): string[] {
  return list.map((item) =>
    item.inheritedFrom ? `${item.name}<-${item.inheritedFrom.name}` : item.name
  );
}

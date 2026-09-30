import { describe, expect, it } from 'vitest';

import {
  indexDeclarations,
  type DeclarationIndex,
  type IndexedDeclaration,
} from './declaration-index.ts';
import { createInheritanceResolver } from './resolve-inheritance.ts';
import type {
  ManifestAnyDeclaration,
  ManifestDeclaration,
  ManifestPackage,
  ManifestReference,
} from './types.ts';

type NamedOutput = {
  members?: string[];
  attributes?: string[];
  events?: string[];
  slots?: string[];
  cssParts?: string[];
  cssProperties?: string[];
  cssStates?: string[];
};

type ResolveCase = {
  name: string;
  manifest?: ManifestPackage;
  declarations?: ManifestAnyDeclaration[];
  declarationName: string;
  modulePath: string;
  expected: NamedOutput;
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

describe('resolveInheritance', () => {
  it.each([
    {
      name: 'merges a superclass chain with a superclass mixin',
      manifest: MATERIAL_LIKE,
      declarationName: 'MdFilledButton',
      modulePath: 'button/filled-button.js',
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
      modulePath: 'button/internal/button.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'child.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'x.js',
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
      modulePath: 'child.js',
      expected: { members: ['child', 'base<-Base'] },
    },
  ] satisfies ResolveCase[])('$name', (row) => {
    const index = indexDeclarations(manifestFor(row));
    const result = createInheritanceResolver(index)(
      entryFor(index, row.modulePath, row.declarationName)
    );

    expect(outputNames(result as ManifestDeclaration)).toEqual(row.expected);
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
  ] satisfies {
    name: string;
    declarations: ManifestAnyDeclaration[];
    expected: unknown[];
  }[])('$name', ({ declarations, expected }) => {
    const index = indexDeclarations(manifestFor({ declarations }));
    const result = createInheritanceResolver(index)(entryFor(index, 'x.js', 'Child'));

    expect(result.members).toEqual(expected);
  });

  it('caches a declaration inside a cycle with the view it had when the cycle was cut', () => {
    const index = indexDeclarations(
      manifestFor({
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
            customElement: true,
            superclass: { name: 'A' },
            members: [{ kind: 'field', name: 'b' }],
          },
        ],
      })
    );
    const resolver = createInheritanceResolver(index);

    resolver(entryFor(index, 'x.js', 'A'));

    expect(names(resolver(entryFor(index, 'x.js', 'B')).members ?? [])).toEqual(['b']);
  });

  it('returns the declaration unchanged when nothing is inherited', () => {
    const index = indexDeclarations(
      manifestFor({
        declarations: [{ name: 'Plain', kind: 'class', customElement: true, tagName: 'x-plain' }],
      })
    );
    const entry = entryFor(index, 'x.js', 'Plain');
    const result = createInheritanceResolver(index)(entry);

    expect(result).toEqual(entry.declaration);
    expect('members' in result).toBe(false);
  });

  it('replaces a non-array list on the child with the inherited items', () => {
    const index = indexDeclarations(
      manifestFor({
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
      })
    );
    const result = createInheritanceResolver(index)(entryFor(index, 'x.js', 'Child'));

    expect(names(result.members ?? [])).toEqual(['base<-Base']);
  });

  it('does not mutate the input manifest', () => {
    const clone = structuredClone(MATERIAL_LIKE);
    const index = indexDeclarations(MATERIAL_LIKE);

    createInheritanceResolver(index)(entryFor(index, 'button/filled-button.js', 'MdFilledButton'));

    expect(MATERIAL_LIKE).toEqual(clone);
  });

  it('returns the same resolved object when resolving a cached declaration twice', () => {
    const index = indexDeclarations(MATERIAL_LIKE);
    const resolver = createInheritanceResolver(index);
    const entry = entryFor(index, 'button/filled-button.js', 'MdFilledButton');

    expect(resolver(entry)).toBe(resolver(entry));
  });
});

function manifestFor({
  manifest,
  declarations = [],
}: Pick<ResolveCase, 'manifest' | 'declarations'>): ManifestPackage {
  return (
    manifest ?? {
      schemaVersion: '1.0.0',
      modules: [{ kind: 'javascript-module', path: 'x.js', declarations }],
    }
  );
}

function entryFor(index: DeclarationIndex, modulePath: string, name: string): IndexedDeclaration {
  const entry = index.get(modulePath, name);
  if (!entry) {
    throw new Error(`Missing declaration ${name}`);
  }
  return entry;
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

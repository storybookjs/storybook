import { createStoryArgsResolver, loadCsf } from 'storybook/internal/csf-tools';

import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { authoredSource } from './story-docs-source.ts';

const authoredSourceOf = (source: string, exportName = 'Default') => {
  const csf = loadCsf(source, { makeTitle: () => 'Example/Button' }).parse();
  const resolver = createStoryArgsResolver(csf);
  const resolved = resolver.resolve(exportName);
  return authoredSource(
    { members: resolved.storyMembers, metaMembers: resolved.metaMembers },
    resolver.ctx
  );
};

describe('authoredSource', () => {
  it('follows local names through every level of the source path', () => {
    expect(
      authoredSourceOf(dedent`
        const CODE = '<sb-button local></sb-button>';
        const source = { code: CODE };
        const docs = { source };
        export default { title: 'Example/Button' };
        export const Default = { parameters: { docs } };
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "<sb-button local></sb-button>",
        "kind": "code",
      }
    `);
  });

  it('reports an opaque spread that can shadow the source code', () => {
    expect(
      authoredSourceOf(dedent`
        declare function overrides(): object;
        export default { title: 'Example/Button' };
        export const Default = {
          parameters: {
            docs: { source: { code: '<sb-button></sb-button>', ...overrides() } },
          },
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "unresolvable",
        "source": "...overrides()",
      }
    `);
  });

  it('reports a computed member that can provide the source code', () => {
    expect(
      authoredSourceOf(dedent`
        declare const key: string;
        export default { title: 'Example/Button' };
        export const Default = {
          parameters: { docs: { source: { [key]: '<sb-button></sb-button>' } } },
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "unresolvable",
        "source": "[key]: '<sb-button></sb-button>'",
      }
    `);
  });

  it('reads source parameters inherited through a CSF factory extension', () => {
    expect(
      authoredSourceOf(
        dedent`
          import preview from '../.storybook/preview';
          const meta = preview.meta({ title: 'Example/Button' });
          const Base = meta.story({
            parameters: {
              docs: { source: { code: '<sb-button inherited></sb-button>' } },
            },
          });
          export const Default = Base.extend({ parameters: { layout: 'centered' } });
        `
      )
    ).toMatchInlineSnapshot(`
      {
        "code": "<sb-button inherited></sb-button>",
        "kind": "code",
      }
    `);
  });

  it('treats null source code as an explicit disable', () => {
    expect(
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = {
          parameters: { docs: { source: { code: null } } },
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "kind": "disabled",
      }
    `);
  });

  it('falls through an explicit undefined story value to the meta source', () => {
    expect(
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = {
          parameters: { docs: { source: { code: undefined } } },
        };
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "<sb-button meta></sb-button>",
        "kind": "code",
      }
    `);
  });

  it('does not inherit meta code through a story value that replaces an intermediate object', () => {
    expect([
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = { parameters: { docs: null } };
      `),
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = { parameters: { docs: false } };
      `),
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = { parameters: { docs: { source: [] } } };
      `),
    ]).toMatchInlineSnapshot(`
      [
        {
          "kind": "missing",
        },
        {
          "kind": "missing",
        },
        {
          "kind": "missing",
        },
      ]
    `);
  });

  it('inherits meta code through an undefined intermediate value', () => {
    expect(
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = { parameters: { docs: void 0 } };
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "<sb-button meta></sb-button>",
        "kind": "code",
      }
    `);
  });

  it('ignores a non-object story parameter set like the runtime parameter merger', () => {
    expect(
      authoredSourceOf(dedent`
        export default {
          title: 'Example/Button',
          parameters: { docs: { source: { code: '<sb-button meta></sb-button>' } } },
        };
        export const Default = { parameters: null };
      `)
    ).toMatchInlineSnapshot(`
      {
        "code": "<sb-button meta></sb-button>",
        "kind": "code",
      }
    `);
  });
});

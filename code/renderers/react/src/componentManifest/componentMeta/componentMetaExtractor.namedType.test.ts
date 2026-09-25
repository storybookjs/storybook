import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extract, extractFromStory } from './componentMetaExtractor.test-helpers.ts';

describe('named-type property detail', () => {
  it('expands an interface declared in the same file', async () => {
    const entry = await extract(
      'Card',
      dedent`
        import React from 'react';
        interface User {
          name: string;
          age: number;
        }
        export const Card = (props: { user: User }) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.user.type).toEqual({
      name: 'User',
      detail: 'User {\n  name: string\n  age: number\n}',
    });
  });

  it('expands an interface declared in a separate file', async () => {
    const entry = await extractFromStory(
      {
        'test/user.ts': dedent`
          export interface User {
            name: string;
            age: number;
          }
        `,
        'test/ProfileCard.tsx': dedent`
          import React from 'react';
          import { User } from './user';
          export const ProfileCard = (props: { user: User }) => <div />;
        `,
        'test/ProfileCard.stories.tsx': dedent`
          import { ProfileCard } from './ProfileCard';
          export default { component: ProfileCard };
        `,
      },
      'test/ProfileCard.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta?.props.user.type).toEqual({
      name: 'User',
      detail: 'User {\n  name: string\n  age: number\n}',
    });
  });

  it('expands a string enum with member values', async () => {
    const entry = await extract(
      'Badge',
      dedent`
        import React from 'react';
        enum Color {
          Red = 'red',
          Green = 'green',
        }
        export const Badge = (props: { status: Color }) => <span />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.status.type).toEqual({
      // Normalized shape: the summary text as the only name, qualified member names as raw,
      // and the member detail. sbType still recovers `enum` from the pipe-separated name.
      name: '"red" | "green"',
      raw: 'Color.Red | Color.Green',
      detail: "Color {\n  Red = 'red'\n  Green = 'green'\n}",
    });
  });

  it('expands an optional named enum the same as a required one', async () => {
    const entry = await extract(
      'Badge',
      dedent`
        import React from 'react';
        enum Color { Red = 'red', Green = 'green' }
        export const Badge = (props: { status?: Color }) => <span />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.status.type).toEqual({
      name: '"red" | "green"',
      raw: 'Color.Red | Color.Green',
      detail: "Color {\n  Red = 'red'\n  Green = 'green'\n}",
    });
  });

  it('expands a numeric enum with computed values', async () => {
    const entry = await extract(
      'Level',
      dedent`
        import React from 'react';
        enum Level {
          Low,
          High,
        }
        export const Level = (props: { level: Level }) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.level.type).toEqual({
      name: '0 | 1',
      raw: 'Level.Low | Level.High',
      detail: 'Level {\n  Low = 0\n  High = 1\n}',
    });
  });

  it('keeps the enum shape for a member value containing a pipe separator', async () => {
    const entry = await extract(
      'Badge',
      dedent`
        import React from 'react';
        enum Weird { A = 'a|b', B = 'c' }
        export const Badge = (props: { tag: Weird }) => <span />;
      `
    );

    // The pipe in the member value would break the sbType literal-union recovery, so the
    // enum keeps its current emission (the legacy summary rewrite applies downstream).
    expect(entry.component?.reactComponentMeta?.props.tag.type).toEqual({
      name: 'enum',
      raw: 'Weird.A | Weird.B',
      value: [{ value: '"a|b"' }, { value: '"c"' }],
    });
  });

  it('keeps a scalar alias without detail', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        type ID = string;
        export const Button = (props: { id: ID }) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.id.type).toEqual({ name: 'string' });
  });

  it('expands a self-referential type one hop only', async () => {
    const entry = await extract(
      'Tree',
      dedent`
        import React from 'react';
        interface Node {
          label: string;
          parent: Node;
        }
        export const Tree = (props: { root: Node }) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.root.type).toEqual({
      name: 'Node',
      detail: 'Node {\n  label: string\n  parent: Node\n}',
    });
  });

  it('completes on a cyclic alias chain without detail', async () => {
    const entry = await extract(
      'Odd',
      dedent`
        import React from 'react';
        type A = B;
        type B = A;
        export const Odd = (props: { value: A }) => <div />;
      `
    );

    const type = entry.component?.reactComponentMeta?.props.value.type;
    expect(type).toBeDefined();
    expect(type).not.toHaveProperty('detail');
  });

  it('does not expand a type declared in node_modules', async () => {
    const entry = await extractFromStory(
      {
        'test/node_modules/fake-lib/package.json':
          '{"name":"fake-lib","version":"1.0.0","types":"./index.d.ts"}',
        'test/node_modules/fake-lib/index.d.ts': dedent`
          export interface ExternalType {
            a: string;
            b: number;
          }
        `,
        'test/External.tsx': dedent`
          import React from 'react';
          import { ExternalType } from 'fake-lib';
          export const External = (props: { external: ExternalType }) => <div />;
        `,
        'test/External.stories.tsx': dedent`
          import { External } from './External';
          export default { component: External };
        `,
      },
      'test/External.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta?.props.external.type).toEqual({
      name: 'ExternalType',
    });
  });

  it('caps at the first 20 member lines and appends a more marker', async () => {
    const members = Array.from({ length: 25 }, (_, i) => `p${i}: string;`).join('\n');
    const entry = await extract(
      'Wide',
      dedent`
        import React from 'react';
        interface Wide {
          ${members}
        }
        export const Wide = (props: { wide: Wide }) => <div />;
      `
    );

    const expectedLines = Array.from({ length: 20 }, (_, i) => `  p${i}: string`);
    expect(entry.component?.reactComponentMeta?.props.wide.type).toEqual({
      name: 'Wide',
      detail: ['Wide {', ...expectedLines, '… 5 more', '}'].join('\n'),
    });
  });

  it('appends a description only when the checker already holds it', async () => {
    const entry = await extract(
      'Card',
      dedent`
        import React from 'react';
        interface User {
          /** The display name. */
          name: string;
          age: number;
        }
        export const Card = (props: { user: User }) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta?.props.user.type).toEqual({
      name: 'User',
      detail: 'User {\n  name: string — The display name.\n  age: number\n}',
    });
  });

  it('keeps the summary and sbType untouched for a named-type prop', async () => {
    const entry = await extract(
      'Card',
      dedent`
        import React from 'react';
        interface User {
          name: string;
        }
        export const Card = (props: { user: User }) => <div />;
      `
    );

    const meta = entry.component?.reactComponentMeta;
    // Summary text (type.name) stays the reference spelling; no other prop fields move.
    expect(meta?.props.user.type.name).toBe('User');
    expect(meta?.props.user.description).toBe('');
    expect(meta?.props.user.required).toBe(true);
  });
});

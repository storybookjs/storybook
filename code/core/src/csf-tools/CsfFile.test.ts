/* eslint-disable no-underscore-dangle */
import { describe, expect, it, vi } from 'vitest';

import yaml from 'js-yaml';
import { dedent } from 'ts-dedent';

import { type CsfOptions, formatCsf, isModuleMock, loadCsf } from './CsfFile';

expect.addSnapshotSerializer({
  print: (val: any) => yaml.dump(val).trimEnd(),
  test: (val) => typeof val !== 'string' && !(val instanceof Error),
});

const makeTitle = (userTitle?: string) => {
  return userTitle || 'Default Title';
};

const parse = (code: string, includeParameters?: boolean) => {
  const { stories, meta } = loadCsf(code, { makeTitle }).parse();
  const filtered = includeParameters ? stories : stories.map(({ parameters, ...rest }) => rest);
  return { meta, stories: filtered };
};

const transform = (code: string, options: Partial<CsfOptions> = { makeTitle }) => {
  const parsed = loadCsf(code, { ...options, makeTitle }).parse();
  return formatCsf(parsed);
};

describe('CsfFile', () => {
  describe('basic', () => {
    it('filters out non-story exports', () => {
      const code = `
        export default { title: 'foo/bar', excludeStories: ['invalidStory'] };
        export const invalidStory = {};
        export const validStory = {};
      `;
      const parsed = loadCsf(code, { makeTitle }).parse();
      expect(Object.keys(parsed._stories)).toEqual(['validStory']);
    });
    it('filters out non-story exports', () => {
      const code = `
        export default { title: 'foo/bar', excludeStories: ['invalidStory'] };
        export const invalidStory = {};
        export const A = {}
        const B = {};
        export { B };
      `;
      const parsed = loadCsf(code, { makeTitle }).parse();
      expect(Object.keys(parsed._stories)).toEqual(['A', 'B']);
    });
    it('transforms inline default exports to constant declarations', () => {
      expect(
        transform(
          dedent`
          export default { title: 'foo/bar' };
        `,
          { transformInlineMeta: true }
        )
      ).toMatchInlineSnapshot(`
        "const _meta = {
          title: 'foo/bar'
        };
        export default _meta;"
      `);
    });

    it('exported const stories', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          const A = () => {};
          const B = (args) => {};
          export { A, B };
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
          - id: foo-bar--b
            name: B
            parameters:
              __id: foo-bar--b
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('underscores', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const __Basic__ = () => {};
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--basic
            name: Basic
            parameters:
              __isArgsStory: false
              __id: foo-bar--basic
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('exclude stories', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', excludeStories: ['B', 'C'] };
          export const A = () => {};
          export const B = (args) => {};
          export const C = () => {};
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          excludeStories:
            - B
            - C
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('include stories', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', includeStories: ['IncludeA'] };
          export const SomeHelper = () => {};
          export const IncludeA = () => {};
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          includeStories:
            - IncludeA
        stories:
          - id: foo-bar--include-a
            name: Include A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('storyName annotation', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = () => {};
          A.storyName = 'Some story';
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: Some story
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('no title', () => {
      expect(
        parse(
          dedent`
          export default { component: 'foo' }
          export const A = () => {};
          export const B = () => {};
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          component: '''foo'''
          title: Default Title
        stories:
          - id: default-title--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: default-title--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('custom component id', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', id: 'custom-id' };
          export const A = () => {};
          export const B = () => {};
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          id: custom-id
        stories:
          - id: custom-id--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: custom-id--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('custom parameters.__id', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', id: 'custom-meta-id' };
          export const JustCustomMetaId = {};
          export const CustomParemetersId = { parameters: { __id: 'custom-id' } };
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          id: custom-meta-id
        stories:
          - id: custom-meta-id--just-custom-meta-id
            name: Just Custom Meta Id
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
          - id: custom-id
            name: Custom Paremeters Id
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('typescript', () => {
      expect(
        parse(
          dedent`
          import type { Meta, StoryFn } from '@storybook/react';
          type PropTypes = {};
          export default { title: 'foo/bar/baz' } as Meta<PropTypes>;
          export const A: StoryFn<PropTypes> = () => <>A</>;
          export const B: StoryFn<PropTypes> = () => <>B</>;
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar/baz
        stories:
          - id: foo-bar-baz--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: foo-bar-baz--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('typescript satisfies', () => {
      expect(
        parse(
          dedent`
          import type { Meta, StoryFn, StoryObj } from '@storybook/react';
          type PropTypes = {};
          export default { title: 'foo/bar' } satisfies Meta<PropTypes>;
          export const A = { name: 'AA' } satisfies StoryObj<PropTypes>;
          export const B = ((args) => {}) satisfies StoryFn<PropTypes>;
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: AA
            parameters:
              __isArgsStory: true
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
          - id: foo-bar--b
            name: B
            parameters:
              __isArgsStory: true
              __id: foo-bar--b
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('typescript as', () => {
      expect(
        parse(
          dedent`
          import type { Meta, StoryFn, StoryObj } from '@storybook/react';
          type PropTypes = {};
          export default { title: 'foo/bar' } as Meta<PropTypes>;
          export const A = { name: 'AA' } as StoryObj<PropTypes>;
          export const B = ((args) => {}) as StoryFn<PropTypes>;
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: AA
            parameters:
              __isArgsStory: true
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
          - id: foo-bar--b
            name: B
            parameters:
              __isArgsStory: true
              __id: foo-bar--b
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('typescript meta var', () => {
      expect(
        parse(
          dedent`
          import type { Meta, StoryFn } from '@storybook/react';
          type PropTypes = {};
          const meta = { title: 'foo/bar/baz' } as Meta<PropTypes>;
          export default meta;
          export const A: StoryFn<PropTypes> = () => <>A</>;
          export const B: StoryFn<PropTypes> = () => <>B</>;
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar/baz
        stories:
          - id: foo-bar-baz--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: foo-bar-baz--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('typescript satisfies meta var', () => {
      expect(
        parse(
          dedent`
          import type { Meta, StoryFn } from '@storybook/react';
          type PropTypes = {};
          const meta = { title: 'foo/bar/baz' } satisfies Meta<PropTypes>;
          export default meta;
          export const A: StoryFn<PropTypes> = () => <>A</>;
          export const B: StoryFn<PropTypes> = () => <>B</>;
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar/baz
        stories:
          - id: foo-bar-baz--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: foo-bar-baz--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('component object', () => {
      expect(
        parse(
          dedent`
          export default { component: {} }
          export const A = () => {};
          export const B = () => {};
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          component: '{}'
          title: Default Title
        stories:
          - id: default-title--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: default-title--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('template bind', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          const Template = (args) => { };
          export const A = Template.bind({});
          A.args = { x: 1 };
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: true
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('meta variable', () => {
      expect(
        parse(
          dedent`
          const meta = { title: 'foo/bar' };
          export default meta;
          export const A = () => {}
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: false
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('docs-only story', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const __page = () => {};
          __page.parameters = { docsOnly: true };
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--page
            name: Page
            parameters:
              __isArgsStory: false
              __id: foo-bar--page
              docsOnly: true
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('docs-only story with local vars', () => {
      expect(
        parse(
          dedent`
            export const TestControl = () => _jsx("p", {
              children: "Hello"
            });
            export default { title: 'foo/bar', includeStories: ["__page"] };
            export const __page = () => {};
            __page.parameters = { docsOnly: true };
          `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          includeStories:
            - __page
        stories:
          - id: foo-bar--page
            name: Page
            parameters:
              __isArgsStory: false
              __id: foo-bar--page
              docsOnly: true
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('title variable', () => {
      expect(
        parse(
          dedent`
            const title = 'foo/bar';
            export default { title };
            export const A = () => {};
            export const B = (args) => {};
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: false
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: foo-bar--b
            name: B
            parameters:
              __isArgsStory: true
              __id: foo-bar--b
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('re-exported stories', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export { default as A } from './A';
          export { B } from './B';
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
          - id: foo-bar--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('named exports order', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = () => {};
          export const B = (args) => {};
          export const __namedExportsOrder = ['B', 'A'];
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--b
            name: B
            parameters:
              __isArgsStory: true
              __id: foo-bar--b
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: false
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('as default export', () => {
      expect(
        parse(
          dedent`
          const meta = { title: 'foo/bar' };
          export const A = () => {};
          export {
            meta as default,
            A
          };
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('support for parameter decorators', () => {
      expect(
        parse(dedent`
        import { Component, Input, Output, EventEmitter, Inject, HostBinding } from '@angular/core';
        import { CHIP_COLOR } from './chip-color.token';

        @Component({
          selector: 'storybook-chip',
        })
        export class ChipComponent {
          // The error occurs on the Inject decorator used on a parameter
          constructor(@Inject(CHIP_COLOR) chipColor: string) {
            this.backgroundColor = chipColor;
          }
        }

        export default {
          title: 'Chip',
        }
      `)
      ).toMatchInlineSnapshot(`
        meta:
          title: Chip
        stories: []
      `);
    });
  });

  describe('error handling', () => {
    it('no meta', () => {
      expect(() =>
        parse(
          dedent`
          export const A = () => {};
          export const B = () => {};
      `
        )
      ).toThrow('CSF: missing default export');
    });

    it('bad meta', () => {
      expect(() =>
        parse(
          dedent`
          const foo = bar();
          export default foo;
          export const A = () => {};
          export const B = () => {};
      `
        )
      ).toThrow('CSF: default export must be an object');
    });

    it('no metadata', () => {
      expect(
        parse(
          dedent`
          export default { foo: '5' };
          export const A = () => {};
          export const B = () => {};
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: Default Title
        stories:
          - id: default-title--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: default-title--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });

    it('dynamic titles', () => {
      expect(() =>
        parse(
          dedent`
            export default { title: 'foo' + 'bar' };
            export const A = () => {};
        `,
          true
        )
      ).toThrow('CSF: unexpected dynamic title');
    });

    it('storiesOf calls', () => {
      expect(() =>
        parse(
          dedent`
            import { storiesOf } from '@storybook/react';
            export default { title: 'foo/bar' };
            export const A = () => {};
            storiesOf('foo').add('bar', () => <baz />);
        `,
          true
        )
      ).toThrow('Unexpected `storiesOf` usage:');
    });

    it('function exports', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export function A() {}
          export function B() {}
      `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
          - id: foo-bar--b
            name: B
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
      `);
    });
  });

  // NOTE: this does not have a public API, but we can still test it
  describe('indexed annotations', () => {
    it('meta annotations', () => {
      const input = dedent`
        export default { title: 'foo/bar', x: 1, y: 2 };
      `;
      const csf = loadCsf(input, { makeTitle }).parse();
      expect(Object.keys(csf._metaAnnotations)).toEqual(['title', 'x', 'y']);
    });

    it('story annotations', () => {
      const input = dedent`
        export default { title: 'foo/bar' };
        export const A = () => {};
        A.x = 1;
        A.y = 2;
        export const B = () => {};
        B.z = 3;
    `;
      const csf = loadCsf(input, { makeTitle }).parse();
      expect(Object.keys(csf._storyAnnotations.A)).toEqual(['x', 'y']);
      expect(Object.keys(csf._storyAnnotations.B)).toEqual(['z']);
    });

    it('v1-style story annotations', () => {
      const input = dedent`
        export default { title: 'foo/bar' };
        export const A = () => {};
        A.story = {
          x: 1,
          y: 2,
        }
        export const B = () => {};
        B.story = {
          z: 3,
        }
    `;
      const csf = loadCsf(input, { makeTitle }).parse();
      expect(Object.keys(csf._storyAnnotations.A)).toEqual(['x', 'y']);
      expect(Object.keys(csf._storyAnnotations.B)).toEqual(['z']);
    });
  });

  describe('CSF3', () => {
    it('Object export with no-args render', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            render: () => {}
          }
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: false
              __id: foo-bar--a
            __stats:
              play: false
              render: true
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('Object export with args render', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            render: (args) => {}
          }
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: true
              __id: foo-bar--a
            __stats:
              play: false
              render: true
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('Object export with default render', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {}
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            parameters:
              __isArgsStory: true
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('Object export with name', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            name: 'Apple'
          }
        `,
          true
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: Apple
            parameters:
              __isArgsStory: true
              __id: foo-bar--a
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });

    it('Object export with storyName', () => {
      const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => {});

      parse(
        dedent`
        export default { title: 'foo/bar' };
        export const A = {
          storyName: 'Apple'
        }
      `,
        true
      );

      expect(consoleWarnMock).toHaveBeenCalledWith(
        'Unexpected usage of "storyName" in "A". Please use "name" instead.'
      );
      consoleWarnMock.mockRestore();
    });
  });

  describe('import handling', () => {
    it('imports', () => {
      const input = dedent`
        import Button from './Button';
        import { Check } from './Check';
        export default { title: 'foo/bar', x: 1, y: 2 };
      `;
      const csf = loadCsf(input, { makeTitle }).parse();
      expect(csf.imports).toMatchInlineSnapshot(`
        - ./Button
        - ./Check
      `);
    });
    it.skip('dynamic imports', () => {
      const input = dedent`
        const Button = await import('./Button');
        export default { title: 'foo/bar', x: 1, y: 2 };
      `;
      const csf = loadCsf(input, { makeTitle }).parse();
      expect(csf.imports).toMatchInlineSnapshot();
    });
    it.skip('requires', () => {
      const input = dedent`
        const Button = require('./Button');
        export default { title: 'foo/bar', x: 1, y: 2 };
      `;
      const csf = loadCsf(input, { makeTitle }).parse();
      expect(csf.imports).toMatchInlineSnapshot();
    });
  });

  describe('tags', () => {
    it('csf2', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', tags: ['X'] };
          export const A = () => {};
          A.tags = ['Y'];
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
            tags:
              - 'Y'
      `);
    });

    it('csf3', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', tags: ['X'] };
          export const A = {
            render: () => {},
            tags: ['Y'],
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: true
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
            tags:
              - 'Y'
      `);
    });

    it('variables', () => {
      expect(
        parse(
          dedent`
          const x = ['X'];
          const y = ['Y'];
          export default { title: 'foo/bar', tags: x };
          export const A = {
            render: () => {},
            tags: y,
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: true
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
            tags:
              - 'Y'
      `);
    });

    it('array error', () => {
      expect(() =>
        parse(
          dedent`
            export default { title: 'foo/bar', tags: 'X' };
            export const A = {
              render: () => {},
            };
          `
        )
      ).toThrow('CSF: Expected tags array');
    });

    it('array element handling', () => {
      expect(() =>
        parse(
          dedent`
            export default { title: 'foo/bar', tags: [10] };
            export const A = {
              render: () => {},
            };
          `
        )
      ).toThrow('CSF: Expected tag to be string literal');
    });
  });

  describe('play functions', () => {
    it('story csf2', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', tags: ['X'] };
          export const A = () => {};
          A.play = () => {};
          A.tags = ['Y'];
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
            tags:
              - 'Y'
              - play-fn
      `);
    });

    it('story csf3', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', tags: ['X'] };
          export const A = {
            render: () => {},
            play: () => {},
            tags: ['Y'],
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: true
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
            tags:
              - 'Y'
              - play-fn
      `);
    });

    it('mount', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            play: ({ mount }) => {},
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: true
              moduleMock: false
            tags:
              - play-fn
      `);
    });

    it('mount renamed', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            play: ({ mount: mountRenamed, context }) => {},
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: true
              moduleMock: false
            tags:
              - play-fn
      `);
    });

    it('mount meta', () => {
      expect(
        parse(
          dedent`
          export default {
            title: 'foo/bar',
            play: ({ context, mount: mountRenamed }) => {},
          };
          export const A = {};
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - play-fn
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: true
              moduleMock: false
      `);
    });

    it('meta csf2', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', play: () => {}, tags: ['X'] };
          export const A = {
            render: () => {},
            loaders: [],
            tags: ['Y'],
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
            - play-fn
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: true
              loaders: true
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
            tags:
              - 'Y'
      `);
    });

    it('meta csf3', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar', play: () => {}, tags: ['X'] };
          export const A = () => {};
          A.tags = ['Y'];
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
          tags:
            - X
            - play-fn
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: true
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: true
              mount: false
              moduleMock: false
            tags:
              - 'Y'
      `);
    });
  });

  describe('index inputs', () => {
    it('generates index inputs', () => {
      const { indexInputs } = loadCsf(
        dedent`
      export default {
        id: 'component-id',
        title: 'custom foo title',
        tags: ['component-tag']
      };

      export const A = {
        play: () => {},
        tags: ['story-tag'],
      };

      export const B = {
        play: () => {},
        tags: ['story-tag'],
      };
    `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          exportName: A
          name: A
          title: custom foo title
          metaId: component-id
          tags:
            - component-tag
            - story-tag
            - play-fn
          __id: component-id--a
          __stats:
            play: true
            render: false
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
        - type: story
          importPath: foo/bar.stories.js
          exportName: B
          name: B
          title: custom foo title
          metaId: component-id
          tags:
            - component-tag
            - story-tag
            - play-fn
          __id: component-id--b
          __stats:
            play: true
            render: false
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });

    it('supports custom parameters.__id', () => {
      const { indexInputs } = loadCsf(
        dedent`
      export default {
        id: 'component-id',
        title: 'custom foo title',
        tags: ['component-tag']
      };

      export const A = {
        parameters: { __id: 'custom-story-id' }
      };
    `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          exportName: A
          name: A
          title: custom foo title
          metaId: component-id
          tags:
            - component-tag
          __id: custom-story-id
          __stats:
            play: false
            render: false
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });

    it('removes duplicate tags', () => {
      const { indexInputs } = loadCsf(
        dedent`
      export default {
        title: 'custom foo title',
        tags: ['component-tag', 'component-tag-dup', 'component-tag-dup', 'inherit-tag-dup']
      };

      export const A = {
        tags: ['story-tag', 'story-tag-dup', 'story-tag-dup', 'inherit-tag-dup']
      };
    `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          exportName: A
          name: A
          title: custom foo title
          tags:
            - component-tag
            - component-tag-dup
            - component-tag-dup
            - inherit-tag-dup
            - story-tag
            - story-tag-dup
            - story-tag-dup
            - inherit-tag-dup
          __id: custom-foo-title--a
          __stats:
            play: false
            render: false
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });

    it('throws if getting indexInputs without filename option', () => {
      const csf = loadCsf(
        dedent`
      export default {
        title: 'custom foo title',
        tags: ['component-tag', 'component-tag-dup', 'component-tag-dup', 'inherit-tag-dup']
      };

      export const A = {
        tags: ['story-tag', 'story-tag-dup', 'story-tag-dup', 'inherit-tag-dup']
      };
    `,
        { makeTitle }
      ).parse();

      expect(() => csf.indexInputs).toThrowErrorMatchingInlineSnapshot(`
        [Error: Cannot automatically create index inputs with CsfFile.indexInputs because the CsfFile instance was created without a the fileName option.
        Either add the fileName option when creating the CsfFile instance, or create the index inputs manually.]
      `);
    });
  });

  describe('componenent paths', () => {
    it('no component', () => {
      const { indexInputs } = loadCsf(
        dedent`
          import { Component } from '../src/Component.js';
          export default {
            title: 'custom foo title',
          };

          export const A = {
            render: () => {},
          };
        `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          exportName: A
          name: A
          title: custom foo title
          tags: []
          __id: custom-foo-title--a
          __stats:
            play: false
            render: true
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });

    it('local component', () => {
      const { indexInputs } = loadCsf(
        dedent`
          const Component = (props) => <div>hello</div>;
          
          export default {
            title: 'custom foo title',
            component: Component,
          };

          export const A = {
            render: () => {},
          };
        `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          exportName: A
          name: A
          title: custom foo title
          tags: []
          __id: custom-foo-title--a
          __stats:
            play: false
            render: true
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });

    it('imported component from file', () => {
      const { indexInputs } = loadCsf(
        dedent`
          import { Component } from '../src/Component.js';
          export default {
            title: 'custom foo title',
            component: Component,
          };

          export const A = {
            render: () => {},
          };
        `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          rawComponentPath: ../src/Component.js
          exportName: A
          name: A
          title: custom foo title
          tags: []
          __id: custom-foo-title--a
          __stats:
            play: false
            render: true
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });

    it('imported component from library', () => {
      const { indexInputs } = loadCsf(
        dedent`
          import { Component } from 'some-library';
          export default {
            title: 'custom foo title',
            component: Component,
          };

          export const A = {
            render: () => {},
          };
        `,
        { makeTitle, fileName: 'foo/bar.stories.js' }
      ).parse();

      expect(indexInputs).toMatchInlineSnapshot(`
        - type: story
          importPath: foo/bar.stories.js
          rawComponentPath: some-library
          exportName: A
          name: A
          title: custom foo title
          tags: []
          __id: custom-foo-title--a
          __stats:
            play: false
            render: true
            loaders: false
            beforeEach: false
            globals: false
            storyFn: false
            mount: false
            moduleMock: false
      `);
    });
  });

  describe('beforeEach', () => {
    it('basic', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            beforeEach: async () => {},
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: true
              globals: false
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });
  });

  describe('globals', () => {
    it('basic', () => {
      expect(
        parse(
          dedent`
          export default { title: 'foo/bar' };
          export const A = {
            globals: { foo: 'bar' }
          };
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: true
              storyFn: false
              mount: false
              moduleMock: false
      `);
    });
  });

  describe('module mocks', () => {
    it('alias', () => {
      expect(
        parse(
          dedent`
          import foo from '#bar.mock';
          export default { title: 'foo/bar' };
          export const A = {};
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: true
      `);
    });
    it('relative', () => {
      expect(
        parse(
          dedent`
          import foo from './bar.mock';
          export default { title: 'foo/bar' };
          export const A = {};
        `
        )
      ).toMatchInlineSnapshot(`
        meta:
          title: foo/bar
        stories:
          - id: foo-bar--a
            name: A
            __stats:
              play: false
              render: false
              loaders: false
              beforeEach: false
              globals: false
              storyFn: false
              mount: false
              moduleMock: true
      `);
    });
  });
});

describe('isModuleMock', () => {
  it('prefix', () => {
    expect(isModuleMock('#foo.mock')).toBe(true);
    expect(isModuleMock('./foo.mock')).toBe(true);
    expect(isModuleMock('../foo.mock')).toBe(true);
    expect(isModuleMock('/foo.mock')).toBe(true);

    expect(isModuleMock('foo.mock')).toBe(false);
    expect(isModuleMock('@/foo.mock')).toBe(false);
  });
  it('sufixes', () => {
    expect(isModuleMock('#foo.mock.js')).toBe(true);
    expect(isModuleMock('#foo.mock.mjs')).toBe(true);
    expect(isModuleMock('#foo.mock.vue')).toBe(true);

    expect(isModuleMock('#foo.mocktail')).toBe(false);
    expect(isModuleMock('#foo.mock.test.ts')).toBe(false);
  });
});

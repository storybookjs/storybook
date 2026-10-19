import { describe, expect, it } from 'vitest';

import { recast } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { babelParseFile, loadCsf } from '../CsfFile.ts';
import { authoredSource } from './authored-source.ts';
import { resolveEffectiveRender } from './render.ts';
import { isSelfContained } from './resolve-arg-value.ts';
import { sourceOf } from './resolve-members.ts';
import { createStoryArgsResolver } from './resolve-story-args.ts';
import { rebaseSpecifier, resolveSpreadMeta } from './spread-meta.ts';

const BASE = dedent`
  import { Button } from './button';
  import { Icon } from '../icons/icon';
  import { fn } from 'storybook/test';

  const meta = {
    title: 'Button',
    component: Button,
    args: { label: 'Base', icon: Icon, onClick: fn() },
    render: (args) => <Button {...args} />,
  };
  export default meta;
`;

/** A story file in `/stories/interactions`, beside virtual modules keyed by absolute path. */
const storyFile = (
  code: string,
  modules: Record<string, string> = { '/stories/base.stories': BASE }
) => {
  const csf = loadCsf(dedent(code), {
    fileName: '/stories/interactions/x.stories.tsx',
    makeTitle: (title) => title ?? 'title',
  }).parse();
  const resolver = createStoryArgsResolver(csf, {
    filePath: '/stories/interactions/x.stories.tsx',
    externalize: (node) => (isSelfContained(node) ? node : undefined),
    resolveModule: (fromFile, specifier) => {
      const filePath = rebaseSpecifier(specifier, fromFile, '/x').replace(/^\./, '');
      const code = modules[filePath];
      return code === undefined
        ? undefined
        : { program: babelParseFile({ code, filename: filePath }).path, filePath };
    },
  });
  return { csf, resolver };
};

describe('resolveSpreadMeta', () => {
  it('reads the meta of the story file a meta spreads first', () => {
    const { csf, resolver } = storyFile(`
      import meta from '../base.stories';
      export default { ...meta, title: 'Button/Interactions' };
      export const A = {};
    `);
    const spread = resolveSpreadMeta(csf, resolver.ctx);
    expect(spread?.ctx.filePath).toBe('/stories/base.stories');
    expect(sourceOf(spread!.own)).toBe("{ title: 'Button/Interactions' }");
  });

  it.each([
    ['a spread after a member', `export default { title: 'T', ...meta };`],
    ['two spreads', `export default { ...meta, ...other };`],
  ])('reads nothing for %s', (_, meta) => {
    const { csf, resolver } = storyFile(`
      import meta from '../base.stories';
      import other from '../other.stories';
      ${meta}
      export const A = {};
    `);
    expect(resolveSpreadMeta(csf, resolver.ctx)).toBeUndefined();
  });
});

describe('a story file whose meta spreads another story file meta', () => {
  it('merges the args of that meta, with the imports they need written from the story file', () => {
    const { resolver } = storyFile(`
      import meta from '../base.stories';
      export default { ...meta, title: 'Button/Interactions' };
      export const A = { args: { label: 'A' } };
    `);
    const { args, imports, unresolved } = resolver.resolve('A');
    expect(
      Object.fromEntries(Object.entries(args).map(([key, node]) => [key, sourceOf(node)]))
    ).toEqual({ label: "'A'", icon: 'Icon', onClick: 'fn()' });
    expect(imports).toEqual([
      { localImportName: 'Icon', importId: '../../icons/icon', importName: 'Icon' },
      { localImportName: 'fn', importId: 'storybook/test', importName: 'fn' },
    ]);
    expect(unresolved).toEqual([]);
  });

  it('reports a meta arg whose import the story file binds to something else', () => {
    const { resolver } = storyFile(`
      import meta from '../base.stories';
      import { Icon } from './other-icon';
      export default { ...meta, title: 'Button/Interactions' };
      export const A = { args: { other: Icon } };
    `);
    const { imports, unresolved } = resolver.resolve('A');
    expect(imports.filter((ref) => ref.localImportName === 'Icon')).toEqual([
      { localImportName: 'Icon', importId: './other-icon', importName: 'Icon' },
    ]);
    expect(unresolved).toEqual(['Icon']);
  });

  it('renders with the render of that meta, read in its file', () => {
    const { csf, resolver } = storyFile(`
      import meta from '../base.stories';
      export default { ...meta, title: 'Button/Interactions' };
      export const A = {};
    `);
    const render = resolveEffectiveRender(csf, 'A', resolver.ctx);
    expect(render.kind === 'resolved' && recast.print(render.path.node).code).toBe(
      '(args) => <Button {...args} />'
    );
  });

  it('renders with a render the story file meta writes over it', () => {
    const { csf, resolver } = storyFile(`
      import meta from '../base.stories';
      export default { ...meta, render: () => 'own' };
      export const A = {};
    `);
    const render = resolveEffectiveRender(csf, 'A', resolver.ctx);
    expect(render.kind === 'resolved' && recast.print(render.path.node).code).toBe(`() => 'own'`);
  });
});

describe('the meta members of a story file whose meta spreads another story file meta', () => {
  const OTHER = dedent`
    const Template = (args) => ({ template: '<base-button></base-button>' });
    const code = '<base-button></base-button>';
    export default {
      component: 'base-button',
      render: Template,
      parameters: { docs: { source: { code } } },
      tags: ['autodocs'],
    };
  `;
  const resolveA = () => {
    const { resolver } = storyFile(
      `
        import meta from '../base.stories';
        const Template = (args) => ({ template: '<story-button></story-button>' });
        const code = '<story-button></story-button>';
        export default { ...meta, title: 'Button/Interactions' };
        export const A = { render: Template, parameters: { docs: { source: { code } } } };
      `,
      { '/stories/base.stories': OTHER }
    );
    return { resolved: resolver.resolve('A'), ctx: resolver.ctx };
  };

  it('shadows a member whose value names something, as it would be read in the wrong file', () => {
    const { metaMembers } = resolveA().resolved;
    expect(metaMembers.shadowed.sort()).toEqual(['parameters', 'render']);
    expect(Object.keys(metaMembers.properties)).toContain('tags');
  });

  it('reads no authored source from such a member', () => {
    const { resolved, ctx } = resolveA();
    expect(authoredSource({ ...resolved, storyMembers: resolved.metaMembers }, ctx)).toEqual({
      kind: 'unresolvable',
      source: '{ docs: { source: { code } } }',
    });
  });
});

describe('rebaseSpecifier', () => {
  it('writes a relative specifier from another directory, and leaves a package as it is', () => {
    expect(rebaseSpecifier('./button.vue', '/a/b/x.ts', '/a/b/c/y.ts')).toBe('../button.vue');
    expect(rebaseSpecifier('../icon', '/a/b/x.ts', '/a/b/y.ts')).toBe('../icon');
    expect(rebaseSpecifier('./icon', '/a/b/x.ts', '/a/y.ts')).toBe('./b/icon');
    expect(rebaseSpecifier('@/icon', '/a/b/x.ts', '/a/y.ts')).toBe('@/icon');
  });
});

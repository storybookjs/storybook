import { describe, expect, it } from 'vitest';

import type { types as t } from 'storybook/internal/babel';
import { type NodePath, recast } from 'storybook/internal/babel';

import { dedent } from 'ts-dedent';

import { loadCsf } from '../CsfFile.ts';
import { resolveRenderFunction } from './render.ts';
import { normalizeStoryDeclaration } from './normalize-story.ts';

/** Resolves `render` on story `A`, the way a snippet generator would. */
const resolveStoryRender = (code: string) => {
  const source = `export default { title: 'T' };\n${dedent(code)}`;
  const csf = loadCsf(source, { makeTitle: (title) => title ?? 'title' }).parse();
  const declaration = csf._storyDeclarationPath['A'];
  const normalized = normalizeStoryDeclaration(declaration);
  const properties: NodePath<t.ObjectProperty>[] =
    normalized.type === 'config'
      ? normalized.path.get('properties').filter((p) => p.isObjectProperty())
      : [];

  return resolveRenderFunction(properties, declaration);
};

const printedBody = (resolution: ReturnType<typeof resolveStoryRender>) =>
  resolution.kind === 'resolved' ? recast.print(resolution.path.node).code : undefined;

describe('resolveRenderFunction', () => {
  it('reports a story with no render property as missing', () => {
    expect(resolveStoryRender(`export const A = { args: {} };`)).toEqual({ kind: 'missing' });
  });

  it('resolves an inline arrow function', () => {
    expect(printedBody(resolveStoryRender(`export const A = { render: () => 1 };`))).toBe(
      '() => 1'
    );
  });

  it('follows an identifier to a local arrow function', () => {
    expect(
      printedBody(
        resolveStoryRender(`
          const Template = () => 1;
          export const A = { render: Template };
        `)
      )
    ).toBe('() => 1');
  });

  it('follows an identifier to a local function declaration', () => {
    expect(
      printedBody(
        resolveStoryRender(`
          function Template() { return 1; }
          export const A = { render: Template };
        `)
      )
    ).toBe('function Template() { return 1; }');
  });

  // The distinction that matters: an unreadable render is not the same as no render, because a
  // caller may only fall back to the meta's render in the second case.
  it('reports an identifier it cannot follow as unresolved rather than missing', () => {
    expect(resolveStoryRender(`export const A = { render: ImportedTemplate };`)).toEqual({
      kind: 'unresolved',
    });
  });

  it('reports an identifier bound to a non-function as unresolved', () => {
    expect(
      resolveStoryRender(`
        const Template = 'not a function';
        export const A = { render: Template };
      `)
    ).toEqual({ kind: 'unresolved' });
  });

  it('throws when render is present but is not a function at all', () => {
    expect(() => resolveStoryRender(`export const A = { render: { nested: true } };`)).toThrow(
      /Expected render to be an arrow function or function expression/
    );
  });
});

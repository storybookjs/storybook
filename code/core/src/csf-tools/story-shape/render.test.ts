import { describe, expect, it } from 'vitest';

import { recast } from 'storybook/internal/babel';

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

  return resolveRenderFunction(
    normalized.type === 'config' ? normalized.path : undefined,
    declaration
  );
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

  it('resolves the render method shorthand', () => {
    expect(
      printedBody(resolveStoryRender(`export const A = { render(args) { return 1; } };`))
    ).toBe('render(args) { return 1; }');
  });

  it('reports a render getter as unresolved, since its value is what it returns', () => {
    expect(resolveStoryRender(`export const A = { get render() { return () => 1; } };`)).toEqual({
      kind: 'unresolved',
    });
  });

  it('reports a render generator method as unresolved', () => {
    expect(resolveStoryRender(`export const A = { *render() { yield 1; } };`)).toEqual({
      kind: 'unresolved',
    });
  });

  it('resolves duplicate render keys to the last occurrence, matching the runtime', () => {
    expect(
      printedBody(resolveStoryRender(`export const A = { render: () => 1, render: () => 2 };`))
    ).toBe('() => 2');
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

  // At runtime `{ render: fn, ...base }` runs base.render when the spread carries one, so the
  // explicit property cannot be trusted, but it stays available as the best static guess.
  it('reports a render shadowed by a later spread as unresolved, carrying the shadowed function', () => {
    const resolution = resolveStoryRender(`
      const base = {};
      export const A = { render: () => 1, ...base };
    `);
    expect(resolution.kind).toBe('unresolved');
    expect(
      resolution.kind === 'unresolved' && resolution.shadowedRender
        ? recast.print(resolution.shadowedRender.node).code
        : undefined
    ).toBe('() => 1');
  });

  it('resolves a render preceded by a spread, which it overrides at runtime', () => {
    expect(
      printedBody(
        resolveStoryRender(`
          const base = {};
          export const A = { ...base, render: () => 1 };
        `)
      )
    ).toBe('() => 1');
  });

  it('reports a missing render as unresolved when a spread could be supplying one', () => {
    expect(
      resolveStoryRender(`
        const base = {};
        export const A = { ...base, args: {} };
      `)
    ).toEqual({ kind: 'unresolved' });
  });

  it('throws when render is present but is not a function at all', () => {
    expect(() => resolveStoryRender(`export const A = { render: { nested: true } };`)).toThrow(
      /Expected render to be an arrow function or function expression/
    );
  });
});

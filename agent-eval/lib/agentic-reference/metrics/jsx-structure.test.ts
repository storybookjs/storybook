import { describe, expect, it } from 'vitest';

import { jsxStructureForSource } from './jsx-structure.ts';

const NOTHING = { jsxLength: 0, jsxBindings: 0, jsxDepthTotal: 0, jsxTrees: 0 };

describe('jsxStructureForSource', () => {
  it('returns zeros for non-script files and JSX-free source', () => {
    expect(jsxStructureForSource('a.md', '# hi')).toEqual(NOTHING);
    expect(jsxStructureForSource('a.ts', 'function a(x){ return x ? 1 : 0; }')).toEqual(NOTHING);
  });

  it('counts tags, but not fragments, toward length', () => {
    expect(jsxStructureForSource('a.tsx', 'const C = () => <><a/><b/></>;')).toEqual({
      jsxLength: 2,
      jsxBindings: 0,
      // the fragment still counts as a level: its children are read indented
      jsxDepthTotal: 2,
      jsxTrees: 1,
    });
  });

  it('counts props, spreads and expression children as bindings', () => {
    const source = 'const C = ({ name, ...rest }) => <div {...rest} id="x">{name}</div>;';
    expect(jsxStructureForSource('a.tsx', source)).toEqual({
      jsxLength: 1,
      jsxBindings: 3,
      jsxDepthTotal: 1,
      jsxTrees: 1,
    });
  });

  it('does not count static text or comment-only containers', () => {
    const source = 'const C = () => <div>hello {/* note */}</div>;';
    expect(jsxStructureForSource('a.tsx', source).jsxBindings).toBe(0);
  });

  it('extends a tree through attribute markup', () => {
    expect(jsxStructureForSource('a.tsx', 'const C = () => <Tooltip content={<Info/>}/>;')).toEqual(
      {
        jsxLength: 2,
        jsxBindings: 1,
        // Info renders inside Tooltip, so it is depth 2 of one tree
        jsxDepthTotal: 2,
        jsxTrees: 1,
      }
    );
  });

  it('extends a tree through an inline callback', () => {
    const source = 'const C = (items) => <ul>{items.map((item) => <li/>)}</ul>;';
    expect(jsxStructureForSource('a.tsx', source)).toEqual({
      jsxLength: 2,
      jsxBindings: 1,
      jsxDepthTotal: 2,
      jsxTrees: 1,
    });
  });

  it('counts each unnested root as its own tree, so depth can average', () => {
    const source = [
      'const A = () => <div><span>hi</span></div>;',
      'const B = () => <p>text</p>;',
    ].join('\n');
    expect(jsxStructureForSource('a.tsx', source)).toEqual({
      jsxLength: 3,
      jsxBindings: 0,
      // depths 2 and 1: average 1.5 once divided by jsxTrees
      jsxDepthTotal: 3,
      jsxTrees: 2,
    });
  });

  it('starts a fresh tree in a named nested component', () => {
    const source = 'function P(){ const Inner = () => <li/>; return <ul/>; }';
    expect(jsxStructureForSource('a.tsx', source)).toEqual({
      jsxLength: 2,
      jsxBindings: 0,
      jsxDepthTotal: 2,
      jsxTrees: 2,
    });
  });

  it('does not throw on unparseable input', () => {
    expect(() =>
      jsxStructureForSource('a.tsx', 'const C = () => <div><span></div>;')
    ).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { complexityForSource } from './complexity-cyclomatic.ts';

describe('complexityForSource', () => {
  // --- the four tests carried over verbatim from storybookjs/storybook#35141 ---
  it('returns 1 for a function with no branches', () => {
    expect(complexityForSource('a.ts', 'function a(){ return 1; }')).toEqual([
      { name: 'a', complexity: 1 },
    ]);
  });

  it('adds 1 per if/for/while/case/&&/||/?', () => {
    const source = `function f(x:number){
      if (x>0 && x<10) return 1;
      for (let i=0;i<x;i++){}
      switch(x){ case 1: case 2: return 2; default: return 3; }
      return x ? 1 : 0;
    }`;
    // 1 base + if + && + for + 2 cases + ternary = 7. `i<x` is a comparison,
    // correctly not counted; `default:` is correctly not counted.
    expect(complexityForSource('f.ts', source)).toEqual([{ name: 'f', complexity: 7 }]);
  });

  it('finds arrow functions and methods', () => {
    const source = `
      export const g = (x:number)=> x>0 ? 1 : 0;
      class C { m(){ if(true){} } }
    `;
    const result = complexityForSource('f.ts', source).sort((a, b) => a.name.localeCompare(b.name));
    expect(result).toEqual([
      { name: 'C.m', complexity: 2 },
      { name: 'g', complexity: 2 },
    ]);
  });

  it('returns [] for non-JS/TS files', () => {
    expect(complexityForSource('readme.md', '# hi')).toEqual([]);
  });

  // --- regressions for the two defects fixed on port ---
  it('parses a generic arrow in .ts as a generic, not JSX', () => {
    const result = complexityForSource('a.ts', 'const identity = <T,>(value: T): T => value;');
    expect(result).toEqual([{ name: 'identity', complexity: 1 }]);
  });

  it('still parses JSX in .tsx', () => {
    const source = 'export const C = () => <div>{cond ? <a/> : <b/>}</div>;';
    expect(complexityForSource('a.tsx', source)).toEqual([{ name: 'C', complexity: 2 }]);
  });

  it('reports constructors, getters and setters as their own functions', () => {
    const source = `class C {
      constructor(x: number) { if (x) this.x = x; }
      get value() { return this.x ? 1 : 0; }
      set value(v: number) { this.x = v; }
    }`;
    const result = complexityForSource('a.ts', source).sort((a, b) => a.name.localeCompare(b.name));
    expect(result).toEqual([
      { name: 'C.constructor', complexity: 2 },
      { name: 'C.value', complexity: 2 },
      { name: 'C.value', complexity: 1 },
    ]);
  });

  it('does not double-count a nested function into its parent', () => {
    const source = `function outer(x: number) {
      if (x) {}
      function inner(y: number) { if (y) {} if (y > 1) {} }
      return inner;
    }`;
    const result = complexityForSource('a.ts', source).sort((a, b) => a.name.localeCompare(b.name));
    expect(result).toEqual([
      { name: 'inner', complexity: 3 },
      { name: 'outer', complexity: 2 },
    ]);
  });

  // --- inline-callback absorption (function-units.ts) ---
  it('absorbs an inline callback into the enclosing function, with no base of its own', () => {
    const source = 'function firstOdd(items){ return items.find((n) => n % 2 ? true : false); }';
    // one entry: base 1 + the callback's ternary
    expect(complexityForSource('a.ts', source)).toEqual([{ name: 'firstOdd', complexity: 2 }]);
  });

  it('keeps a name-bound arrow a unit of its own', () => {
    const source = 'function f(){ const pick = (x) => x ? 1 : 0; return pick; }';
    const result = complexityForSource('a.ts', source).sort((a, b) => a.name.localeCompare(b.name));
    expect(result).toEqual([
      { name: 'f', complexity: 1 },
      { name: 'pick', complexity: 2 },
    ]);
  });

  it('keeps a top-level callback, with nothing to absorb into, as a unit', () => {
    const source = "test('x', () => { if (a) b(); });";
    expect(complexityForSource('a.ts', source)).toEqual([{ name: '<anonymous>', complexity: 2 }]);
  });

  it('counts ?? alongside && and ||', () => {
    expect(complexityForSource('a.ts', 'function f(a,b){ return a ?? b; }')).toEqual([
      { name: 'f', complexity: 2 },
    ]);
  });

  it('returns [] rather than throwing on unparseable input', () => {
    expect(() => complexityForSource('a.ts', 'function ( { { {')).not.toThrow();
  });
});

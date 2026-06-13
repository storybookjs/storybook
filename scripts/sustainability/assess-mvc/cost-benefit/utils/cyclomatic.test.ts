import { describe, expect, it } from 'vitest';

import { complexityForSource } from './cyclomatic.ts';

describe('complexityForSource', () => {
  it('returns 1 for a function with no branches', () => {
    const src = `function a(){ return 1; }`;
    expect(complexityForSource('a.ts', src)).toEqual([{ name: 'a', complexity: 1 }]);
  });

  it('adds 1 per if/for/while/case/&&/||/?', () => {
    const src = `function f(x:number){
      if (x>0 && x<10) return 1;
      for (let i=0;i<x;i++){}
      switch(x){ case 1: case 2: return 2; default: return 3; }
      return x ? 1 : 0;
    }`;
    expect(complexityForSource('f.ts', src)).toEqual([{ name: 'f', complexity: 7 }]);
  });

  it('finds arrow functions and methods', () => {
    const src = `
      export const g = (x:number)=> x>0 ? 1 : 0;
      class C { m(){ if(true){} } }
    `;
    const result = complexityForSource('f.ts', src).sort((a, b) => a.name.localeCompare(b.name));
    expect(result).toEqual([
      { name: 'C.m', complexity: 2 },
      { name: 'g', complexity: 2 },
    ]);
  });

  it('returns [] for non-JS/TS files', () => {
    expect(complexityForSource('readme.md', '# hi')).toEqual([]);
  });
});

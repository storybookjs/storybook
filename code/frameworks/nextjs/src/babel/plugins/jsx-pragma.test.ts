import { types } from '@babel/core';
import { describe, expect, it, vi } from 'vitest';

const syntaxJsx = vi.hoisted(() => () => ({ name: 'syntax-jsx' }));
const jsxModule = vi.hoisted(() => ({ value: undefined as unknown }));

vi.mock('next/dist/compiled/babel/plugin-syntax-jsx.js', () => ({
  get default() {
    return jsxModule.value;
  },
}));

const loadJsxPragma = async () => {
  vi.resetModules();
  return (await import('./jsx-pragma.ts')).default;
};

describe('jsxPragma', () => {
  it('inherits the JSX syntax plugin when it is the default export (Next.js 15)', async () => {
    jsxModule.value = syntaxJsx;

    const jsxPragma = await loadJsxPragma();

    expect(jsxPragma({ types }).inherits).toBe(syntaxJsx);
  });

  it('inherits the JSX syntax plugin when the default export wraps it (Next.js 16.3)', async () => {
    jsxModule.value = { default: syntaxJsx };

    const jsxPragma = await loadJsxPragma();

    expect(jsxPragma({ types }).inherits).toBe(syntaxJsx);
  });
});

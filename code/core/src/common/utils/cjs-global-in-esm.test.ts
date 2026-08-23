import { describe, expect, it } from 'vitest';

import { CommonJsGlobalInEsmError } from 'storybook/internal/server-errors';

import { getCommonJsGlobalFromError, toCommonJsGlobalInEsmError } from './cjs-global-in-esm.ts';

describe('getCommonJsGlobalFromError', () => {
  it.each([
    ['__dirname is not defined', '__dirname'],
    ['__dirname is not defined in ES module scope', '__dirname'],
    ['__filename is not defined', '__filename'],
    ['require is not defined', 'require'],
  ])('extracts the global from %j', (message, expected) => {
    expect(getCommonJsGlobalFromError(new ReferenceError(message))).toBe(expected);
  });

  it('returns undefined for unrelated ReferenceErrors', () => {
    expect(getCommonJsGlobalFromError(new ReferenceError('foo is not defined'))).toBeUndefined();
  });

  it('returns undefined for non-ReferenceError errors', () => {
    expect(getCommonJsGlobalFromError(new TypeError('__dirname is not defined'))).toBeUndefined();
    expect(getCommonJsGlobalFromError('__dirname is not defined')).toBeUndefined();
  });
});

describe('toCommonJsGlobalInEsmError', () => {
  it('wraps a matching error and keeps the original as the cause data', () => {
    const original = new ReferenceError('__dirname is not defined');
    const wrapped = toCommonJsGlobalInEsmError(original, { location: '.storybook/main.ts' });

    expect(wrapped).toBeInstanceOf(CommonJsGlobalInEsmError);
    expect(wrapped?.data.global).toBe('__dirname');
    expect(wrapped?.data.error).toBe(original);
    expect(wrapped?.message).toContain('.storybook/main.ts');
    expect(wrapped?.message).toContain('import.meta.url');
  });

  it('names the hook when one is given', () => {
    const wrapped = toCommonJsGlobalInEsmError(new ReferenceError('__dirname is not defined'), {
      location: '.storybook/main.ts',
      hook: 'viteFinal',
    });

    expect(wrapped?.message).toContain('viteFinal');
  });

  it('stringifies a non-string location (e.g. a preset object)', () => {
    const wrapped = toCommonJsGlobalInEsmError(new ReferenceError('require is not defined'), {
      location: { name: 'addon-foo' },
    });

    expect(wrapped?.message).toContain(JSON.stringify({ name: 'addon-foo' }));
  });

  it('returns undefined for errors it should not wrap', () => {
    expect(
      toCommonJsGlobalInEsmError(new Error('something else'), { location: 'x' })
    ).toBeUndefined();
  });
});

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

  it('points at the source file from the stack when sourceExclude is set', () => {
    const error = new ReferenceError('__dirname is not defined in ES module scope');
    error.stack = [
      'ReferenceError: __dirname is not defined in ES module scope',
      `    at file://${process.cwd()}/.storybook/paths.ts:2:21`,
      '    at ModuleJob.run (node:internal/modules/esm/module_job:365:25)',
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [`${process.cwd()}/.storybook/main.tmp..ts`],
    });

    expect(wrapped?.message).toContain('.storybook/paths.ts');
  });

  it('falls back to the entry location when the only frame is excluded', () => {
    const error = new ReferenceError('__dirname is not defined in ES module scope');
    const temp = `${process.cwd()}/.storybook/main.tmp..ts`;
    error.stack = [
      'ReferenceError: __dirname is not defined in ES module scope',
      `    at file://${temp}:9:21`,
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [temp],
    });

    // The subject line uses the entry file, not the excluded temp copy (the raw stack in the
    // "Original error" block may still mention the temp path, so only check the subject).
    const subject = wrapped?.message.split('\n')[0];
    expect(subject).toContain('.storybook/main.ts');
    expect(subject).not.toContain('main.tmp');
  });

  it('keeps the entry location when sourceExclude is not given', () => {
    const error = new ReferenceError('__dirname is not defined in ES module scope');
    error.stack = [
      'ReferenceError: __dirname is not defined in ES module scope',
      `    at file://${process.cwd()}/.storybook/paths.ts:2:21`,
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, { location: '.storybook/main.ts' });

    expect(wrapped?.message.split('\n')[0]).toContain('.storybook/main.ts');
  });

  it('ignores node_modules frames when resolving the source file', () => {
    const error = new ReferenceError('__dirname is not defined in ES module scope');
    error.stack = [
      'ReferenceError: __dirname is not defined in ES module scope',
      `    at file://${process.cwd()}/node_modules/storybook/dist/loader.js:1:1`,
      `    at file://${process.cwd()}/.storybook/paths.ts:2:21`,
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [],
    });

    const subject = wrapped?.message.split('\n')[0];
    expect(subject).toContain('.storybook/paths.ts');
    expect(subject).not.toContain('node_modules');
  });

  it('returns undefined for errors it should not wrap', () => {
    expect(
      toCommonJsGlobalInEsmError(new Error('something else'), { location: 'x' })
    ).toBeUndefined();
  });
});

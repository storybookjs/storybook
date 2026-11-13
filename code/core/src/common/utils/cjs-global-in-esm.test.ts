import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(wrapped?.code).toBe(20);
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
      `    at ${pathToFileURL(resolve('.storybook/paths.ts')).href}:2:21`,
      '    at ModuleJob.run (node:internal/modules/esm/module_job:365:25)',
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [resolve('.storybook/main.tmp..ts')],
    });

    expect(wrapped?.message).toContain(join('.storybook', 'paths.ts'));
  });

  it('falls back to the entry location when the only frame is excluded', () => {
    const error = new ReferenceError('__dirname is not defined in ES module scope');
    const temp = resolve('.storybook/main.tmp..ts');
    error.stack = [
      'ReferenceError: __dirname is not defined in ES module scope',
      `    at ${pathToFileURL(temp).href}:9:21`,
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
      `    at ${pathToFileURL(resolve('.storybook/paths.ts')).href}:2:21`,
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, { location: '.storybook/main.ts' });

    expect(wrapped?.message.split('\n')[0]).toContain('.storybook/main.ts');
  });

  it('ignores node_modules frames when resolving the source file', () => {
    const error = new ReferenceError('__dirname is not defined in ES module scope');
    error.stack = [
      'ReferenceError: __dirname is not defined in ES module scope',
      `    at ${pathToFileURL(resolve('node_modules/storybook/dist/loader.js')).href}:1:1`,
      `    at ${pathToFileURL(resolve('.storybook/paths.ts')).href}:2:21`,
    ].join('\n');

    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [],
    });

    const subject = wrapped?.message.split('\n')[0];
    expect(subject).toContain(join('.storybook', 'paths.ts'));
    expect(subject).not.toContain('node_modules');
  });

  it('keeps a source directory whose name only ends with node_modules', () => {
    const error = new ReferenceError('__dirname is not defined');
    error.stack = [
      'ReferenceError: __dirname is not defined',
      `    at ${pathToFileURL(resolve('.storybook/my_node_modules/paths.ts')).href}:1:1`,
      `    at ${pathToFileURL(resolve('.storybook/other.ts')).href}:2:1`,
    ].join('\n');
    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [],
    });
    expect(wrapped?.data.location).toBe(join('.storybook', 'my_node_modules', 'paths.ts'));
  });

  it('excludes the temporary file before an encoded source URL', () => {
    const temp = resolve('.storybook/main.tmp..ts');
    const source = resolve('.storybook/paths #1.ts');
    const error = new ReferenceError('__dirname is not defined');
    error.stack = [
      `ReferenceError: __dirname is not defined`,
      `    at ${pathToFileURL(temp).href}:1:1`,
      `    at ${pathToFileURL(source).href}:2:1`,
    ].join('\n');
    const wrapped = toCommonJsGlobalInEsmError(error, {
      location: '.storybook/main.ts',
      sourceExclude: [temp],
    });
    expect(wrapped?.data.location).toBe(join('.storybook', 'paths #1.ts'));
  });

  describe.runIf(process.platform !== 'win32')(
    'with a literal backslash in the working directory',
    () => {
      let workingDir: string;

      beforeEach(() => {
        workingDir = resolve(String.raw`project\name`);
        vi.stubGlobal('process', { ...process, cwd: () => workingDir });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('selects the project source after a dependency frame', () => {
        const error = new ReferenceError('__dirname is not defined');
        error.stack = [
          'ReferenceError: __dirname is not defined',
          `    at ${pathToFileURL(resolve(workingDir, 'node_modules/loader.js')).href}:1:1`,
          `    at ${pathToFileURL(resolve(workingDir, '.storybook/paths.ts')).href}:2:1`,
        ].join('\n');
        const wrapped = toCommonJsGlobalInEsmError(error, {
          location: '.storybook/main.ts',
          sourceExclude: [],
        });
        expect(wrapped?.data.location).toBe('.storybook/paths.ts');
      });
    }
  );

  describe.runIf(process.platform !== 'win32')('with literal backslashes in POSIX paths', () => {
    it.each([
      String.raw`.storybook/paths\helper.ts`,
      String.raw`.storybook/node_modules\custom.ts`,
    ])('preserves the source filename %s', (source) => {
      const error = new ReferenceError('__dirname is not defined');
      error.stack = [
        'ReferenceError: __dirname is not defined',
        `    at ${pathToFileURL(resolve(source)).href}:1:1`,
        `    at ${pathToFileURL(resolve('.storybook/other.ts')).href}:2:1`,
      ].join('\n');
      const wrapped = toCommonJsGlobalInEsmError(error, {
        location: '.storybook/main.ts',
        sourceExclude: [],
      });
      expect(wrapped?.data.location).toBe(source);
    });

    it('does not exclude a different file with forward slashes', () => {
      const error = new ReferenceError('__dirname is not defined');
      error.stack = `ReferenceError: __dirname is not defined\n    at ${pathToFileURL(resolve('a/b/main.tmp..ts')).href}:1:1`;
      const wrapped = toCommonJsGlobalInEsmError(error, {
        location: '.storybook/main.ts',
        sourceExclude: [resolve(String.raw`a\b/main.tmp..ts`)],
      });
      expect(wrapped?.data.location).toBe('a/b/main.tmp..ts');
    });
  });

  it.runIf(process.platform === 'win32')(
    'keeps the first project frame when directory casing differs',
    () => {
      const error = new ReferenceError('__dirname is not defined');
      const source = resolve('.storybook/paths.ts');
      const differentCase =
        source === source.toLowerCase() ? source.toUpperCase() : source.toLowerCase();
      error.stack = [
        `ReferenceError: __dirname is not defined`,
        `    at ${pathToFileURL(differentCase).href}:1:1`,
        `    at ${pathToFileURL(resolve('.storybook/other.ts')).href}:2:1`,
      ].join('\n');
      const wrapped = toCommonJsGlobalInEsmError(error, {
        location: '.storybook/main.ts',
        sourceExclude: [],
      });
      expect(wrapped?.data.location.toLowerCase()).toBe(join('.storybook', 'paths.ts'));
    }
  );

  it.runIf(process.platform === 'win32')(
    'preserves the host of a source on another network share',
    () => {
      const error = new ReferenceError('__dirname is not defined');
      error.stack =
        'ReferenceError: __dirname is not defined\n    at file://storybook-test-host/share/paths.ts:1:1';
      const wrapped = toCommonJsGlobalInEsmError(error, {
        location: '.storybook/main.ts',
        sourceExclude: [],
      });
      expect(wrapped?.data.location).toBe(String.raw`\\storybook-test-host\share\paths.ts`);
    }
  );

  it('returns undefined for errors it should not wrap', () => {
    expect(
      toCommonJsGlobalInEsmError(new Error('something else'), { location: 'x' })
    ).toBeUndefined();
  });
});

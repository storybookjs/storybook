import os from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cleanPaths, sanitizeError } from './sanitize';

afterEach(() => {
  vi.restoreAllMocks();
});

describe(`Errors Helpers`, () => {
  describe(`sanitizeError`, () => {
    it(`Sanitizes ansi codes in error`, () => {
      const errorMessage = `\u001B[4mStorybook\u001B[0m`;
      let e: any;
      try {
        throw new Error(errorMessage);
      } catch (error) {
        e = error;
      }

      const sanitizedError = sanitizeError(e);

      expect(sanitizedError.message).toEqual('Storybook');
      expect(sanitizedError.stack).toContain('Error: Storybook');
    });

    it(`Sanitizes current path from error stacktraces`, () => {
      const errorMessage = `Test error message`;
      const mockCwd = `/Users/testuser/project`;
      const mockCwdSpy = vi.spyOn(process, `cwd`).mockImplementation(() => mockCwd);

      const e = {
        message: errorMessage,
        stack: `
          Error: Test error message
            at Object.<anonymous> (${mockCwd}/src/index.js:1:32)
            at Object.<anonymous> (${mockCwd}/node_modules/some-lib/index.js:1:69)
            at Module._compile (internal/modules/cjs/loader.js:736:30)
        `,
        name: 'Error',
      };

      expect(e).toBeDefined();
      expect(e.message).toEqual(errorMessage);
      expect(e.stack).toEqual(expect.stringContaining(mockCwd));

      const sanitizedError = sanitizeError(e as Error, '/');

      expect(sanitizedError.message).toEqual(errorMessage);
      expect(sanitizedError.stack).toEqual(expect.not.stringContaining(mockCwd));
      expect(sanitizedError.stack).toEqual(expect.stringContaining('$SNIP'));

      mockCwdSpy.mockRestore();
    });

    it(`Sanitizes a section of the current path from error stacktrace`, () => {
      const errorMessage = `this is a test`;

      const e = {
        message: errorMessage,
        stack: `
        Error: this is an error
          at Object.<anonymous> (/Users/username/Code/storybook-app/storybook-config.js:1:32)
          at Object.<anonymous> (/Users/username/Code/storybook-app/node_module/storybook-telemetry/blah.js:1:69)
          at Object.<anonymous> (/Users/username/Code/storybook-app/node_module/fake-path/index.js:1:41)
          at Object.<anonymous> (/Users/username/.fake-path/index.js:1:69)
          at Module._compile (internal/modules/cjs/loader.js:736:30)
          at Object.Module._extensions..js (internal/modules/cjs/loader.js:747:10)
          at Module.load (internal/modules/cjs/loader.js:628:32)
          at tryModuleLoad (internal/modules/cjs/loader.js:568:12)
          at Function.Module._load (internal/modules/cjs/loader.js:560:3)
          at Function.Module.runMain (internal/modules/cjs/loader.js:801:12)
          at executeUserCode (internal/bootstrap/node.js:526:15)
          at startMainThreadExecution (internal/bootstrap/node.js:439:3)
        `,
      };

      expect(e).toBeDefined();
      expect(e.message).toEqual(errorMessage);
      expect(e.stack).toBeDefined();

      const mockCwd = vi
        .spyOn(process, `cwd`)
        .mockImplementation(() => `/Users/username/Code/storybook-app`);

      expect(e.stack).toEqual(expect.stringContaining(`username`));

      const sanitizedError = sanitizeError(e as Error, `/`);

      expect(sanitizedError.message.includes(errorMessage)).toBe(true);
      expect(sanitizedError.stack).toEqual(expect.not.stringContaining(`username`));
      const result = sanitizedError.stack.match(/\$SNIP/g) as Array<string>;
      expect(result.length).toBe(4);

      mockCwd.mockRestore();
    });
  });
  describe(`cleanPaths`, () => {
    it.each([`storybook-config.js`, `src/pages/index.js`])(
      `should clean path on unix: %s`,
      (filePath) => {
        const cwdMockPath = `/Users/username/storybook-app`;
        const mockCwd = vi.spyOn(process, `cwd`).mockImplementation(() => cwdMockPath);

        const errorMessage = `Path 1 /Users/Username/storybook-app/${filePath} Path 2 /Users/username/storybook-app/${filePath}`;

        expect(cleanPaths(errorMessage, `/`)).toBe(
          `Path 1 $SNIP/${filePath} Path 2 $SNIP/${filePath}`
        );
        mockCwd.mockRestore();
      }
    );

    it.each([`storybook-config.js`, `src\\pages\\index.js`])(
      `should clean path on windows: %s`,
      (filePath) => {
        const cwdMockPath = `C:\\Users\\username\\storybook-app`;

        const mockCwd = vi.spyOn(process, `cwd`).mockImplementationOnce(() => cwdMockPath);

        const errorMessage = `Path 1 C:\\Users\\username\\storybook-app\\${filePath} Path 2 c:\\Users\\username\\storybook-app\\${filePath}`;
        expect(cleanPaths(errorMessage, `\\`)).toBe(
          `Path 1 $SNIP\\${filePath} Path 2 $SNIP\\${filePath}`
        );
        mockCwd.mockRestore();
      }
    );

    describe(`package manager caches and home paths`, () => {
      it(`should sanitize pnpm store under a different cwd`, () => {
        const input = `/home/sandbox/project/node_modules/.pnpm/@storybook+addon-docs@10.0.2_@types+react@19.2.2_esbuild@0.25.10_rollup@4.31.0_storyboo_7cb8a1f4d4ca81d0abdb0f0cfacb0423/node_modules/@storybook/addon-docs`;
        const separator = `/`;
        const homedir = `/home/sandbox`;
        const cwd = `/var/build`;
        const retainedSegment = `@storybook/addon-docs`;
        const forbidden = `sandbox`;

        vi.spyOn(process, `cwd`).mockImplementation(() => cwd);
        vi.spyOn(os, `homedir`).mockImplementation(() => homedir);

        const sanitized = cleanPaths(input, separator);
        expect(sanitized).toMatchInlineSnapshot(
          `"$SNIP/project/node_modules/.pnpm/@storybook+addon-docs@10.0.2_@types+react@19.2.2_esbuild@0.25.10_rollup@4.31.0_storyboo_7cb8a1f4d4ca81d0abdb0f0cfacb0423/node_modules/@storybook/addon-docs"`
        );

        expect(sanitized).toContain(`$SNIP`);
        expect(sanitized).toContain(retainedSegment);
        expect(sanitized.toLowerCase()).not.toContain(forbidden.toLowerCase());
        expect(sanitized.toLowerCase()).not.toContain(homedir.toLowerCase());
      });

      it(`should sanitize yarn berry cache in home`, () => {
        const input = `/home/foo/.yarn/berry/cache/@storybook-addon-interactions-npm-7.6.1-9e0ac1ff40-10.zip/node_modules/@storybook/addon-interactions`;
        const separator = `/`;
        const homedir = `/home/foo`;
        const cwd = `/workspace`;
        const retainedSegment = `@storybook/addon-interactions`;
        const forbidden = `foo`;

        vi.spyOn(process, `cwd`).mockImplementation(() => cwd);
        vi.spyOn(os, `homedir`).mockImplementation(() => homedir);

        const sanitized = cleanPaths(input, separator);

        expect(sanitized).toMatchInlineSnapshot(
          `"$SNIP/.yarn/berry/cache/@storybook-addon-interactions-npm-7.6.1-9e0ac1ff40-10.zip/node_modules/@storybook/addon-interactions"`
        );
        expect(sanitized).toContain(`$SNIP`);
        expect(sanitized).toContain(retainedSegment);
        expect(sanitized.toLowerCase()).not.toContain(forbidden.toLowerCase());
        expect(sanitized.toLowerCase()).not.toContain(homedir.toLowerCase());
      });

      it(`should sanitize node_modules path outside current cwd`, () => {
        const input = `/Users/foo/project/node_modules/@storybook/addon-links/dist/cjs/index.js`;
        const separator = `/`;
        const homedir = `/Users/foo`;
        const cwd = `/tmp/storybook`;
        const retainedSegment = `@storybook/addon-links`;
        const forbidden = `foo`;

        vi.spyOn(process, `cwd`).mockImplementation(() => cwd);
        vi.spyOn(os, `homedir`).mockImplementation(() => homedir);

        const sanitized = cleanPaths(input, separator);

        expect(sanitized).toMatchInlineSnapshot(
          `"$SNIP/project/node_modules/@storybook/addon-links/dist/cjs/index.js"`
        );
        expect(sanitized).toContain(`$SNIP`);
        expect(sanitized).toContain(retainedSegment);
        expect(sanitized.toLowerCase()).not.toContain(forbidden.toLowerCase());
        expect(sanitized.toLowerCase()).not.toContain(homedir.toLowerCase());
      });

      it(`should sanitize windows yarn berry cache with backslashes`, () => {
        const input = `C:\\Users\\Foo\\AppData\\Local\\Yarn\\Berry\\cache\\@storybook-addon-measure-npm-7.6.21-61d2a610cb-10.zip\\node_modules\\@storybook\\addon-measure`;
        const separator = `\\`;
        const homedir = `C:\\Users\\Foo`;
        const cwd = `C:\\build`;
        const retainedSegment = `@storybook\\addon-measure`;
        const forbidden = `Foo`;

        vi.spyOn(process, `cwd`).mockImplementation(() => cwd);
        vi.spyOn(os, `homedir`).mockImplementation(() => homedir);

        const sanitized = cleanPaths(input, separator);

        expect(sanitized).toMatchInlineSnapshot(
          `"$SNIP\\AppData\\Local\\Yarn\\Berry\\cache\\@storybook-addon-measure-npm-7.6.21-61d2a610cb-10.zip\\node_modules\\@storybook\\addon-measure"`
        );
        expect(sanitized).toContain(`$SNIP`);
        expect(sanitized).toContain(retainedSegment);
        expect(sanitized.toLowerCase()).not.toContain(forbidden.toLowerCase());
        expect(sanitized.toLowerCase()).not.toContain(homedir.toLowerCase());
      });

      it(`should sanitize windows path using forward slashes`, () => {
        const input = `/C:/Users/Foo/OneDrive%20-%20DFe%20Project/Desktop/library/node_modules/@storybook/addon-coverage`;
        const separator = `/`;
        const homedir = `C:/Users/Foo`;
        const cwd = `C:/build`;
        const retainedSegment = `@storybook/addon-coverage`;
        const forbidden = `Foo`;

        vi.spyOn(process, `cwd`).mockImplementation(() => cwd);
        vi.spyOn(os, `homedir`).mockImplementation(() => homedir);

        const sanitized = cleanPaths(input, separator);

        expect(sanitized).toMatchInlineSnapshot(
          `"/$SNIP/OneDrive%20-%20DFe%20Project/Desktop/library/node_modules/@storybook/addon-coverage"`
        );
        expect(sanitized).toContain(`$SNIP`);
        expect(sanitized).toContain(retainedSegment);
        expect(sanitized.toLowerCase()).not.toContain(forbidden.toLowerCase());
        expect(sanitized.toLowerCase()).not.toContain(homedir.toLowerCase());
      });
    });
  });
});

import { runInNewContext } from 'node:vm';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { join } from 'pathe';

import { getConfig } from './index.ts';
import type { OutputFile } from './utils/bundle.ts';
import { bundleManagerEntries } from './utils/bundle.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
// The real one writes a wrapper for each entry into the cache directory of the project.
vi.mock('./utils/managerEntries.ts', () => ({
  wrapManagerEntries: async (entries: string[]) => entries,
}));

const fixtures = join(import.meta.dirname, '__testfixtures__');

const bundle = async (entry: string, minify = false) => {
  const config = await getConfig({
    configDir: fixtures,
    outputDir: '/out',
    presets: {
      apply: async (name: string, fallback: unknown) =>
        name === 'managerEntries'
          ? [join(fixtures, entry)]
          : name === 'env'
            ? { NODE_ENV: 'test' }
            : fallback,
    },
  } as unknown as Options);
  return bundleManagerEntries(config, minify);
};

const run = (files: OutputFile[], globals: Record<string, unknown> = {}) => {
  const errors: unknown[][] = [];
  const context: Record<string, unknown> = {
    console: { error: (...args: unknown[]) => errors.push(args) },
    ...globals,
  };
  runInNewContext(files.find((file) => file.path.endsWith('.js'))!.contents, context);
  return { result: context.result, errors };
};

describe('bundleManagerEntries', () => {
  beforeEach(() => {
    vi.mocked(logger.warn).mockReset();
  });

  it('writes a script per entry into sb-addons', async () => {
    const files = await bundle('defines.js');

    expect(files.map((file) => file.path)).toEqual(['/out/sb-addons/__testfixtures__/defines.js']);
  });

  it('reads the modules the manager holds from their global variable', async () => {
    const { result } = run(await bundle('globals.js'), {
      __REACT__: { version: '18.3.1', useState: () => {} },
      __STORYBOOK_API__: { addons: { register: () => {} } },
    });

    expect(result).toEqual({
      version: '18.3.1',
      useState: 'function',
      required: 'function',
      register: 'function',
    });
  });

  it('compiles JSX in a .js file to React.createElement', async () => {
    const { result } = run(await bundle('jsx.js'), {
      __REACT__: { createElement: (...args: unknown[]) => args },
    });

    expect(result).toEqual(['div', { className: 'panel' }]);
  });

  it('replaces process.env and global', async () => {
    const { result } = run(await bundle('defines.js'), { window: {} });

    expect(result).toEqual({ env: 'test', global: 'object' });
  });

  it('bundles the CSS of an entry into one stylesheet next to its script', async () => {
    const files = await bundle('styles.js');
    const stylesheet = files.find((file) => file.path.endsWith('.css'))!;
    const { result } = run(files) as { result: { styles: { box: string }; box: string } };

    expect(stylesheet.path).toBe('/out/sb-addons/__testfixtures__/styles.css');
    expect(stylesheet.contents).toContain('.dep');
    expect(stylesheet.contents).not.toContain('@import');
    expect(stylesheet.contents).toContain('data:image/svg+xml;base64,');
    expect(stylesheet.contents).toContain(`.${result.box}`);
    expect(result.styles).toEqual({ box: result.box });
  });

  it('keeps an @import of a URL at the top of the stylesheet', async () => {
    const [, stylesheet] = await bundle('styles-remote.js');

    expect(stylesheet.contents).toMatchInlineSnapshot(`
      "@import url("https://fonts.example.com/css2?family=Inter:wght@400;700&display=swap");
      .dep {
        color: red;
      }
      "
    `);
  });

  it.each(['media', 'supports', 'layer'])(
    'fails on an @import of a URL with a %s condition',
    async (condition) => {
      await expect(bundle(`styles-remote-${condition}.js`)).rejects.toThrow(
        /the @import of https:\/\/fonts\.example\.com\/\w+\.css has a media query, supports\(\) or layer\(\)/
      );
    }
  );

  it('fails on a url() of a file it cannot inline', async () => {
    await expect(bundle('styles-unknown-file.js')).rejects.toThrow(
      'no loader is configured for ".bin" files'
    );
  });

  it('fails when an import cannot be resolved', async () => {
    await expect(bundle('unresolved.js')).rejects.toThrow(
      "Could not resolve 'a-package-that-is-not-installed'"
    );
  });

  it('only warns about an import() that cannot be resolved', async () => {
    await expect(bundle('optional.js')).resolves.toHaveLength(1);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not resolve 'a-package-that-is-not-installed'")
    );
  });

  it('gives a CommonJS dependency its module object, and other code an empty one', async () => {
    const { result } = run(await bundle('commonjs.js'));

    expect(result).toEqual({ dependency: { hasModule: true }, module: 'object' });
  });

  it('reads a constant as undefined before its module ran in an import cycle', async () => {
    const { result } = run(await bundle('cycle.js'));

    expect(result).toBe('B:undefined');
  });

  it('logs the URL of an entry that throws', async () => {
    const { errors } = run(await bundle('throws.js'));

    expect(errors).toEqual([
      [
        '[Storybook] One of your manager-entries failed: ./sb-addons/__testfixtures__/throws.js',
        expect.objectContaining({ message: 'boom' }),
      ],
    ]);
  });

  it('keeps license comments when it minifies', async () => {
    const files = await bundle('license.js', true);

    expect(files[0].contents).toContain('license of a dependency');
    expect(run(files).result).toBe('kept');
  });
});

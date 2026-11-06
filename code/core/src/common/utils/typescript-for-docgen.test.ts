import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import { type Options, SupportedRenderer } from 'storybook/internal/types';

import { fs as memfs, vol } from 'memfs';

import {
  BuilderDocgenPackagesMissingError,
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
import * as find from 'empathic/find';
import {
  checkBuilderDocgenPackages,
  getTypeScriptDocgenApi,
  getTypeScriptForDocgenError,
  getTypeScriptUpgradeForDocgen,
  isTypeScriptReadyForDocgen,
  loadTypeScriptCompilerApi,
  loadTypeScriptForDocgen,
  recommendedTypeScriptDocgenApis,
  typeScriptPackageForDocgen,
} from './typescript-for-docgen.ts';
import { loadMainConfig } from './load-main-config.ts';

vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./load-main-config.ts', { spy: true });
vi.mock('empathic/find', { spy: true });

const PACKAGE_JSON = '/project/node_modules/typescript/package.json';

const installTypeScript = (version: string) =>
  vol.fromNestedJSON({ [PACKAGE_JSON]: JSON.stringify({ name: 'typescript', version }) });

const resolveInstalled = () => pathToFileURL(PACKAGE_JSON).href;

const moduleNotFound = () =>
  Object.assign(new Error("Cannot find package 'typescript'"), { code: 'ERR_MODULE_NOT_FOUND' });

const resolveMissing = (): string => {
  throw moduleNotFound();
};

/** Resolve `typescript` like {@link resolveInstalled}, and only the other packages listed. */
const resolveWith =
  (packages: string[]) =>
  (specifier: string): string => {
    if (specifier === 'typescript/package.json') {
      return resolveInstalled();
    }
    if (packages.includes(specifier)) {
      return pathToFileURL(`/project/node_modules/${specifier}/index.js`).href;
    }
    throw moduleNotFound();
  };

const BOTH_APIS = ['compiler', 'native'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.mocked(fs.readFileSync).mockImplementation(memfs.readFileSync as typeof fs.readFileSync);
  // No lockfile and no package manager user agent: install hints use npm.
  vi.mocked(find.up).mockReturnValue(undefined);
  vi.stubEnv('npm_config_user_agent', '');
  // TypeScript 7.1 is stable for these tests unless a test says otherwise.
  vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTypeScriptDocgenApi', () => {
  it.each(['5.9.3', '6.0.3'])('TypeScript %s offers the compiler API', (version) => {
    expect(getTypeScriptDocgenApi(version)).toBe('compiler');
  });

  it.each(['7.0.0', '7.0.2'])('TypeScript %s offers no API', (version) => {
    expect(getTypeScriptDocgenApi(version)).toBeUndefined();
  });

  it.each(['7.1.0-beta', '7.1.0', '7.2.3', '8.0.0'])(
    'TypeScript %s offers the native API',
    (version) => {
      expect(getTypeScriptDocgenApi(version)).toBe('native');
    }
  );
});

describe('recommendedTypeScriptDocgenApis', () => {
  it('lets React docgen run on both APIs', () => {
    expect(recommendedTypeScriptDocgenApis(SupportedRenderer.REACT)).toEqual([
      'compiler',
      'native',
    ]);
  });

  it.each([
    SupportedRenderer.VUE3,
    SupportedRenderer.SVELTE,
    SupportedRenderer.WEB_COMPONENTS,
    SupportedRenderer.ANGULAR,
  ])('keeps %s docgen on the compiler API', (renderer) => {
    expect(recommendedTypeScriptDocgenApis(renderer)).toEqual(['compiler']);
  });
});

describe('getTypeScriptUpgradeForDocgen', () => {
  it('upgrades a typescript devDependency to TypeScript 7.1 for docgen on the native API', () => {
    expect(getTypeScriptUpgradeForDocgen(BOTH_APIS, { dependencies: {} })).toEqual({
      dependency: 'typescript@^7.1',
      type: 'devDependencies',
    });
  });

  it('upgrades typescript in dependencies where the project declares it', () => {
    expect(
      getTypeScriptUpgradeForDocgen(BOTH_APIS, { dependencies: { typescript: '~7.0.2' } })
    ).toEqual({ dependency: 'typescript@^7.1', type: 'dependencies' });
  });

  it('offers no upgrade for docgen on the compiler API', () => {
    expect(getTypeScriptUpgradeForDocgen(['compiler'], {})).toBeUndefined();
  });
});

describe('typeScriptPackageForDocgen', () => {
  it('adds TypeScript 7.1 when the native API is supported', () => {
    expect(typeScriptPackageForDocgen(BOTH_APIS)).toBe('typescript@^7.1');
  });

  it('adds TypeScript 6 for the compiler API', () => {
    expect(typeScriptPackageForDocgen(['compiler'])).toBe('typescript@^6');
    expect(typeScriptPackageForDocgen()).toBe('typescript@^6');
  });
});

describe('getTypeScriptForDocgenError', () => {
  it.each(['5.9.3', '6.0.3'])('accepts TypeScript %s', (version) => {
    installTypeScript(version);

    expect(getTypeScriptForDocgenError(resolveInstalled)).toBeUndefined();
  });

  it('reports a missing typescript package', () => {
    expect(getTypeScriptForDocgenError(resolveMissing)).toBeInstanceOf(
      TypeScriptMissingForDocgenError
    );
  });

  it('tells a project that supports the native API to add TypeScript 7.1', () => {
    const error = getTypeScriptForDocgenError(resolveMissing, { apis: BOTH_APIS });

    expect(error?.message).toContain('Add `typescript@^7.1` to the devDependencies');
  });

  it.each([
    ['without a version', JSON.stringify({ name: 'typescript' })],
    ['with a non-string version', JSON.stringify({ name: 'typescript', version: 6 })],
    ['that is not JSON', '{'],
  ])('reports a typescript package.json %s as missing', (_case, packageJson) => {
    vol.fromNestedJSON({ [PACKAGE_JSON]: packageJson });

    expect(getTypeScriptForDocgenError(resolveInstalled)).toBeInstanceOf(
      TypeScriptMissingForDocgenError
    );
  });

  it('reports TypeScript 7 with the side-by-side setup for its version', () => {
    installTypeScript('7.0.2');

    const error = getTypeScriptForDocgenError(resolveInstalled);

    expect(error).toBeInstanceOf(TypeScriptWithoutCompilerApiError);
    expect(error?.message).toContain('"@typescript/native": "npm:typescript@^7.0.2"');
    expect(error?.message).toContain('"typescript": "npm:@typescript/typescript6@^6.0.2"');
    expect(error?.message).toContain('Add `typescript@^6` to the devDependencies');
  });

  it('reports TypeScript 7.1 to a renderer on the compiler API', () => {
    installTypeScript('7.1.0');

    expect(getTypeScriptForDocgenError(resolveInstalled)).toBeInstanceOf(
      TypeScriptWithoutCompilerApiError
    );
  });

  it('accepts TypeScript 7.1 when the native API is supported', () => {
    installTypeScript('7.1.0-beta');

    expect(getTypeScriptForDocgenError(resolveInstalled, { apis: BOTH_APIS })).toBeUndefined();
  });

  it('tells a project that supports the native API to upgrade from TypeScript 7.0', () => {
    installTypeScript('7.0.2');

    const error = getTypeScriptForDocgenError(resolveInstalled, { apis: BOTH_APIS });

    expect(error).toBeInstanceOf(TypeScriptWithoutCompilerApiError);
    expect(error?.message).toContain('TypeScript 7.0 does not include an API');
    expect(error?.message).toContain('Upgrade to `typescript@^7.1`');
    expect(error?.message).not.toContain('@typescript/native');
  });
});

describe('isTypeScriptReadyForDocgen', () => {
  const options = {
    configDir: '/project/.storybook',
    presets: { apply: async () => ({}) } as unknown as Options['presets'],
  };

  beforeEach(() => {
    vi.mocked(once.warn).mockImplementation(() => {});
    vi.mocked(loadMainConfig).mockResolvedValue({ stories: [] });
  });

  it('warns with the fix when typescript cannot be used', async () => {
    await expect(isTypeScriptReadyForDocgen(resolveMissing, options)).resolves.toBe(false);
    expect(once.warn).toHaveBeenCalledWith(new TypeScriptMissingForDocgenError().message);
  });

  it('stays silent when typescript has the compiler API', async () => {
    installTypeScript('6.0.3');

    await expect(isTypeScriptReadyForDocgen(resolveInstalled, options)).resolves.toBe(true);
    expect(once.warn).not.toHaveBeenCalled();
  });

  describe('with a builder docgen fallback', () => {
    const fallback = {
      builderDocgenFallback: { packageName: 'react-docgen', range: '^8.0.2' },
    };

    beforeEach(() => {
      installTypeScript('7.0.2');
    });

    it('says that docgen falls back to an installed react-docgen', async () => {
      await isTypeScriptReadyForDocgen(resolveWith(['react-docgen']), options, fallback);

      expect(once.warn).toHaveBeenCalledOnce();
      expect(once.warn).toHaveBeenCalledWith(
        expect.stringContaining('falls back to the deprecated builder docgen with `react-docgen`')
      );
    });

    it('leaves the fallback out when the main config sets docgenServer: true', async () => {
      vi.mocked(loadMainConfig).mockResolvedValue({
        stories: [],
        features: { docgenServer: true },
      });

      await isTypeScriptReadyForDocgen(resolveWith([]), options, fallback);

      expect(once.warn).toHaveBeenCalledWith(
        new TypeScriptWithoutCompilerApiError({ version: '7.0.2' }).message
      );
    });

    it('only points at the TypeScript fix when react-docgen is not installed', async () => {
      await isTypeScriptReadyForDocgen(resolveWith([]), options, fallback);

      expect(once.warn).toHaveBeenCalledOnce();
      const [message] = vi.mocked(once.warn).mock.calls[0];
      expect(message).toContain('"typescript": "npm:@typescript/typescript6@^6.0.2"');
      expect(message).toContain('Controls and the Docs args table show no props');
      expect(message).not.toContain('react-docgen');
    });
  });

  it('stays silent on TypeScript 7.1 when the native API is supported', async () => {
    installTypeScript('7.1.0');

    await expect(
      isTypeScriptReadyForDocgen(resolveInstalled, options, { apis: BOTH_APIS })
    ).resolves.toBe(true);
    expect(once.warn).not.toHaveBeenCalled();
  });

  describe('when the main config sets docgenServer: false', () => {
    beforeEach(() => {
      vi.mocked(loadMainConfig).mockResolvedValue({
        stories: [],
        features: { docgenServer: false },
      });
    });

    it('stays silent although typescript cannot be used', async () => {
      await expect(isTypeScriptReadyForDocgen(resolveMissing, options)).resolves.toBe(false);
      expect(once.warn).not.toHaveBeenCalled();
    });
  });
});

describe('loadTypeScriptCompilerApi', () => {
  it('returns the default export of a TypeScript 6 module', async () => {
    const typescript = { version: '6.0.3', sys: {} };

    await expect(
      loadTypeScriptCompilerApi(async () => ({ ...typescript, default: typescript }))
    ).resolves.toBe(typescript);
  });

  it.each(['7.0.2', '7.1.0'])('rejects TypeScript %s', async (version) => {
    await expect(loadTypeScriptCompilerApi(async () => ({ version }))).rejects.toThrow(
      TypeScriptWithoutCompilerApiError
    );
  });

  it('rejects a missing typescript package', async () => {
    await expect(
      loadTypeScriptCompilerApi(async () => {
        throw moduleNotFound();
      })
    ).rejects.toThrow(TypeScriptMissingForDocgenError);
  });

  it('rethrows other import failures', async () => {
    const failure = new SyntaxError('Unexpected token');

    await expect(
      loadTypeScriptCompilerApi(async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
  });
});

describe('checkBuilderDocgenPackages', () => {
  const NATIVE_PACKAGE_DIR = '/project/node_modules/@typescript/native';
  let docgenSpecifier: string | undefined;
  const options = {
    configDir: '/project/.storybook',
    presets: { apply: async () => ({ docgenSpecifier }) } as unknown as Options['presets'],
  };
  const check = (
    installed: string[],
    packages: Record<string, string> = { 'react-docgen': '^8.0.2' },
    note?: string,
    apis?: readonly ('compiler' | 'native')[]
  ) =>
    checkBuilderDocgenPackages({
      packages,
      resolve: resolveWith(installed),
      options,
      builderDocgen: "typescript.reactDocgen: 'react-docgen'",
      disableBuilderDocgen: 'typescript.reactDocgen: false',
      documentation:
        'https://storybook.js.org/docs/api/main-config/main-config-typescript#reactdocgen',
      note,
      apis,
    });

  beforeEach(() => {
    docgenSpecifier = undefined;
    vi.mocked(once.warn).mockImplementation(() => {});
    vi.mocked(loadMainConfig).mockResolvedValue({ stories: [] });
    installTypeScript('6.0.3');
  });

  const pointDocgenSpecifierAtTypeScript = (version: string) => {
    docgenSpecifier = NATIVE_PACKAGE_DIR;
    vol.fromNestedJSON({
      [`${NATIVE_PACKAGE_DIR}/package.json`]: JSON.stringify({ name: 'typescript', version }),
    });
  };

  describe('when the main config sets docgenServer: false', () => {
    beforeEach(() => {
      vi.mocked(loadMainConfig).mockResolvedValue({
        stories: [],
        features: { docgenServer: false },
      });
    });

    it('warns about the deprecation when the packages are installed', async () => {
      await expect(check(['react-docgen'])).resolves.toEqual([]);
      expect(once.warn).toHaveBeenCalledOnce();
      expect(once.warn).toHaveBeenCalledWith(expect.stringContaining('is deprecated'));
    });

    it('throws with the install command when packages are missing', async () => {
      const packages = {
        '@joshwooding/vite-plugin-react-docgen-typescript': '^0.7.0 || ^0.9.0',
        'react-docgen-typescript': '^2.2.2',
      };

      const result = check([], packages, 'A renderer note.');

      await expect(result).rejects.toThrow(BuilderDocgenPackagesMissingError);
      await expect(result).rejects.toThrow(
        'npm install -D "@joshwooding/vite-plugin-react-docgen-typescript@^0.9.0" "react-docgen-typescript@^2.2.2"'
      );
      await expect(result).rejects.toThrow('typescript.reactDocgen: false');
      await expect(result).rejects.toThrow('A renderer note.');
      expect(once.warn).not.toHaveBeenCalled();
    });

    it('throws on TypeScript 7 too, and says the docgen server needs TypeScript 6', async () => {
      installTypeScript('7.0.2');

      await expect(check([])).rejects.toThrow('install `typescript@^6`');
    });

    it('says the docgen server needs TypeScript 7.1 when it runs on the native API', async () => {
      installTypeScript('7.0.2');

      await expect(check([], undefined, undefined, BOTH_APIS)).rejects.toThrow(
        'install `typescript@^7.1`'
      );
    });

    it('names the docgenSpecifier package when that is TypeScript 7.0', async () => {
      pointDocgenSpecifierAtTypeScript('7.0.2');

      await expect(check([], undefined, undefined, BOTH_APIS)).rejects.toThrow(
        `TypeScript 5.9, 6, or 7.1 and newer at \`${NATIVE_PACKAGE_DIR}\`, which \`typescript.docgenSpecifier\` names`
      );
    });

    it('tells a project on TypeScript 7.1 to remove the setting', async () => {
      installTypeScript('7.1.0');

      await expect(check([], undefined, undefined, BOTH_APIS)).rejects.toThrow(
        'Remove that setting to use server-side docgen'
      );
    });
  });

  it('stays silent when typescript is unusable, which the TypeScript warning covers', async () => {
    installTypeScript('7.0.2');

    await expect(check([])).resolves.toEqual(['react-docgen']);
    expect(once.warn).not.toHaveBeenCalled();
  });

  it('stays silent when the docgenSpecifier package is TypeScript 7.0, which the TypeScript warning covers', async () => {
    pointDocgenSpecifierAtTypeScript('7.0.2');

    await expect(check([], undefined, undefined, BOTH_APIS)).resolves.toEqual(['react-docgen']);
    expect(once.warn).not.toHaveBeenCalled();
  });

  it('warns when packages are missing although typescript is usable', async () => {
    await expect(check([])).resolves.toEqual(['react-docgen']);
    expect(once.warn).toHaveBeenCalledWith(expect.stringContaining('npm install -D'));
  });

  it('stays silent when the packages are installed', async () => {
    await expect(check(['react-docgen'])).resolves.toEqual([]);
    expect(once.warn).not.toHaveBeenCalled();
  });
});

describe('loadTypeScriptForDocgen', () => {
  const native = { sync: {}, ast: {} };

  it('loads the compiler API of TypeScript 6 without importing the native API', async () => {
    const typescript = { version: '6.0.3', sys: {} };
    const importNativeApi = vi.fn(async () => native);

    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ ...typescript, default: typescript }),
        importNativeApi,
      })
    ).resolves.toEqual({ api: 'compiler', typescript });
    expect(importNativeApi).not.toHaveBeenCalled();
  });

  it('loads the native API of TypeScript 7.1', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ version: '7.1.0-beta' }),
        importNativeApi: async () => native,
      })
    ).resolves.toEqual({ api: 'native', typescript: native });
  });

  it('rejects TypeScript 7.0 with the upgrade hint', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ version: '7.0.2' }),
        importNativeApi: async () => native,
      })
    ).rejects.toThrow('Upgrade to `typescript@^7.1`');
  });

  it('rejects a missing typescript package with the TypeScript 7.1 hint', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => {
          throw moduleNotFound();
        },
        importNativeApi: async () => native,
      })
    ).rejects.toThrow('Add `typescript@^7.1` to the devDependencies');
  });
});

describe('before TypeScript 7.1 is stable', () => {
  beforeEach(() => {
    vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'false');
  });

  it('adds TypeScript 6, because typescript@^7.1 installs nothing yet', () => {
    expect(typeScriptPackageForDocgen(BOTH_APIS)).toBe('typescript@^6');
  });

  it('offers no upgrade to TypeScript 7.1 yet', () => {
    expect(getTypeScriptUpgradeForDocgen(BOTH_APIS, {})).toBeUndefined();
  });

  it('rejects TypeScript 7.0 with the side-by-side setup', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ version: '7.0.2' }),
        importNativeApi: async () => ({}),
      })
    ).rejects.toThrow('"typescript": "npm:@typescript/typescript6@^6.0.2"');
  });

  it('still loads the native API of an installed TypeScript 7.1', async () => {
    const native = { sync: {}, ast: {} };

    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ version: '7.1.0-beta' }),
        importNativeApi: async () => native,
      })
    ).resolves.toEqual({ api: 'native', typescript: native });
  });
});

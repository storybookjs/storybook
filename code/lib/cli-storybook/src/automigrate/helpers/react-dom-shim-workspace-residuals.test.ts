import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { analyzeReactDomShimWorkspace } from './react-dom-shim-workspace.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(fs.readFile).mockImplementation(vol.promises.readFile as typeof fs.readFile);
  vi.mocked(fs.readdir).mockImplementation(vol.promises.readdir as typeof fs.readdir);
  vi.mocked(fs.lstat).mockImplementation(vol.promises.lstat as typeof fs.lstat);
  vi.mocked(fs.realpath).mockImplementation(vol.promises.realpath as typeof fs.realpath);
  vi.mocked(fs.writeFile).mockImplementation(vol.promises.writeFile as typeof fs.writeFile);
});

afterEach(() => vi.restoreAllMocks());

const packageJson = (dependencies: Record<string, string>) =>
  `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`;

describe('analyzeReactDomShimWorkspace', () => {
  it('refuses shim aliases in unsupported webpack configuration', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/webpack.config.js':
        "module.exports = { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/dist/react-16' } } };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/webpack.config.js: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses concatenated shim references and manifest import maps', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ dependencies: { react: '19.1.1', 'react-dom': '19.1.1', '@storybook/react-dom-shim': '10.5.10' }, imports: { '#shim': '@storybook/react-dom-shim/react-16' } })}\n`,
      '/project/src/load.mjs':
        "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nload('@storybook/' + 'react-dom-shim');\n",
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/' + 'react-dom-shim/preset'] };\n",
      '/project/tsconfig.json': `${JSON.stringify({ compilerOptions: { paths: { '@storybook/react-dom-shim': ['@storybook/react-dom-shim/dist/react-16'] } } })}\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/package.json: contains a react-dom-shim reference that cannot be removed safely',
        '/project/.storybook/main.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/src/load.mjs: contains a react-dom-shim import, re-export, or module load',
        '/project/tsconfig.json: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses shim references in manifest keys, dependency aliases, and static config expressions', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ dependencies: { react: '19.1.1', 'react-dom': '19.1.1', '@storybook/react-dom-shim': '10.5.10', legacyShim: 'npm:@storybook/react-dom-shim@10.5.10' }, browser: { '@storybook/react-dom-shim': false } })}\n`,
      '/project/webpack.config.js':
        "module.exports = { resolve: { alias: { shim: '@storybook/' + 'react-dom-shim' } } };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/package.json: contains a react-dom-shim reference that cannot be removed safely',
        '/project/webpack.config.js: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses residual static shim expressions in configs and source without partial edits', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'], resolve: { alias: { shim: '@storybook/' + 'react-dom-shim' } } };\n",
      '/project/vite.config.ts':
        "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16', shim: `@storybook/react-dom-shim` } } };\n",
      '/project/vitest.config.ts':
        "export default { resolve: { alias: { shim: '@storybook/' + 'react-dom-shim' } } };\n",
      '/project/src/shim.ts': "export const shim = '@storybook/' + 'react-dom-shim';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/.storybook/main.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/vite.config.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/vitest.config.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/src/shim.ts: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses static template shim references in source and config without partial edits', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/loader.ts': "export const shim = `${'@storybook/'}react-dom-shim`;\n",
      '/project/vite.config.ts':
        "export default { resolve: { alias: { shim: `${'@storybook/'}react-dom-shim` } } };\n",
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'], shim: `${'@storybook/'}react-dom-shim` };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/loader.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/vite.config.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/.storybook/main.ts: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it.each([
    ['tsconfig.json', '{"compilerOptions":{"paths":{"\\u0040storybook/react-dom-shim":["shim"]}}}'],
    [
      'tsconfig.json',
      '{\n  // Compatibility alias\n  "compilerOptions": { "paths": { "shim": ["\\u0040storybook/react-dom-shim"] } }\n}',
    ],
    [
      'tsconfig.jsonc',
      '{\n  // Compatibility alias\n  "compilerOptions": { "paths": { "shim": ["@storybook/react-dom-shim"] } }\n}',
    ],
    ['tsconfig.json', '{"__proto__":{"alias":"\\u0040storybook/react-dom-shim"}}'],
  ])('refuses decoded shim aliases in %s', async (fileName, config) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      [`/project/${fileName}`]: config,
      '/project/src/index.ts': "import { renderElement } from 'shim';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        `/project/${fileName}: contains a react-dom-shim reference that cannot be removed safely`,
      ]),
    });
  });

  it('refuses malformed JSONC data files', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/tsconfig.jsonc': '{"compilerOptions": 0x10}',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/tsconfig.jsonc: cannot parse data configuration during workspace scan',
      ],
    });
  });

  it('refuses duplicate JSON keys when an earlier value references the shim', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/tsconfig.json': '{"alias":"@storybook/react-dom-shim","alias":"other"}',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/tsconfig.json: contains a react-dom-shim reference that cannot be removed safely',
      ],
    });
  });

  it('does not reject valid JSON data arrays without shim references', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/data.json': '[]',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'safe',
    });
  });

  it('supports ordinary Vite HTML while scanning executable HTML positions', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html':
        '<!doctype html><div id="root"></div><script type="module" src="/src/main.ts"></script>\n',
      '/project/src/main.ts': "export const name = 'app';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'safe',
    });
  });

  it.each([
    [
      'an .htm module import',
      'index.htm',
      '<script type="module">import "@storybook/react-dom-shim";</script>',
    ],
    [
      'an event handler module import',
      'index.html',
      `<button onclick="import('@storybook/' + 'react-dom-shim')">Load</button>`,
    ],
    [
      'a template event handler module import',
      'index.html',
      `<template><button onclick="import('@storybook/' + 'react-dom-shim')">Load</button></template>`,
    ],
    [
      'a JavaScript URL module import',
      'index.html',
      `<a href="javascript:import('@storybook/' + 'react-dom-shim')">Load</a>`,
    ],
    [
      'an encoded JavaScript URL module import',
      'index.html',
      `<a href="java&#x09;script:import('@storybook/' + 'react-dom-shim')">Load</a>`,
    ],
    [
      'an HTML source document',
      'README.html',
      '<script type="module">import "@storybook/react-dom-shim";</script>',
    ],
  ])('refuses %s in HTML', async (_name, fileName, html) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      [`/project/${fileName}`]: html,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      sources: expect.arrayContaining([`/project/${fileName}`]),
      diagnostics: expect.arrayContaining([expect.stringContaining(`/project/${fileName}:`)]),
    });
  });

  it.each([
    [
      'external module entry',
      '<script type="module" src="@storybook/react-dom-shim/react-16"></script>',
    ],
    [
      'inline module import',
      '<script type="module">import shim from \'@storybook/react-dom-shim\';</script>',
    ],
    ['inline dynamic load', "<script>import('@storybook/react-dom-shim')</script>"],
    [
      'import map value',
      '<script type="importmap">{"imports":{"shim":"@storybook/react-dom-shim"}}</script>',
    ],
    ['templated executable value', '<script type="module" src="%VITE_ENTRY%"></script>'],
    ['malformed inline JavaScript', '<script type="module">import {</script>'],
    ['malformed HTML', '<script type="module" src="/src/main.ts" src="/src/other.ts"></script>'],
  ])('refuses %s in HTML', async (_name, html) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html': html,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      sources: expect.arrayContaining(['/project/index.html']),
      diagnostics: expect.arrayContaining([expect.stringContaining('/project/index.html:')]),
    });
  });

  it.each([
    [
      'an external module script',
      '<script type="module" src="https://example.com/loader.js"></script>',
    ],
    ['an escaping module script', '<script type="module" src="../../loader.js"></script>'],
    [
      'an embedded source document',
      `<iframe srcdoc="&lt;script&gt;import('@storybook/' + 'react-dom-shim')&lt;/script&gt;"></iframe>`,
    ],
    [
      'an embedded data document',
      '<iframe src="data:text/html;base64,PHNjcmlwdD5pbXBvcnQoJ0BzdG9yeWJvb2svJyArICdyZWFjdC1kb20tc2hpbScpPC9zY3JpcHQ+"></iframe>',
    ],
  ])('refuses %s in HTML', async (_name, body) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html': `<!doctype html>${body}`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([expect.stringContaining('/project/index.html:')]),
    });
  });

  it('keeps known inert workspace files out of the executable scan', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html': '<!doctype html><script type="module" src="/src/main.ts"></script>',
      '/project/src/main.ts': "export const name = 'app';\n",
      '/project/README.md': '# @storybook/react-dom-shim\n',
      '/project/styles.css': 'body { color: black; }\n',
      '/project/package-lock.json': '{"lockfileVersion":3}\n',
      '/project/yarn.lock': '"@storybook/react-dom-shim@10.5.10":\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({ kind: 'safe' });
  });

  it.each([
    [
      'a package query import',
      '/project/src/loader.ts',
      "import '@storybook/react-dom-shim?worker';\n",
    ],
    [
      'a package fragment import',
      '/project/src/loader.ts',
      "import '@storybook/react-dom-shim#legacy';\n",
    ],
    [
      'a config package query alias',
      '/project/vite.config.ts',
      'export default { resolve: { alias: { shim: "@storybook/react-dom-shim?worker" } } };\n',
    ],
    [
      'an external HTML base URL',
      '/project/index.html',
      '<base href="https://example.com/"><script type="module" src="main.ts"></script>',
    ],
    [
      'an executable stylesheet import',
      '/project/styles.css',
      "@import '@storybook/react-dom-shim';\n",
    ],
    [
      'an escaped executable stylesheet import',
      '/project/styles.css',
      '@import "\\40 storybook/react-dom-shim";\n',
    ],
    [
      'a pnpm catalog reference',
      '/project/pnpm-workspace.yaml',
      "packages:\n  - packages/*\ncatalog:\n  shim: '@storybook/react-dom-shim'\n",
    ],
    [
      'an escaped pnpm catalog reference',
      '/project/pnpm-workspace.yaml',
      'packages:\n  - packages/*\ncatalog:\n  shim: "npm:@storybook/react-dom-\\u0073him@10.5.10"\n',
    ],
  ])('refuses %s outside approved transforms', async (_name, filePath, source) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      [filePath]: source,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([expect.stringContaining(`${filePath}:`)]),
    });
  });

  it('refuses code execution that can load an unscanned file', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/vite.config.ts':
        "import { readFileSync } from 'node:fs'; eval(readFileSync('./consumer.txt', 'utf8')); export default {};\n",
      '/project/consumer.txt': "import('@storybook/' + 'react-dom-shim');\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/vite.config.ts: contains unresolved code execution',
      ]),
    });
  });

  it('refuses linked executable files outside the supported source formats', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html':
        '<!doctype html><script type="module" src="/src/main.coffee"></script>',
      '/project/src/main.coffee': "require '@storybook/react-dom-shim'\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/main.coffee: unsupported file type cannot be scanned safely',
      ]),
    });
  });

  it('refuses Astro files without trying to extract frontmatter', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/Canvas.astro': "---\nconst name = 'canvas';\n---\n<div>{name}</div>\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      sources: expect.arrayContaining(['/project/src/Canvas.astro']),
      diagnostics: [
        '/project/src/Canvas.astro: cannot prove absence in Astro source during workspace scan',
      ],
    });
  });
});

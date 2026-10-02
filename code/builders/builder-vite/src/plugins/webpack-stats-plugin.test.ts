import { join, resolve } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { describe, expect, it, vi } from 'vitest';

import { getPreviewConfigHash } from '../transform-iframe-html.ts';
import { pluginWebpackStats } from './webpack-stats-plugin.ts';

vi.mock('storybook/internal/common', { spy: true });
vi.mock('../transform-iframe-html.ts', { spy: true });

const workingDir = resolve('/project');

type File = { code: string; compiledCss?: string };

async function getModuleHashes(
  files: Record<string, File>,
  {
    assets = {},
    define = {},
  }: { assets?: Record<string, string>; define?: Record<string, string> } = {}
) {
  vi.mocked(getPreviewConfigHash).mockResolvedValue('preview-config-hash');
  const plugin = pluginWebpackStats({ workingDir, options: {} as Options });
  (plugin.configResolved as (config: object) => void)({ env: {}, define });
  const transform = plugin.transform as (code: string, id: string) => void;
  const moduleParsed = plugin.moduleParsed as (mod: object) => void;
  const generateBundle = plugin.generateBundle as (...args: unknown[]) => Promise<void>;
  const ids = Object.keys(files).map((file) => join(workingDir, file));

  moduleParsed({
    id: join(workingDir, 'main.ts'),
    code: '',
    importedIds: ids,
    dynamicallyImportedIds: [],
  });
  Object.values(files).forEach(({ code, compiledCss }, index) => {
    if (compiledCss !== undefined) {
      transform(compiledCss, ids[index]);
    }
    moduleParsed({ id: ids[index], code, importedIds: [], dynamicallyImportedIds: [] });
  });
  const bundle = Object.fromEntries(
    Object.entries(assets).map(([fileName, source]) => [fileName, { type: 'asset', source }])
  );
  await generateBundle.call({ getFileName: (referenceId: string) => referenceId }, {}, bundle);

  const { modules } = plugin.storybookGetStats().toJson() as {
    modules: Array<{ name: string; hash: string }>;
  };
  return Object.fromEntries(modules.map((m) => [m.name, m.hash]));
}

describe('pluginWebpackStats', () => {
  it('hashes the transformed output of each module', async () => {
    const first = await getModuleHashes({
      'Button.tsx': { code: 'a' },
      'Header.tsx': { code: 'b' },
    });
    const second = await getModuleHashes({
      'Button.tsx': { code: 'a' },
      'Header.tsx': { code: 'c' },
    });

    expect(second['./Button.tsx']).toBe(first['./Button.tsx']);
    expect(second['./Header.tsx']).not.toBe(first['./Header.tsx']);
  });

  it('hashes the compiled CSS of a stylesheet whose module code is empty', async () => {
    const first = await getModuleHashes({ 'a.css': { code: '', compiledCss: '.a{color:red}' } });
    const second = await getModuleHashes({ 'a.css': { code: '', compiledCss: '.a{color:blue}' } });

    expect(second['./a.css']).not.toBe(first['./a.css']);
  });

  it.each([
    ['Vite', 'export default "__VITE_ASSET__logo__"'],
    ['Rolldown', 'export default import.meta.ROLLDOWN_FILE_URL_logo'],
  ])('hashes the content of assets behind a %s placeholder', async (_, code) => {
    const files = { 'logo.png': { code } };
    const first = await getModuleHashes(files, { assets: { logo: 'old bytes' } });
    const second = await getModuleHashes(files, { assets: { logo: 'new bytes' } });

    expect(second['./logo.png']).not.toBe(first['./logo.png']);
  });

  it('hashes the values of the defines that the module code still uses', async () => {
    const files = {
      'a.js': { code: 'export const a = import.meta.env.STORYBOOK_FLAG;' },
      'b.js': { code: 'export const b = 1;' },
    };
    const first = await getModuleHashes(files, {
      define: { 'import.meta.env.STORYBOOK_FLAG': '"a"' },
    });
    const second = await getModuleHashes(files, {
      define: { 'import.meta.env.STORYBOOK_FLAG': '"b"' },
    });

    expect(second['./a.js']).not.toBe(first['./a.js']);
    expect(second['./b.js']).toBe(first['./b.js']);
  });

  it('hashes only the property a module reads from an object define', async () => {
    const files = {
      'reads-unset.js': { code: 'export const a = import.meta.env.VITEST_STORYBOOK;' },
      'reads-object.js': { code: 'export const { STORYBOOK_FLAG } = import.meta.env;' },
    };
    const env = (flag: string) => ({ 'import.meta.env': JSON.stringify({ STORYBOOK_FLAG: flag }) });
    const first = await getModuleHashes(files, { define: env('a') });
    const second = await getModuleHashes(files, { define: env('b') });

    expect(second['./reads-unset.js']).toBe(first['./reads-unset.js']);
    expect(second['./reads-object.js']).not.toBe(first['./reads-object.js']);
  });

  it('ignores the absolute project root in module code', async () => {
    vi.mocked(getProjectRoot).mockReturnValue('/first');
    const first = await getModuleHashes({ 'a.js': { code: 'import "/first/node_modules/b.js";' } });
    vi.mocked(getProjectRoot).mockReturnValue('/second');
    const second = await getModuleHashes({
      'a.js': { code: 'import "/second/node_modules/b.js";' },
    });

    expect(second['./a.js']).toBe(first['./a.js']);
  });

  it('ignores a Windows project root in every spelling', async () => {
    const code = (root: string) =>
      `import "${root.replaceAll('\\', '/')}/a.js"; const b = ${JSON.stringify(`${root}\\b.js`)};`;
    vi.mocked(getProjectRoot).mockReturnValue('C:\\first');
    const first = await getModuleHashes({ 'a.js': { code: code('C:\\first') } });
    vi.mocked(getProjectRoot).mockReturnValue('C:\\second');
    const second = await getModuleHashes({ 'a.js': { code: code('C:\\second') } });

    expect(second['./a.js']).toBe(first['./a.js']);
  });
});

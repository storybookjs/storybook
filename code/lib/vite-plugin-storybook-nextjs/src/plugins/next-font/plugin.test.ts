import path from 'node:path';

import type { PluginContext } from 'rollup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./local/get-font-face-declarations.ts', { spy: true });

import { getFontFaceDeclarations as getLocalFontFaceDeclarations } from './local/get-font-face-declarations.ts';
import { vitePluginNextFont } from './plugin.ts';

describe('vitePluginNextFont resolveId', () => {
  const createContext = () => ({}) as PluginContext;

  beforeEach(() => {
    vi.mocked(getLocalFontFaceDeclarations).mockResolvedValue({
      id: 'font-test',
      fontFamily: 'font-test',
      fontFaceCSS: '@font-face {}',
      weights: ['200'],
      styles: ['normal'],
    });
  });

  it('encodes the SWC query so a % in font declarations cannot reach Vite URL parsing', async () => {
    const plugin = vitePluginNextFont();

    const rawQuery = JSON.stringify({
      path: 'src/fonts/Overpass.ts',
      import: '',
      arguments: [
        {
          declarations: [{ prop: 'ascent-override', value: '100%' }],
          display: 'swap',
          src: [
            {
              path: './Overpass/overpass-thin.woff2',
              style: 'normal',
              weight: '200',
            },
          ],
          variable: '--font-overpass',
        },
      ],
      variableName: 'overpassFont',
    });

    const source = `${path.join('node_modules', 'next', 'font', 'local', 'target.css')}?${rawQuery}`;
    const importer = '/project/.storybook/preview.tsx';

    const result = (await plugin.resolveId!.call(createContext(), source, importer)) as {
      id: string;
    };

    expect(result.id).toMatch(/^\0virtual:next-font:/);
    expect(result.id).not.toContain('%');
  });

  it('produces distinct virtual ids for different font option payloads', async () => {
    const plugin = vitePluginNextFont();
    const importer = '/project/.storybook/preview.tsx';
    const sourcePrefix = path.join('node_modules', 'next', 'font', 'local', 'target.css');

    const queryA = JSON.stringify({
      path: 'a.ts',
      import: '',
      arguments: [{ src: './a.woff2' }],
      variableName: 'a',
    });
    const queryB = JSON.stringify({
      path: 'b.ts',
      import: '',
      arguments: [{ src: './b.woff2' }],
      variableName: 'b',
    });

    const a = (await plugin.resolveId!.call(
      createContext(),
      `${sourcePrefix}?${queryA}`,
      importer
    )) as { id: string };
    const b = (await plugin.resolveId!.call(
      createContext(),
      `${sourcePrefix}?${queryB}`,
      importer
    )) as { id: string };

    expect(a.id).not.toEqual(b.id);
  });
});

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectSetupPatterns } from './setup-patterns';

let TMP: string;

beforeEach(() => {
  TMP = join(tmpdir(), `eval-setup-patterns-${Date.now()}`);
  mkdirSync(join(TMP, '.storybook'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writeConfig(name: string, content: string) {
  writeFileSync(join(TMP, '.storybook', name), content);
}

describe('detectSetupPatterns', () => {
  it('returns empty when no .storybook dir', async () => {
    rmSync(join(TMP, '.storybook'), { recursive: true });
    expect(await detectSetupPatterns(TMP)).toEqual([]);
  });

  it('returns empty when .storybook has no matching patterns', async () => {
    writeConfig('main.ts', 'export default { stories: ["../src/**/*.stories.@(ts|tsx)"] };');
    expect(await detectSetupPatterns(TMP)).toEqual([]);
  });

  it('detects Tailwind CSS', async () => {
    writeConfig('preview.ts', `import 'tailwindcss/tailwind.css';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('tailwind');
  });

  it('detects global CSS imports', async () => {
    writeConfig('preview.ts', `import '../src/styles/globals.css';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('global-css');
  });

  it('detects styled-components', async () => {
    writeConfig('preview.tsx', `import { createGlobalStyle } from 'styled-components';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('styled-components');
  });

  it('detects React Router', async () => {
    writeConfig('preview.tsx', `import { MemoryRouter } from 'react-router-dom';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('router-provider');
  });

  it('detects Redux provider', async () => {
    writeConfig('preview.tsx', `import { Provider } from 'react-redux';\n<Provider store={store}>`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('redux-provider');
  });

  it('detects Zustand', async () => {
    writeConfig('preview.ts', `import { create } from 'zustand';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('zustand');
  });

  it('detects GraphQL/Apollo', async () => {
    writeConfig('preview.tsx', `import { MockedProvider } from '@apollo/client/testing';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('graphql');
  });

  it('detects theme providers', async () => {
    writeConfig('preview.tsx', `import { ThemeProvider } from '@emotion/react';`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('theme-provider');
  });

  it('detects staticDirs', async () => {
    writeConfig('main.ts', `export default { staticDirs: ['../public'] };`);
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('static-dirs');
  });

  it('detects vite alias config', async () => {
    writeConfig(
      'main.ts',
      `export default { viteFinal: (config) => ({ ...config, resolve: { alias: { '@': './src' } } }) };`
    );
    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).toContain('vite-alias');
  });

  it('detects multiple patterns in the same file', async () => {
    writeConfig(
      'preview.tsx',
      [
        `import '../src/index.css';`,
        `import { MemoryRouter } from 'react-router-dom';`,
        `import { ThemeProvider } from '@emotion/react';`,
      ].join('\n')
    );
    const ids = (await detectSetupPatterns(TMP)).map((p) => p.id);
    expect(ids).toContain('global-css');
    expect(ids).toContain('router-provider');
    expect(ids).toContain('theme-provider');
  });

  it('includes sourceFiles relative to project path', async () => {
    writeConfig('preview.ts', `import 'tailwindcss';`);
    const tailwind = (await detectSetupPatterns(TMP)).find((p) => p.id === 'tailwind');
    expect(tailwind?.sourceFiles).toEqual(['.storybook/preview.ts']);
  });

  it('does not false-positive on unrelated React hooks', async () => {
    writeConfig('preview.ts', `import { useState, useEffect } from 'react';`);
    expect(await detectSetupPatterns(TMP)).toEqual([]);
  });

  it('does not detect patterns in files outside .storybook/', async () => {
    // Write a router import in a source file, not in .storybook/
    mkdirSync(join(TMP, 'src'), { recursive: true });
    writeFileSync(join(TMP, 'src', 'App.tsx'), `import { BrowserRouter } from 'react-router-dom';`);
    // .storybook/ has no patterns
    writeConfig('main.ts', `export default { stories: ['../src/**/*.stories.tsx'] };`);

    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).not.toContain('router-provider');
  });
});

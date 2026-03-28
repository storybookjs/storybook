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
  it('returns empty when no .storybook dir', () => {
    rmSync(join(TMP, '.storybook'), { recursive: true });
    expect(detectSetupPatterns(TMP)).toEqual([]);
  });

  it('returns empty when .storybook has no matching patterns', () => {
    writeConfig('main.ts', 'export default { stories: ["../src/**/*.stories.@(ts|tsx)"] };');
    expect(detectSetupPatterns(TMP)).toEqual([]);
  });

  it('detects Tailwind CSS', () => {
    writeConfig('preview.ts', `import 'tailwindcss/tailwind.css';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('tailwind');
  });

  it('detects global CSS imports', () => {
    writeConfig('preview.ts', `import '../src/styles/globals.css';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('global-css');
  });

  it('detects styled-components', () => {
    writeConfig('preview.tsx', `import { createGlobalStyle } from 'styled-components';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('styled-components');
  });

  it('detects React Router', () => {
    writeConfig('preview.tsx', `import { MemoryRouter } from 'react-router-dom';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('router-provider');
  });

  it('detects Redux provider', () => {
    writeConfig(
      'preview.tsx',
      `import { Provider } from 'react-redux';\n<Provider store={store}>`
    );
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('redux-provider');
  });

  it('detects Zustand', () => {
    writeConfig('preview.ts', `import { create } from 'zustand';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('zustand');
  });

  it('detects GraphQL/Apollo', () => {
    writeConfig('preview.tsx', `import { MockedProvider } from '@apollo/client/testing';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('graphql');
  });

  it('detects theme providers', () => {
    writeConfig('preview.tsx', `import { ThemeProvider } from '@emotion/react';`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('theme-provider');
  });

  it('detects staticDirs', () => {
    writeConfig('main.ts', `export default { staticDirs: ['../public'] };`);
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('static-dirs');
  });

  it('detects vite alias config', () => {
    writeConfig(
      'main.ts',
      `export default { viteFinal: (config) => ({ ...config, resolve: { alias: { '@': './src' } } }) };`
    );
    expect(detectSetupPatterns(TMP).map((p) => p.id)).toContain('vite-alias');
  });

  it('detects multiple patterns in the same file', () => {
    writeConfig(
      'preview.tsx',
      [
        `import '../src/index.css';`,
        `import { MemoryRouter } from 'react-router-dom';`,
        `import { ThemeProvider } from '@emotion/react';`,
      ].join('\n')
    );
    const ids = detectSetupPatterns(TMP).map((p) => p.id);
    expect(ids).toContain('global-css');
    expect(ids).toContain('router-provider');
    expect(ids).toContain('theme-provider');
  });

  it('includes sourceFiles relative to project path', () => {
    writeConfig('preview.ts', `import 'tailwindcss';`);
    const tailwind = detectSetupPatterns(TMP).find((p) => p.id === 'tailwind');
    expect(tailwind?.sourceFiles).toEqual(['.storybook/preview.ts']);
  });

  it('does not false-positive on unrelated React hooks', () => {
    writeConfig('preview.ts', `import { useState, useEffect } from 'react';`);
    expect(detectSetupPatterns(TMP)).toEqual([]);
  });

  it('does not detect patterns in files outside .storybook/', () => {
    // Write a router import in a source file, not in .storybook/
    mkdirSync(join(TMP, 'src'), { recursive: true });
    writeFileSync(
      join(TMP, 'src', 'App.tsx'),
      `import { BrowserRouter } from 'react-router-dom';`
    );
    // .storybook/ has no patterns
    writeConfig('main.ts', `export default { stories: ['../src/**/*.stories.tsx'] };`);

    expect(detectSetupPatterns(TMP).map((p) => p.id)).not.toContain('router-provider');
  });
});

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const DIST = join(import.meta.dirname, '../../dist');
const CREATE_JS = join(DIST, 'theming/create.js');
const CREATE_DTS = join(DIST, 'theming/create.d.ts');
const EMOTION_DTS = join(DIST, 'theming/emotion.d.ts');
const CONSUMER_FIXTURE = join(import.meta.dirname, '__testfixtures__/typescript-consumer.ts');
const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
// Compiling the theming API surface with tsc takes 30s+ on loaded Windows CI
// runners, so use a fixed generous timeout instead of the 10s Vitest default.
const compileTimeoutMs = 90_000;

// A dev compile writes the JS bundle and skips declarations. CI builds both before the suite.
const JS_BUILT = existsSync(CREATE_JS);
const DTS_BUILT = existsSync(CREATE_DTS) && existsSync(EMOTION_DTS);

const REACT_OR_EMOTION = /^(react|react-dom)(\/|$)|@emotion\//;

const TSC_OPTIONS = [
  '--module',
  'Node16',
  '--moduleResolution',
  'node16',
  '--target',
  'ES2022',
  '--strict',
  '--skipLibCheck',
  'false',
  '--types',
  'node',
  '--noEmit',
  CONSUMER_FIXTURE,
];

function externalSpecifiers(entryFile: string): string[] {
  const seen = new Set<string>();
  const specifiers = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/(?:from|import)\s*(?:\(\s*)?["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith('.')) {
        visit(join(dirname(file), specifier));
      } else {
        specifiers.add(specifier);
      }
    }
  };
  visit(entryFile);
  return [...specifiers].sort();
}

function declarationSpecifiers(): string[] {
  return readdirSync(DIST, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.d.ts'))
    .flatMap((file) =>
      [
        ...readFileSync(join(DIST, file), 'utf8').matchAll(
          /(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g
        ),
      ].map((match) => match[1])
    );
}

describe('published theming entries', () => {
  it.runIf(process.env.CI)('are built before this suite runs', () => {
    expect(JS_BUILT).toBe(true);
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(JS_BUILT)('keeps storybook/theming free of React and Emotion', () => {
    const source = readFileSync(CREATE_JS, 'utf8');
    const exported = [...source.matchAll(/export\s*\{([^}]+)\}/g)].flatMap((match) =>
      match[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    );

    expect(exported.sort()).toEqual(['create', 'themes']);
    expect(
      externalSpecifiers(CREATE_JS).filter((specifier) => REACT_OR_EMOTION.test(specifier))
    ).toEqual([]);
  });

  it.runIf(DTS_BUILT)('publishes the narrow storybook/theming types', () => {
    const declarations = readFileSync(CREATE_DTS, 'utf8');

    expect(declarations).toContain('create');
    expect(declarations).toContain('themes');
    expect(declarations).toContain('ThemeVars');
    expect(declarations).toContain('ThemeVarsPartial');
    expect(declarations).not.toContain('styled');
    expect(declarations).not.toMatch(/@emotion\//);
  });

  it.runIf(DTS_BUILT)('points shared Theme queries at storybook/theming/emotion', () => {
    const specifiers = declarationSpecifiers();
    const emotion = readFileSync(EMOTION_DTS, 'utf8');

    expect(specifiers.filter((specifier) => specifier.startsWith('@emotion/'))).toEqual([]);
    expect(specifiers).toContain('storybook/theming/emotion');
    expect(emotion).toContain('styled');
    expect(emotion).toContain('useTheme');
  });

  it.runIf(DTS_BUILT)(
    'compiles the theming consumer fixture with the workspace compiler',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    },
    compileTimeoutMs
  );

  it.runIf(DTS_BUILT)(
    'compiles the theming consumer fixture with TypeScript 5.9.3',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT_5, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    },
    compileTimeoutMs
  );
});

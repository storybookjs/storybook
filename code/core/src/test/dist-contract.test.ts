import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const DTS_ARTIFACT = join(import.meta.dirname, '../../dist/test/index.d.ts');
const CONSUMER_FIXTURE = join(import.meta.dirname, '__testfixtures__/typescript-consumer.ts');
const TYPESCRIPT = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const TYPESCRIPT_5 = createRequire(import.meta.url).resolve('typescript-5/bin/tsc');
const DTS_BUILT = existsSync(DTS_ARTIFACT);
const REPOSITORY_ROOT = join(import.meta.dirname, '../../../..');
// Compiling the public API surface with tsc takes 30s+ on loaded Windows CI
// runners, so use a fixed generous timeout instead of the 10s Vitest default.
const compileTimeoutMs = 90_000;
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

describe('storybook/test declaration contract', () => {
  it.runIf(process.env.CI)('is built before this suite runs', () => {
    expect(DTS_BUILT).toBe(true);
  });

  it.runIf(DTS_BUILT)('inlines the types of the test libraries it bundles', () => {
    // The test types also land in chunks shared with other entries, so check every declaration.
    const distDirectory = join(import.meta.dirname, '../../dist');
    const declarationFiles = readdirSync(distDirectory, { recursive: true, encoding: 'utf-8' })
      .filter((file) => file.endsWith('.d.ts'))
      .map((file) => ({ file, declarations: readFileSync(join(distDirectory, file), 'utf-8') }));

    // The test libraries storybook bundles, and the packages their declarations import. They are
    // not dependencies of storybook, so users don't have them installed.
    const inlinedPackages = [
      '@testing-library/dom',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      '@vitest/expect',
      '@vitest/pretty-format',
      '@vitest/spy',
      '@vitest/utils',
      '@standard-schema/spec',
      '@types/aria-query',
      '@types/chai',
      '@types/deep-eql',
      'aria-query',
      'chai',
      'dom-accessibility-api',
      'pretty-format',
      'tinyrainbow',
      'tinyspy',
    ];
    const imported = (declarations: string) =>
      [...declarations.matchAll(/(?:from |import\(|reference types=)"([^"]+)"/g)].map(
        ([, specifier]) => specifier
      );
    expect(
      declarationFiles.flatMap(({ file, declarations }) =>
        imported(declarations)
          .filter((specifier) =>
            inlinedPackages.some((name) => specifier === name || specifier.startsWith(`${name}/`))
          )
          .map((specifier) => `${file}: ${specifier}`)
      )
    ).toEqual([]);

    // Chai's types are global; inlining them would declare globals in the user's project.
    expect(
      declarationFiles.filter(({ declarations }) =>
        /declare global\s*\{\s*namespace (Chai|jest)\b/.test(declarations)
      )
    ).toEqual([]);
  });

  it.runIf(DTS_BUILT)(
    'compiles the public test API consumer fixture with the workspace compiler',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    },
    compileTimeoutMs
  );

  it.runIf(DTS_BUILT)(
    'compiles the public test API consumer fixture with TypeScript 5.9.3',
    () => {
      execFileSync(process.execPath, [TYPESCRIPT_5, ...TSC_OPTIONS], {
        cwd: REPOSITORY_ROOT,
        stdio: 'pipe',
      });
    },
    compileTimeoutMs
  );
});

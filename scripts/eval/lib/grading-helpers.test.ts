import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findComponentCandidates } from './ghost-stories';
import {
  computeQualityScore,
  countTypeCheckErrors,
  filterStorybookFiles,
  parseChangedFiles,
} from './grade';
import { detectSetupPatterns } from './setup-patterns';

/**
 * Helper-level test: compose grading helpers on a fake project directory.
 * This exercises candidate discovery, setup-pattern detection, git-output parsing,
 * and quality-score calculation without pretending to cover the full grade() flow.
 */

let TMP: string;

beforeEach(() => {
  TMP = join(tmpdir(), `eval-grading-helpers-${Date.now()}`);
  mkdirSync(join(TMP, 'src', 'components'), { recursive: true });
  mkdirSync(join(TMP, '.storybook'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writeFile(relativePath: string, content: string) {
  const fullPath = join(TMP, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

async function findCandidates(cwd: string) {
  const candidates = await findComponentCandidates({ cwd, sampleSize: 20 });
  return candidates.map((c) => c.replace(cwd + '/', ''));
}

describe('grading helpers', () => {
  it('composes helper signals for a well-configured project', async () => {
    // Set up a realistic project with components and storybook config
    writeFile(
      'src/components/Button.tsx',
      [
        `import React from 'react';`,
        `export function Button({ label }: { label: string }) {`,
        `  return (`,
        `    <button className="btn">{label}</button>`,
        `  );`,
        `}`,
      ].join('\n')
    );
    writeFile(
      'src/components/Card.tsx',
      [
        `import React from 'react';`,
        `export function Card({ title }: { title: string }) {`,
        `  return (`,
        `    <div className="card">{title}</div>`,
        `  );`,
        `}`,
      ].join('\n')
    );
    writeFile(
      '.storybook/preview.tsx',
      [
        `import '../src/styles/globals.css';`,
        `import { ThemeProvider } from '@emotion/react';`,
      ].join('\n')
    );
    writeFile(
      '.storybook/main.ts',
      `export default { staticDirs: ['../public'], stories: ['../src/**/*.stories.tsx'] };`
    );

    // Step 1: Find candidates — both components should be discovered
    const candidates = await findCandidates(TMP);
    expect(candidates).toHaveLength(2);

    // Step 2: Detect patterns — config references CSS, theme, staticDirs
    const patterns = await detectSetupPatterns(TMP);
    const patternIds = patterns.map((p) => p.id);
    expect(patternIds).toContain('global-css');
    expect(patternIds).toContain('theme-provider');
    expect(patternIds).toContain('static-dirs');

    // Step 3: Simulate git output where the agent added storybook config + one
    // story per discovered candidate, plus modified package.json
    const gitLines = [
      'A\t.storybook/preview.tsx',
      'A\t.storybook/main.ts',
      ...candidates.map((c) => `A\t${c.replace(/\.tsx$/, '.stories.tsx')}`),
      'M\tpackage.json',
    ];
    const changedFiles = parseChangedFiles(gitLines.join('\n'));
    const storybookFiles = filterStorybookFiles(changedFiles);

    // 2 config files + 1 story per candidate = storybook-related
    expect(storybookFiles).toHaveLength(2 + candidates.length);
    // Total includes package.json
    expect(changedFiles).toHaveLength(storybookFiles.length + 1);

    // Step 4: Build passed, no TS errors, 100% ghost stories, fast agent → perfect score
    const quality = computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 60 });
    expect(quality.score).toBe(1);
  });

  it('composes helper signals for a broken project', async () => {
    writeFile(
      'src/components/Widget.tsx',
      [
        `import React from 'react';`,
        `export function Widget() {`,
        `  return <div>hello</div>;`,
        `}`,
      ].join('\n')
    );

    // Candidates still discoverable even when storybook setup is broken
    const candidates = await findCandidates(TMP);
    expect(candidates).toHaveLength(1);

    // Agent didn't create any .storybook config
    rmSync(join(TMP, '.storybook'), { recursive: true });
    expect(await detectSetupPatterns(TMP)).toEqual([]);

    // Simulate tsc output with errors proportional to candidate count
    const tscLines = candidates.map(
      (c, i) => `${c}(${i + 1},1): error TS2304: Cannot find name 'React'.`
    );
    tscLines.push("src/App.tsx(10,5): error TS2345: Argument not assignable.");
    const errorCount = countTypeCheckErrors(tscLines.join('\n'));
    expect(errorCount).toBe(candidates.length + 1);

    // Build failed, no ghost stories, errors, slow → low quality
    const quality = computeQualityScore({ buildSuccess: false, typeCheckErrors: errorCount, ghostSuccessRate: 0, durationSeconds: 600 });
    expect(quality.score).toBeLessThan(0.3);
    expect(quality.breakdown.build).toBe(0);
  });

  it('keeps helper output stable as candidate count grows', async () => {
    // Rich project: many simple components
    for (let i = 0; i < 5; i++) {
      writeFile(
        `src/components/Comp${i}.tsx`,
        [
          `import React from 'react';`,
          `export function Comp${i}() {`,
          `  return <div>Component ${i}</div>;`,
          `}`,
        ].join('\n')
      );
    }
    writeFile('.storybook/preview.tsx', `import { MemoryRouter } from 'react-router-dom';`);

    const candidates = await findCandidates(TMP);
    expect(candidates).toHaveLength(5);

    const patterns = await detectSetupPatterns(TMP);
    expect(patterns.map((p) => p.id)).toContain('router-provider');

    // Agent wrote one story per candidate — all storybook-related
    const gitOutput = candidates
      .map((c) => `A\t${c.replace(/\.tsx$/, '.stories.tsx')}`)
      .join('\n');
    const storybookFiles = filterStorybookFiles(parseChangedFiles(gitOutput));
    expect(storybookFiles).toHaveLength(candidates.length);

    // Clean build + 100% ghost stories + fast → perfect
    expect(computeQualityScore({ buildSuccess: true, typeCheckErrors: 0, ghostSuccessRate: 1.0, durationSeconds: 60 }).score).toBe(1);
  });
});

describe('setup-patterns only scans .storybook/', () => {
  it('does not detect patterns in component source files', async () => {
    // Router usage in a component should NOT be detected as a setup pattern
    writeFile(
      'src/App.tsx',
      [
        `import React from 'react';`,
        `import { BrowserRouter } from 'react-router-dom';`,
        `export function App() {`,
        `  return <BrowserRouter><div /></BrowserRouter>;`,
        `}`,
      ].join('\n')
    );
    // Empty .storybook config with no patterns
    writeFile('.storybook/main.ts', `export default { stories: ['../src/**/*.stories.tsx'] };`);

    expect((await detectSetupPatterns(TMP)).map((p) => p.id)).not.toContain('router-provider');
  });
});

import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getComponentCandidates } from 'storybook/internal/core-server';
import {
  computeQualityScore,
  countTypeCheckErrors,
  filterStorybookFiles,
  parseChangedFiles,
} from './grade.ts';
/**
 * Helper-level test: compose grading helpers on a fake project directory.
 * This exercises candidate discovery, git-output parsing,
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

    // Step 2: Simulate git output where the agent added storybook config + one
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

    // Step 3: Score is now just story-render preview gain.
    const quality = computeQualityScore({
      baselinePreviewStories: { passed: 1, total: 4 },
      storyRender: { passed: 4, total: 4 },
    });
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

    // Simulate tsc output with errors proportional to candidate count
    const tscLines = candidates.map(
      (c, i) => `${c}(${i + 1},1): error TS2304: Cannot find name 'React'.`
    );
    tscLines.push('src/App.tsx(10,5): error TS2345: Argument not assignable.');
    const errorCount = countTypeCheckErrors(tscLines.join('\n'));
    expect(errorCount).toBe(candidates.length + 1);

    // Missing post-run story-render data means no measurable gain.
    const quality = computeQualityScore({
      baselinePreviewStories: { passed: 2, total: 5 },
    });
    expect(quality.score).toBe(0);
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

    // Agent wrote one story per candidate — all storybook-related
    const gitOutput = candidates.map((c) => `A\t${c.replace(/\.tsx$/, '.stories.tsx')}`).join('\n');
    const storybookFiles = filterStorybookFiles(parseChangedFiles(gitOutput));
    expect(storybookFiles).toHaveLength(candidates.length);

    // Score tracks only the increase in story-render success rate.
    expect(
      computeQualityScore({
        baselinePreviewStories: { passed: 3, total: 5 },
        storyRender: { passed: 5, total: 5 },
      }).score
    ).toBe(1);
  });
});

function writeFile(relativePath: string, content: string) {
  const fullPath = join(TMP, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

async function findCandidates(cwd: string) {
  const { candidates } = await getComponentCandidates({ cwd, sampleSize: 20 });
  return candidates.map((c) => c.replace(cwd + '/', ''));
}

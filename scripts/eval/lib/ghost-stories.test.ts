import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Core function — tests verify it works from the eval context (requires compile).
import { getComponentCandidates } from '../../../code/core/src/core-server/utils/ghost-stories/get-candidates';

let TMP: string;

beforeEach(() => {
  TMP = join(tmpdir(), `eval-ghost-stories-${Date.now()}`);
  mkdirSync(join(TMP, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writeFile(relativePath: string, content: string) {
  const fullPath = join(TMP, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

function simpleComponent(name: string) {
  return [
    `import React from 'react';`,
    `export function ${name}() {`,
    `  return <div>${name}</div>;`,
    `}`,
  ].join('\n');
}

async function findCandidates(cwd: string) {
  const { candidates } = await getComponentCandidates({ cwd, sampleSize: 20 });
  // Return relative paths for easier assertions
  return candidates.map((c) => c.replace(cwd + '/', ''));
}

describe('getComponentCandidates from core', () => {
  it('finds exported components with JSX', async () => {
    writeFile('src/Button.tsx', simpleComponent('Button'));
    expect(await findCandidates(TMP)).toEqual(['src/Button.tsx']);
  });

  it('skips files without exports', async () => {
    writeFile('src/Internal.tsx', `function Internal() { return <div>hi</div>; }`);
    expect(await findCandidates(TMP)).toEqual([]);
  });

  it('skips files without JSX', async () => {
    writeFile('src/utils.tsx', `export const add = (a: number, b: number) => a + b;`);
    expect(await findCandidates(TMP)).toEqual([]);
  });

  it('skips test, spec, and story files', async () => {
    writeFile('src/Button.test.tsx', simpleComponent('X'));
    writeFile('src/Button.spec.tsx', simpleComponent('X'));
    writeFile('src/Button.stories.tsx', simpleComponent('X'));
    expect(await findCandidates(TMP)).toEqual([]);
  });

  it('skips config files', async () => {
    writeFile('src/app.config.tsx', simpleComponent('X'));
    expect(await findCandidates(TMP)).toEqual([]);
  });

  it('sorts by complexity (simpler first)', async () => {
    writeFile('src/Simple.tsx', simpleComponent('Simple'));
    const lines = [
      `import React from 'react';`,
      `import { useState } from 'react';`,
      `import { useEffect } from 'react';`,
      `import { useCallback } from 'react';`,
      `import { useMemo } from 'react';`,
      ...Array.from({ length: 40 }, (_, i) => `const line${i} = ${i};`),
      `export function Complex() { return <div>{line0}</div>; }`,
    ];
    writeFile('src/Complex.tsx', lines.join('\n'));

    const candidates = await findCandidates(TMP);
    expect(candidates.indexOf('src/Simple.tsx')).toBeLessThan(
      candidates.indexOf('src/Complex.tsx')
    );
  });

  it('limits to sampleSize candidates', async () => {
    for (let i = 0; i < 25; i++) {
      writeFile(`src/Comp${i}.tsx`, simpleComponent(`Comp${i}`));
    }
    expect(await findCandidates(TMP)).toHaveLength(20);
  });

  it('returns empty for empty project', async () => {
    expect(await findCandidates(TMP)).toEqual([]);
  });
});

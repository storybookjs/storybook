import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findCandidates } from './ghost-stories';

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

/** A realistic component file with an export and JSX via return(). */
function simpleComponent(name: string) {
  return [
    `import React from 'react';`,
    `export function ${name}() {`,
    `  return <div>${name}</div>;`,
    `}`,
  ].join('\n');
}

describe('findCandidates', () => {
  it('finds exported components with JSX', () => {
    writeFile('src/Button.tsx', simpleComponent('Button'));
    expect(findCandidates(TMP)).toEqual(['src/Button.tsx']);
  });

  it('skips files without exports', () => {
    writeFile(
      'src/Internal.tsx',
      `function Internal() { return <div>hi</div>; }`
    );
    expect(findCandidates(TMP)).toEqual([]);
  });

  it('skips files without JSX', () => {
    writeFile('src/utils.tsx', `export const add = (a: number, b: number) => a + b;`);
    expect(findCandidates(TMP)).toEqual([]);
  });

  it('skips test, spec, and story files', () => {
    writeFile('src/Button.test.tsx', simpleComponent('X'));
    writeFile('src/Button.spec.tsx', simpleComponent('X'));
    writeFile('src/Button.stories.tsx', simpleComponent('X'));
    writeFile('src/Button.story.tsx', simpleComponent('X'));
    expect(findCandidates(TMP)).toEqual([]);
  });

  it('skips config files', () => {
    writeFile('src/app.config.tsx', simpleComponent('X'));
    expect(findCandidates(TMP)).toEqual([]);
  });

  it('sorts by complexity (simpler first)', () => {
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

    const candidates = findCandidates(TMP);
    expect(candidates.indexOf('src/Simple.tsx')).toBeLessThan(
      candidates.indexOf('src/Complex.tsx')
    );
  });

  it('limits to 20 candidates', () => {
    for (let i = 0; i < 25; i++) {
      writeFile(`src/Comp${i}.tsx`, simpleComponent(`Comp${i}`));
    }
    expect(findCandidates(TMP)).toHaveLength(20);
  });

  it('returns empty for empty project', () => {
    expect(findCandidates(TMP)).toEqual([]);
  });

  it('finds components using uppercase JSX tags', () => {
    writeFile(
      'src/Wrapper.tsx',
      `import { Container } from './ui';\nexport const Wrapper = () => <Container>hi</Container>;`
    );
    expect(findCandidates(TMP)).toEqual(['src/Wrapper.tsx']);
  });
});

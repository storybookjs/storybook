import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../external-repo.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../external-repo.ts')>()),
  prepareRef: vi.fn(),
}));

import { prepareRef } from '../../external-repo.ts';
import { collectDsDocs, DS_DOCS_PIN, dsDocsRefLabel } from './ds-docs.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ds-docs-'));
  vi.mocked(prepareRef).mockReturnValue(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function write(path: string, contents: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), contents);
}

describe('DS_DOCS_PIN', () => {
  // The whole point of a fixed ref: arms are served different documentation on
  // purpose, and judging each against what it saw would score a degraded arm
  // against a lowered bar.
  it('is an immutable sha, not a branch', () => {
    expect(DS_DOCS_PIN.ref).toMatch(/^[0-9a-f]{40}$/);
    expect(DS_DOCS_PIN.repo).toBe('yannbf/droppy-ds');
  });

  it('labels itself repo@sha for the artifact', () => {
    expect(dsDocsRefLabel()).toBe(`${DS_DOCS_PIN.repo}@${DS_DOCS_PIN.ref}`);
  });
});

describe('collectDsDocs', () => {
  it('collects mdx from components and docs, sorted for a stable cache prefix', () => {
    write('src/components/Button/Button.mdx', '# Button\n');
    write('src/components/Card/Card.mdx', '# Card\n');
    write('src/docs/BrandGuidelines.mdx', '# Brand\n');
    write('src/components/Button/Button.tsx', 'export const Button = 1\n');
    write('README.md', '# nope\n');

    expect(collectDsDocs('/cache').map((doc) => doc.path)).toEqual([
      'src/components/Button/Button.mdx',
      'src/components/Card/Card.mdx',
      'src/docs/BrandGuidelines.mdx',
    ]);
  });

  it('carries the text of each document', () => {
    write('src/docs/BrandGuidelines.mdx', '# Brand\nUse tokens.\n');
    expect(collectDsDocs('/cache')[0]).toEqual({
      path: 'src/docs/BrandGuidelines.mdx',
      text: '# Brand\nUse tokens.\n',
    });
  });

  // A silent empty corpus would produce a confidently wrong judgement.
  it('throws when the ref carries no mdx at all', () => {
    expect(() => collectDsDocs('/cache')).toThrow(/no MDX/);
  });

  // The pin is what the judge is measured against, so the fetch has to use it
  // rather than whatever ref the arm under evaluation happened to be served.
  it('asks for the pinned ref under the cache directory it was given', () => {
    write('src/docs/BrandGuidelines.mdx', '# Brand\n');
    collectDsDocs('/cache');
    expect(prepareRef).toHaveBeenCalledWith('/cache', DS_DOCS_PIN.repo, DS_DOCS_PIN.ref);
  });
});

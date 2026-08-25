import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../src');

const getSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return getSourceFiles(fullPath);
    }
    return fullPath.endsWith('.ts') && !fullPath.endsWith('.test.ts') ? [fullPath] : [];
  });

describe('ESLint compatibility', () => {
  it('does not import runtime values from the @typescript-eslint/utils barrel', () => {
    const violations = getSourceFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const matches = Array.from(
        source.matchAll(/^\s*import\s+(?:type\s+)?[\s\S]*?\sfrom\s+['"][^'"]+['"];?/gm),
        ([statement]) => statement
      ).filter(
        (statement) =>
          !/^\s*import\s+type\b/.test(statement) &&
          /\sfrom\s+['"]@typescript-eslint\/utils['"];?\s*$/.test(statement)
      );
      return matches?.map((statement) => `${relative(srcDir, file)}: ${statement}`) ?? [];
    });

    expect(violations).toEqual([]);
  });
});

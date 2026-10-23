import { sep } from 'node:path';

import ts from 'typescript';

/*
 * One `storybook/theming` entry could use `declare module '.'` because Emotion's empty Theme was
 * inlined into that same .d.ts. Two entries make component .d.ts files name
 * `import("@emotion/react").Theme`, which the declaration bundler hoists into a shared chunk the
 * augmentation cannot fill. The rewrite points those queries at `storybook/theming/emotion`
 * before bundling. Emotion stays inlined. This is not `dtsExternal`, which would leave
 * `@emotion/react` imports in the published types.
 */
export function retargetEmotionTypeQueries(emitDir: string, specifier: string): void {
  const files = ts.sys.readDirectory(emitDir, ['.d.ts', '.d.mts', '.d.cts']);
  const pairs = [
    ['import("@emotion/styled")', `import("${specifier}")`],
    ['import("@emotion/react")', `import("${specifier}")`],
    ["import('@emotion/styled')", `import('${specifier}')`],
    ["import('@emotion/react')", `import('${specifier}')`],
  ] as const;
  for (const file of files) {
    if (file.split(sep).includes('theming')) {
      continue;
    }
    const text = ts.sys.readFile(file);
    if (!text?.includes('@emotion/')) {
      continue;
    }
    let next = text;
    for (const [from, to] of pairs) {
      next = next.replaceAll(from, to);
    }
    if (next !== text) {
      ts.sys.writeFile(file, next);
    }
  }
}

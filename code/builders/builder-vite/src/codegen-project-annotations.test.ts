import { describe, expect, it } from 'vitest';

import { generateProjectAnnotationsCodeFromPreviews } from './codegen-project-annotations';

describe('generateProjectAnnotationsCodeFromPreviews', () => {
  it('keeps generated preview import identifiers unique when aliases collide', () => {
    const result = generateProjectAnnotationsCodeFromPreviews({
      // These paths previously produced the same generated `preview_<hash>` identifier.
      previewAnnotations: ['/virtual/path/0000r/preview.js', '/virtual/path/00020/preview.js'],
      projectRoot: '/virtual',
      frameworkName: 'frameworkName',
      isCsf4: false,
    });

    const importVariables = [...result.matchAll(/import \* as (\w+) from/g)].map(
      (match) => match[1]
    );

    expect(importVariables).toHaveLength(2);
    expect(new Set(importVariables).size).toBe(importVariables.length);
    expect(result).toContain(`hmrPreviewAnnotationModules[0] ?? ${importVariables[0]}`);
    expect(result).toContain(`hmrPreviewAnnotationModules[1] ?? ${importVariables[1]}`);
  });

  it('suffixes repeated collisions deterministically across more than two previews', () => {
    const result = generateProjectAnnotationsCodeFromPreviews({
      // These paths all collide under the current djb2 hash, so the fallback suffixing stays active.
      previewAnnotations: [
        '/virtual/path/0000r/preview.js',
        '/virtual/path/00020/preview.js',
        '/virtual/path/0001Q/preview.js',
      ],
      projectRoot: '/virtual',
      frameworkName: 'frameworkName',
      isCsf4: false,
    });

    const importVariables = [...result.matchAll(/import \* as (\w+) from/g)].map(
      (match) => match[1]
    );

    expect(importVariables[0]).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    expect(importVariables).toEqual([
      importVariables[0],
      `${importVariables[0]}_2`,
      `${importVariables[0]}_3`,
    ]);
    expect(result).toContain(`hmrPreviewAnnotationModules[2] ?? ${importVariables[2]}`);
  });
});

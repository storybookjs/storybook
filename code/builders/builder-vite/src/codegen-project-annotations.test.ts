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
});

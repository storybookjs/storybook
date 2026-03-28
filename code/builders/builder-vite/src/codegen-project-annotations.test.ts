import { describe, expect, it, vi } from 'vitest';

vi.mock('storybook/internal/common', () => ({}), { virtual: true });
vi.mock('storybook/internal/csf-tools', () => ({}), { virtual: true });

describe('generateProjectAnnotationsCodeFromPreviews', () => {
  it('suffixes preview annotation identifiers when the generated name collides', async () => {
    const { generateProjectAnnotationsCodeFromPreviews } =
      await import('./codegen-project-annotations');

    const result = generateProjectAnnotationsCodeFromPreviews({
      previewAnnotations: [
        '/virtual/addons/000r/preview.js',
        '/virtual/addons/0020/preview.js',
        '/virtual/project/.storybook/preview.ts',
      ],
      projectRoot: '/virtual/project',
      frameworkName: 'test-framework',
      isCsf4: false,
    });

    expect(result).toContain(
      'import * as preview_51981552 from "/virtual/addons/000r/preview.js";'
    );
    expect(result).toContain(
      'import * as preview_51981552_1 from "/virtual/addons/0020/preview.js";'
    );
    expect(result).toContain('hmrPreviewAnnotationModules[0] ?? preview_51981552');
    expect(result).toContain('hmrPreviewAnnotationModules[1] ?? preview_51981552_1');
  });
});

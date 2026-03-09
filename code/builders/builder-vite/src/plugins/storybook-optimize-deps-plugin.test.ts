import { describe, expect, it } from 'vitest';

import { escapeGlobPath } from './storybook-optimize-deps-plugin';

describe('escapeGlobPath', () => {
  it('should not modify a plain path without special characters', () => {
    expect(escapeGlobPath('./src/Button.stories.tsx')).toBe('./src/Button.stories.tsx');
  });

  it('should escape parentheses in path segments (e.g. Next.js route groups)', () => {
    expect(escapeGlobPath('./src/(group)/Button.stories.tsx')).toBe(
      './src/\\(group\\)/Button.stories.tsx'
    );
  });

  it('should escape square brackets in path segments', () => {
    expect(escapeGlobPath('./src/[id]/Button.stories.tsx')).toBe(
      './src/\\[id\\]/Button.stories.tsx'
    );
  });

  it('should escape curly braces in path segments', () => {
    expect(escapeGlobPath('./src/{group}/Button.stories.tsx')).toBe(
      './src/\\{group\\}/Button.stories.tsx'
    );
  });

  it('should escape glob wildcard characters', () => {
    expect(escapeGlobPath('./src/Button*.stories.tsx')).toBe('./src/Button\\*.stories.tsx');
    expect(escapeGlobPath('./src/Button?.stories.tsx')).toBe('./src/Button\\?.stories.tsx');
  });

  it('should escape all special glob characters together', () => {
    expect(escapeGlobPath('./src/(group)/[id]/{name}/*.stories.tsx')).toBe(
      './src/\\(group\\)/\\[id\\]/\\{name\\}/\\*.stories.tsx'
    );
  });

  it('should not modify paths that contain no special glob characters', () => {
    expect(escapeGlobPath('./src/my-component/Button.stories.tsx')).toBe(
      './src/my-component/Button.stories.tsx'
    );
  });
});

import { describe, expect, it } from 'vitest';

import { selectDocsCanvas, showsPreviewToolbar } from './docs-canvas.ts';

const docsCanvas = { 'manager-docs': { render: () => null } };

describe('docs canvas', () => {
  it('replaces only the docs view when a docs canvas is registered', () => {
    expect(selectDocsCanvas('docs', docsCanvas)).toBe(docsCanvas['manager-docs']);
    expect(selectDocsCanvas('story', docsCanvas)).toBeUndefined();
    expect(selectDocsCanvas('docs', {})).toBeUndefined();
  });

  it('hides the page toolbar while a docs canvas is shown and keeps it for stories', () => {
    expect(showsPreviewToolbar(true, 'docs', docsCanvas)).toBe(false);
    expect(showsPreviewToolbar(true, 'story', docsCanvas)).toBe(true);
    expect(showsPreviewToolbar(true, 'docs', {})).toBe(true);
    expect(showsPreviewToolbar(true, 'docs', undefined)).toBe(true);
    expect(showsPreviewToolbar(false, 'story', docsCanvas)).toBe(false);
  });
});

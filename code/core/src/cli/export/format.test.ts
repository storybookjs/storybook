import { describe, expect, it } from 'vitest';

import { buildDesignFiles, readStoryIndex, validatePreviewVersion } from './format.ts';

describe('validatePreviewVersion', () => {
  it.each([{}, { storybookVersion: '10.5.0' }, { storybookVersion: 'unknown' }])(
    'rejects previews without the play suppression contract: %j',
    (metadata) => {
      expect(() => validatePreviewVersion(metadata)).toThrow(/disable play/);
    }
  );

  it('accepts the preview version that implements embedded rendering without plays', () => {
    expect(() => validatePreviewVersion({ storybookVersion: '11.0.0-rc.1' })).not.toThrow();
  });
});

describe('readStoryIndex', () => {
  it('exports every story while excluding generated documentation pages', () => {
    expect(
      readStoryIndex({
        v: 5,
        entries: {
          'button--primary': {
            id: 'button--primary',
            type: 'story',
            title: 'Inputs/Button',
            name: 'Primary',
            importPath: './Button.stories.ts',
          },
          'button--docs': {
            id: 'button--docs',
            type: 'docs',
            title: 'Inputs/Button',
            name: 'Docs',
          },
        },
      })
    ).toEqual([{ id: 'button--primary', title: 'Inputs/Button', name: 'Primary' }]);
  });

  it.each([
    {},
    { v: 5, entries: { a: { id: 'a', type: 'story', title: 'Button' } } },
    { v: 5, entries: { a: { id: 'b', type: 'story', title: 'Button', name: 'A' } } },
  ])('rejects malformed indices instead of silently omitting stories', (index) => {
    expect(() => readStoryIndex(index)).toThrow(/index/i);
  });

  it('rejects a library with no stories', () => {
    expect(() => readStoryIndex({ v: 5, entries: {} })).toThrow(/no stories/i);
  });
});

describe('buildDesignFiles', () => {
  const first = {
    id: 'button--primary',
    title: 'Inputs/Button',
    name: 'Primary',
    html: '<!doctype html><html><body><x-dc><button>Save</button></x-dc></body></html>',
    width: 800,
    height: 600,
  };

  it('creates separate artboards, keeps variants together, and retains story IDs', () => {
    const files = buildDesignFiles([
      first,
      { ...first, id: 'card--primary', title: 'Card' },
      { ...first, id: 'button--secondary', name: 'Secondary' },
    ]);
    const canvas = JSON.parse(files['canvas.json']);
    expect(canvas.launch).toEqual({ view: 'canvas' });
    expect(canvas.artboards).toHaveLength(3);
    const buttons = canvas.artboards.filter((board: { title: string }) =>
      board.title.startsWith('Inputs/Button')
    );
    expect(buttons).toHaveLength(2);
    expect(buttons[0].y).toBe(buttons[1].y);
    expect(buttons[1].x).toBeGreaterThanOrEqual(buttons[0].x + buttons[0].w);
    expect(files[buttons[0].file]).toContain('<button>Save</button>');
    expect(
      JSON.parse(files['storybook.json']).stories.map((story: { id: string }) => story.id)
    ).toEqual(['card--primary', 'button--primary', 'button--secondary']);
    expect(files['README.md']).toContain('canvas.json');
  });

  it('never uses story IDs as filesystem paths and does not collide on repeated names', () => {
    const files = buildDesignFiles([
      { ...first, id: '../../README.md' },
      { ...first, id: '__proto__' },
    ]);
    const { artboards } = JSON.parse(files['canvas.json']);
    expect(new Set(artboards.map((board: { file: string }) => board.file)).size).toBe(2);
    for (const board of artboards) {
      expect(board.file).toMatch(/^story-\d+\.dc\.html$/);
      expect(files[board.file]).toBe(first.html);
    }
  });

  it('wraps wide component groups without overlapping the next group', () => {
    const files = buildDesignFiles([
      ...Array.from({ length: 7 }, (_, index) => ({
        ...first,
        id: `button--${index}`,
        name: String(index),
      })),
      { ...first, id: 'other--primary', title: 'Other' },
    ]);
    const { artboards } = JSON.parse(files['canvas.json']);
    for (let a = 0; a < artboards.length; a++) {
      for (let b = a + 1; b < artboards.length; b++) {
        const left = artboards[a];
        const right = artboards[b];
        expect(
          left.x + left.w <= right.x ||
            right.x + right.w <= left.x ||
            left.y + left.h <= right.y ||
            right.y + right.h <= left.y
        ).toBe(true);
      }
    }
  });
});

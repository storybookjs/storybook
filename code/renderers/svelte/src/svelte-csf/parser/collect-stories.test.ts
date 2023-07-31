import { describe, expect, test } from 'vitest';

import TestStories from '../components/__tests__/TestStories.svelte';
import collectStories from './collect-stories.js';

describe('parse-stories', () => {
  test('Extract Stories', () => {
    const data = collectStories(TestStories, { stories: { 'tpl:tpl2': 'tpl2src' } });
    const { stories, meta } = data;

    expect(meta).toMatchInlineSnapshot(`
      {
        "title": "Test",
      }
    `);
    expect(stories).toMatchInlineSnapshot(`
      {
        "Story1": [Function],
        "Story2": [Function],
        "Story3": [Function],
      }
    `);

    expect(stories?.Story1.storyName).toBe('Story1');
    expect(stories?.Story1.parameters).toMatchInlineSnapshot(`undefined`);
    expect(stories?.Story2.storyName).toBe('Story2');
    expect(stories?.Story2.parameters).toMatchInlineSnapshot(`undefined`);
    expect(stories?.Story3.storyName).toBe('Story3');
    expect(stories?.Story3.parameters).toMatchInlineSnapshot(`
      {
        "docs": {
          "source": {
            "code": "xyz",
          },
        },
      }
    `);
  });
});

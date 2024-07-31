import { it, expect } from 'vitest';
import { summarizeStats } from './summarizeStats';

it('should summarize stats', () => {
  const stats = [
    { play: true, render: true, storyFn: false },
    { play: true, render: false, storyFn: false },
    { play: false, render: false, storyFn: false },
  ];
  const result = summarizeStats(stats);
  expect(result).toMatchInlineSnapshot(`
    {
      "play": 2,
      "render": 1,
      "storyFn": 0,
    }
  `);
});

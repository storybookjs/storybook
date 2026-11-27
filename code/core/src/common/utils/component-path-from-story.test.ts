import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import type * as Pathe from 'pathe';
import { join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { componentPathFromStory } from './component-path-from-story.ts';

// Lets a test give `relative` the result it has across Windows drives, which share no root.
const crossDrive = vi.hoisted(() => ({ relative: undefined as string | undefined }));
vi.mock('pathe', async (importOriginal) => {
  const actual = await importOriginal<typeof Pathe>();
  return {
    ...actual,
    relative: (from: string, to: string) => crossDrive.relative ?? actual.relative(from, to),
  };
});

const dirs: string[] = [];
afterEach(() => {
  crossDrive.relative = undefined;
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

const givenStoryFile = () => {
  const dir = mkdtempSync(join(tmpdir(), 'component-path-'));
  dirs.push(dir);
  const storyFile = join(dir, 'Button.stories.ts');
  writeFileSync(storyFile, '');
  return { dir, storyFile };
};

describe('componentPathFromStory', () => {
  it('writes a component next to the story like the index path', () => {
    const { dir, storyFile } = givenStoryFile();
    expect(
      componentPathFromStory('./src/Button.stories.ts', storyFile, join(dir, 'ui', 'Button.ts'))
    ).toBe('./src/ui/Button.ts');
  });

  it('returns the absolute path of a component on another drive', () => {
    const { storyFile } = givenStoryFile();
    crossDrive.relative = 'D:/lib/Button.ts';
    expect(componentPathFromStory('./src/Button.stories.ts', storyFile, 'D:/lib/Button.ts')).toBe(
      'D:/lib/Button.ts'
    );
  });
});

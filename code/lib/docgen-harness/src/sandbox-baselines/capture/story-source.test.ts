import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { attachStorySources } from './attach-story-sources.ts';
import { readStorySource, sourceDigest } from './story-source.ts';
import type { CapturedComponents } from './types.ts';

vi.mock('node:fs', { spy: true });
beforeEach(() => {
  vol.reset();
  vi.mocked(readFileSync).mockImplementation((path) =>
    fs.readFileSync(path.toString(), 'utf8').toString()
  );
});

const text =
  '<script lang="ts">import Button from "./Button.svelte"; import type { It } from "./types"; import * as Alert from "library";</script><Button/>';
const source = {
  source: text,
  sha: 'revision',
  importPath: './Button.stories.svelte',
  digest: sourceDigest(text),
};

describe('story-source evidence', () => {
  it('records exact source text, revision and digest', () => {
    vol.fromJSON({ [resolve('/project/Button.stories.svelte')]: text });
    expect(readStorySource(resolve('/project'), source.importPath, 'revision')).toEqual(source);
    expect(() => readStorySource(resolve('/project'), '../secret', 'revision')).toThrow(
      'outside the project'
    );
  });

  it('attaches only matching pre-build source evidence and rejects edits after recording', () => {
    const root = resolve('/project');
    vol.fromJSON({
      [`${root}/Button.stories.svelte`]: text,
      [`${root}/sources.json`]: JSON.stringify([source]),
      [`${root}/storybook-static/index.json`]: JSON.stringify({
        entries: {
          'button--primary': {
            id: 'button--primary',
            title: 'Button',
            importPath: source.importPath,
            type: 'story',
            tags: ['autodocs'],
          },
        },
      }),
    });
    const components: CapturedComponents = {
      button: {
        id: 'button',
        name: 'Button',
        argTypes: {},
        stories: { 'button--primary': { snippet: '<Button/>' } },
      },
    };
    attachStorySources(components, `${root}/storybook-static`, 'revision', `${root}/sources.json`);
    expect(components.button.stories['button--primary'].source).toEqual(source);
    fs.writeFileSync(`${root}/Button.stories.svelte`, 'changed');
    expect(() =>
      attachStorySources(components, `${root}/storybook-static`, 'revision', `${root}/sources.json`)
    ).toThrow('changed since');
  });
});

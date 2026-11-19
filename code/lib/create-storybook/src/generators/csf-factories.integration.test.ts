import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const reactButtonStories = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../frameworks/react-vite/template/cli/ts/Button.stories.ts'
);

describe('shipped React CLI Button stories', () => {
  it('are native CSF4 with a relative preview import', () => {
    const source = readFileSync(reactButtonStories, 'utf8');

    expect(source).toContain("import preview from '../../.storybook/preview'");
    expect(source).toContain('preview.meta(');
    expect(source).toContain('meta.story(');
    expect(source).not.toContain('export default meta');
    expect(source).not.toContain('StoryObj');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findBabelConfigFile } from 'storybook/internal/common';

import { babelConfigWarning } from './babel-config-warning.ts';

vi.mock('storybook/internal/common', { spy: true });

describe('babelConfigWarning', () => {
  beforeEach(() => {
    vi.mocked(findBabelConfigFile).mockImplementation((dir) =>
      dir === '/project' ? '/project/babel.config.js' : undefined
    );
  });

  it('names the Babel config file and points to webpackFinal', () => {
    expect(babelConfigWarning('/project', {})).toMatchInlineSnapshot(
      `"Storybook ignores your Babel config (\`babel.config.js\`): it compiles Next.js with SWC only, so Babel plugins don't run in Storybook. Most have a next.config.js equivalent (\`compiler\`, \`experimental.swcPlugins\`). For the others, run the plugin with a \`babel-loader\` rule in \`webpackFinal\`, or set \`experimental.forceSwcTransforms: true\` to hide this warning. See https://storybook.js.org/docs/get-started/frameworks/nextjs#babel"`
    );
  });

  it('returns undefined when experimental.forceSwcTransforms is set', () => {
    expect(
      babelConfigWarning('/project', { experimental: { forceSwcTransforms: true } })
    ).toBeUndefined();
  });

  it('returns undefined when there is no Babel config', () => {
    expect(babelConfigWarning('/other', {})).toBeUndefined();
  });
});

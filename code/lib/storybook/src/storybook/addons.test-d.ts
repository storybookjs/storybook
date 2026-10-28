import { expectTypeOf, test } from 'vitest';

import a11y from '@storybook/addon-a11y/node';
import docs from '@storybook/addon-docs/node';
import links from '@storybook/addon-links/node';
import mcp from '@storybook/addon-mcp/node';
import onboarding from '@storybook/addon-onboarding/node';
import themes from '@storybook/addon-themes/node';
import vitest from '@storybook/addon-vitest/node';
import pseudoStates from 'storybook-addon-pseudo-states/node';
import { defineMain } from '@storybook/react-vite/node';
import type { StorybookPlugin, HookRegistrationKind, Collect } from 'storybook/internal/instance';

declare module '@storybook/core' {
  interface StorybookHooks {
    'type-test:paths:collect': Collect<(prefix: string) => string[]>;
  }
}

test('official addon factories accept only their supported options', () => {
  expectTypeOf(docs()).toMatchTypeOf<StorybookPlugin>();
  expectTypeOf(docs().meta.kind).toEqualTypeOf<'addon'>();
  docs({ defaultName: 'Reference', csfPluginOptions: null, mdxPluginOptions: {} });
  vitest({ enableCrashReports: false });
  mcp({ endpoint: '/tools', toolsets: { docs: false } });
  defineMain({
    framework: '@storybook/react-vite',
    stories: [],
    addons: [
      a11y(),
      docs(),
      links(),
      mcp(),
      onboarding(),
      themes(),
      vitest(),
      pseudoStates(),
      '@storybook/addon-designs',
    ],
  });

  // @ts-expect-error A11y settings belong in preview annotations.
  a11y({ manual: true });
  // @ts-expect-error Vitest plugin settings belong in the Vitest configuration.
  vitest({ storybookScript: 'storybook dev' });
  // @ts-expect-error MCP toolsets are booleans.
  mcp({ toolsets: { docs: 'false' } });
  // @ts-expect-error Documentation names are strings.
  docs({ defaultName: false });
});

test('only list-seeded collectors accept accumulator transforms', () => {
  expectTypeOf<HookRegistrationKind<'core:static-dirs:collect'>>().toEqualTypeOf<
    'collect' | 'reduce'
  >();
  expectTypeOf<HookRegistrationKind<'type-test:paths:collect'>>().toEqualTypeOf<'collect'>();
});

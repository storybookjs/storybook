/**
 * Keys of the overrides Storybook maintains in pnpm-workspace.yaml, as opposed to the overrides an
 * ecosystem CI runner injects there. These are NOT copied to the sandbox package.json.
 *
 * The keys use pnpm's selector syntax (`pkg@range`, `parent>child`), exactly as they appear in
 * pnpm-workspace.yaml. existing-resolutions.test.ts checks that this set stays in sync with it.
 */
export const EXISTING_RESOLUTIONS = new Set([
  '@angular/build>vitest',
  '@ai-sdk/anthropic',
  '@babel/runtime',
  '@babel/traverse',
  '@babel/types',
  '@playwright/test',
  '@storybook/addon-docs>react-dom',
  '@testing-library/jest-dom',
  '@testing-library/user-event@^14.6.8',
  '@types/babel__traverse',
  '@types/node',
  '@types/react',
  '@typescript-eslint/types',
  '@vercel/agent-eval-playground>react',
  '@vercel/agent-eval-playground>react-dom',
  'agent-eval>react',
  'agent-eval>react-dom',
  'aria-query@5.3.0',
  'caniuse-lite',
  'dom-accessibility-api@^0.5.14',
  'dom-accessibility-api@^0.5.9',
  'esbuild',
  'playwright',
  'playwright-core',
  'polka@1.0.0-next.28>@polka/url',
  'radix-ui@^1.4.3',
  'react',
  'react-aria',
  'react-joyride>type-fest',
  'react-stately',
  'rxjs',
  'typescript',
  'valibot',
  'vite-plus',
  'vitest>happy-dom',
]);

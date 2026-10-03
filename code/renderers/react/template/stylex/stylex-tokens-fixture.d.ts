// Types for the `stylex-tokens-fixture` package that the StyleX sandboxes install from
// `scripts/sandbox/fixtures/stylex/stylex-tokens-fixture`.
declare module 'stylex-tokens-fixture/tokens.stylex.js' {
  import type { VarGroup } from '@stylexjs/stylex';

  export const brand: VarGroup<{ accent: string }>;
}

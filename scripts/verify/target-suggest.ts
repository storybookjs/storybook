// Deterministic recommended verify-target hint for the recipe-author prompt.
//
// Given the list of paths changed by a PR, pick the verify-target the
// authoring guide says the spec SHOULD use. The agent still emits the
// `// @verify-target:` header itself, but past dispatches have guessed
// wrong (most recently: `sandbox:nextjs/default-ts` for an `nextjs-vite`
// diff, which compile-fails inside webpack). Surfacing the deterministic
// recommendation in the prompt bundle removes that guess.

import { minimatch } from 'minimatch';

export interface TargetSuggestion {
  /** Header value (e.g. `internal-ui`, `sandbox:nextjs-vite/default-ts`). */
  readonly target: string;
  /** Rule that matched, for prompt explanation. */
  readonly rationale: string;
  /** Globs from the rule that matched at least one changed path. */
  readonly matchedGlobs: readonly string[];
}

interface TargetRule {
  readonly globs: readonly string[];
  readonly target: string;
  readonly rationale: string;
}

// Rules are evaluated top-down; first match wins. Keep the most-specific
// framework/renderer rules above the generic renderer fallback so that a
// diff touching `code/frameworks/nextjs-vite/**` resolves to the Vite
// sandbox before any broader `code/renderers/react/**` rule could fire.
const RULES: readonly TargetRule[] = [
  {
    globs: ['code/frameworks/nextjs-vite/**'],
    target: 'sandbox:nextjs-vite/default-ts',
    rationale:
      'Diff touches code/frameworks/nextjs-vite/** — the Vite Next.js framework. The webpack sandbox (sandbox:nextjs/default-ts) compile-fails on nextjs-vite-specific imports, so the Vite sandbox is the only safe target.',
  },
  {
    globs: ['code/frameworks/nextjs/**'],
    target: 'sandbox:nextjs/default-ts',
    rationale: 'Diff touches code/frameworks/nextjs/** — the webpack Next.js framework.',
  },
  {
    globs: ['code/frameworks/svelte-vite/**', 'code/renderers/svelte/**'],
    target: 'sandbox:svelte-vite/default-ts',
    rationale: 'Diff touches Svelte renderer or svelte-vite framework code.',
  },
  {
    globs: ['code/frameworks/vue3-vite/**', 'code/renderers/vue3/**'],
    target: 'sandbox:vue3-vite/default-ts',
    rationale: 'Diff touches Vue3 renderer or vue3-vite framework code.',
  },
  {
    globs: ['code/frameworks/angular/**', 'code/frameworks/angular-vite/**'],
    target: 'sandbox:angular-cli/default-ts',
    rationale: 'Diff touches Angular framework code.',
  },
  {
    globs: ['code/frameworks/react-webpack5/**'],
    target: 'sandbox:react-webpack/default-ts',
    rationale: 'Diff touches the React + webpack5 framework.',
  },
  {
    globs: ['code/frameworks/react-vite/**'],
    target: 'sandbox:react-vite/default-ts',
    rationale: 'Diff touches the React + Vite framework.',
  },
];

const DEFAULT_SUGGESTION: TargetSuggestion = {
  target: 'internal-ui',
  rationale:
    'Diff does not touch a renderer- or framework-specific package. The internal-ui Storybook exercises core/manager/preview-api/csf-tools/addons/builders directly and is the right target for the vast majority of PRs.',
  matchedGlobs: [],
};

export function suggestVerifyTarget(changedPaths: readonly string[]): TargetSuggestion {
  for (const rule of RULES) {
    const matchedGlobs = rule.globs.filter((glob) => changedPaths.some((p) => minimatch(p, glob)));
    if (matchedGlobs.length > 0) {
      return { target: rule.target, rationale: rule.rationale, matchedGlobs };
    }
  }
  return DEFAULT_SUGGESTION;
}

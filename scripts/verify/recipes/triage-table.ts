// Triage routes for the PR verify harness recipe generator.
// Each entry maps a path glob (matched via minimatch) to one or more reference
// spec basenames under code/e2e-tests/. The triage module resolves these
// basenames to absolute paths and verifies their existence.

export interface TriageRoute {
  readonly pathGlob: string;
  readonly referenceSpecs: readonly string[];
  readonly rationale: string;
}

export const TRIAGE_ROUTES: ReadonlyArray<TriageRoute> = [
  {
    pathGlob: 'code/core/src/manager/**',
    referenceSpecs: ['manager.spec.ts', 'navigation.spec.ts'],
    rationale: 'Manager UI changes affect sidebar/toolbar layout and routing.',
  },
  {
    pathGlob: 'code/core/src/manager-api/**',
    referenceSpecs: ['manager.spec.ts'],
    rationale: 'manager-api state plumbing is observed via manager UI.',
  },
  {
    pathGlob: 'code/core/src/csf-tools/**',
    referenceSpecs: ['tags.spec.ts', 'change-detection.spec.ts'],
    rationale: 'CSF AST tooling drives indexing, tagging, and change detection.',
  },
  {
    pathGlob: 'code/core/src/preview-api/**',
    referenceSpecs: ['preview-api.spec.ts', 'storybook-hooks.spec.ts'],
    rationale: 'preview-api governs story preparation, args, decorators, hooks.',
  },
  {
    pathGlob: 'code/core/src/csf/**',
    referenceSpecs: ['tags.spec.ts'],
    rationale: 'CSF runtime shape is exercised by tag-aware story indexing.',
  },
  {
    pathGlob: 'code/builders/**',
    referenceSpecs: ['module-mocking.spec.ts'],
    rationale: 'Builder changes surface in preview-iframe load + module mocking.',
  },
  {
    pathGlob: 'code/addons/a11y/**',
    referenceSpecs: ['addon-a11y.spec.ts'],
    rationale: 'a11y addon panel and audit assertions.',
  },
  {
    pathGlob: 'code/addons/actions/**',
    referenceSpecs: ['addon-actions.spec.ts'],
    rationale: 'actions addon logging panel behavior.',
  },
  {
    pathGlob: 'code/addons/backgrounds/**',
    referenceSpecs: ['addon-backgrounds.spec.ts'],
    rationale: 'backgrounds addon toolbar + preview iframe styling.',
  },
  {
    pathGlob: 'code/addons/controls/**',
    referenceSpecs: ['addon-controls.spec.ts'],
    rationale: 'controls addon args panel and arg mutation flow.',
  },
  {
    pathGlob: 'code/addons/docs/**',
    referenceSpecs: ['addon-docs.spec.ts'],
    rationale: 'docs addon MDX rendering and docs-mode navigation.',
  },
  {
    pathGlob: 'code/addons/onboarding/**',
    referenceSpecs: ['addon-onboarding.spec.ts'],
    rationale: 'onboarding addon first-run flow.',
  },
  {
    pathGlob: 'code/addons/toolbars/**',
    referenceSpecs: ['addon-toolbars.spec.ts'],
    rationale: 'toolbars addon manager-side menu interactions.',
  },
  {
    pathGlob: 'code/addons/viewport/**',
    referenceSpecs: ['addon-viewport.spec.ts'],
    rationale: 'viewport addon toolbar + iframe resize behavior.',
  },
  {
    pathGlob: 'code/addons/mcp/**',
    referenceSpecs: ['addon-mcp.spec.ts'],
    rationale: 'mcp addon manager surface.',
  },
  {
    pathGlob: 'code/frameworks/svelte-vite/**',
    referenceSpecs: ['framework-svelte.spec.ts'],
    rationale: 'svelte-vite framework boot + render.',
  },
  {
    pathGlob: 'code/frameworks/nextjs/**',
    referenceSpecs: ['framework-nextjs.spec.ts'],
    rationale: 'Next.js (webpack) framework boot + render, including next/image and routing shims.',
  },
  {
    pathGlob: 'code/frameworks/nextjs-vite/**',
    referenceSpecs: ['framework-nextjs.spec.ts'],
    rationale:
      'Next.js (Vite) framework boot + render. Distinct from code/frameworks/nextjs/** (webpack) — must run on sandbox:nextjs-vite/default-ts, never on sandbox:nextjs/default-ts.',
  },
  {
    pathGlob: 'code/frameworks/vue3-vite/**',
    referenceSpecs: ['framework-vue3.spec.ts'],
    rationale: 'vue3-vite framework boot + render.',
  },
  {
    pathGlob: 'code/renderers/**',
    referenceSpecs: ['component-tests.spec.ts'],
    rationale: 'Renderer changes surface in component test run-time behavior.',
  },
];

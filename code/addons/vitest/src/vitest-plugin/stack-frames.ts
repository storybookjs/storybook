/**
 * Storybook instruments `expect`, `userEvent` and Testing Library so the Interactions panel can
 * replay a play function step by step. Every instrumented call therefore sits behind a handful of
 * wrapper frames inside Storybook's own bundles, which push the failing line in the story far down
 * the stack trace Vitest reports.
 *
 * These patterns match those bundles in the shapes a frame can take: the published package layout
 * after source maps are applied, and the pre-bundled dependency files Vite serves when no source
 * map is available.
 */
const INTERNAL_FRAME_PATTERNS = [
  /[\\/]storybook[\\/]dist[\\/]/,
  /[\\/]@storybook[\\/][^\\/]+[\\/]dist[\\/]/,
  /[\\/]deps[\\/]@?storybook[@_]/,
];

export function isStorybookInternalFrame(file: string | undefined): boolean {
  return !!file && INTERNAL_FRAME_PATTERNS.some((pattern) => pattern.test(file));
}

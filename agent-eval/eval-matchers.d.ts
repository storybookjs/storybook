// vitest matcher augmentation for @vercel/agent-eval 1.2.0's agentic judge matchers.
// This is a MODULE d.ts (the `import 'vitest'` makes it one) so `declare module 'vitest'`
// *merges* with vitest's real types instead of shadowing them. Paired with eval.d.ts.
import 'vitest';

declare module 'vitest' {
	// biome-ignore lint/suspicious/noExplicitAny: must match vitest's `Assertion<T = any>` to merge.
	interface Assertion<T = any> {
		/** LLM-judge: re-invokes the agent to judge `criterion` against the subject. */
		toSatisfyCriterion(criterion: string): Promise<void>;
		/** LLM-judge: scores the subject against `criterion`, asserts >= `threshold` (0–1). */
		toScoreAtLeast(criterion: string, threshold: number): Promise<void>;
	}
}

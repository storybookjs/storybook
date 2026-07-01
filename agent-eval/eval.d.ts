/// <reference path="./eval-matchers.d.ts" />
// Ambient types for @vercel/agent-eval 1.2.0's agentic judge subjects.
//
// 1.2.0 ships the eval helper as a runtime-only module
// (`dist/lib/agents/eval-helper.mjs`) — no `.d.ts` and no package `exports` map. At run
// time the generated vitest config aliases `@vercel/agent-eval/eval` to that helper and
// registers it as a setup file (which `expect.extend`s the matchers). These declarations
// exist only so the type-checker can resolve the import + matchers locally.
//
// This is a SCRIPT (global) d.ts — no top-level import/export — so `declare module`
// *declares* the ambient module rather than augmenting one. The reference above pulls in
// the vitest matcher augmentation (which must live in a module d.ts). Use from an EVAL.ts:
//   /// <reference path="../../eval.d.ts" />

declare module '@vercel/agent-eval/eval' {
	/** Opaque sentinels passed to `expect(...)`; the matcher routes by which one it is. */
	type JudgeSubject = { readonly __judgeSubject: 'environment' | 'transcript' };
	export const environment: JudgeSubject;
	export const transcript: JudgeSubject;
}

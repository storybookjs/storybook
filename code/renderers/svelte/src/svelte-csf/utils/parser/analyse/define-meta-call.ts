import type { SvelteNode } from "svelte/compiler";
import type { Visitors } from "zimmerframe";

import type { SvelteASTNodes } from "../extract-ast-nodes.js";

interface AnalyzeDefineMetaArgumentsOptions {
	defineMetaVariableDeclaration: SvelteASTNodes["defineMetaVariableDeclaration"];
	filename: string;
}

export async function analyzeDefineMetaArguments(
	options: AnalyzeDefineMetaArgumentsOptions,
) {
	const { walk } = await import("zimmerframe");

	const state = {};
	const visitors: Visitors<SvelteNode, typeof state> = {};
	walk(node, state, visitors);
}

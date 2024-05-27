import { compile, type Root } from "svelte/compiler";

interface GetSvelteASTOptions {
	source: string;
	filename: string;
}

export function getSvelteAST(options: GetSvelteASTOptions) {
	const { filename, source } = options;
	const { ast }: { ast: Root } = compile(source, {
		filename,
		modernAst: true,
	});

	return ast;
}

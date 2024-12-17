import { type SvelteAST } from '$lib/parser/ast.js';
export declare function extractSvelteNode<TNode extends SvelteAST.SvelteNode | SvelteAST.Script>(parsed: SvelteAST.SvelteNode | SvelteAST.Script, name: TNode['type']): Promise<TNode>;
export declare function parseAndExtractSvelteNode<TNode extends SvelteAST.SvelteNode | SvelteAST.Script>(code: string, name: TNode['type']): Promise<TNode>;

import type { Script, SvelteNode } from "svelte/compiler";
import type { Visitors } from "zimmerframe";

import pkg from "@storybook/addon-svelte-csf/package.json" with {
	type: "json",
};
import type { Identifier, ImportSpecifier, VariableDeclaration } from "estree";

const AST_NODES_NAMES = {
	defineMeta: "defineMeta",
	Story: "Story",
} as const;

interface SvelteASTNodesModule {
	/**
	 * Import specifier for `defineMeta` imported from this addon package.
	 * Could be renamed - e.g. `import { defineMeta } from "@storybook/addon-svelte-csf"`
	 */
	defineMetaImport: ImportSpecifier;
	/**
	 * Variable declaration: `const { Story } = defineMeta({ })`
	 * Could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
	 */
	defineMetaVariableDeclaration: VariableDeclaration;
	/**
	 * An identifier for the addon's component `<Story />`.
	 * It could be destructured with rename - e.g. `const { Story: S } = defineMeta({ ... })`
	 */
	storyIdentifier: Identifier;
}

interface ExtractModuleNodesOptions {
	module: Script;
	filename: string;
}

/**
 * Extract Svelte AST nodes via `svelte.compile`,
 * and from the module tag - `<script context=module>`.
 * They are needed for further code analysis/transformation.
 */
export async function extractModuleNodes(
	options: ExtractModuleNodesOptions,
): Promise<SvelteASTNodesModule> {
	const { module, filename } = options;

	const { walk } = await import("zimmerframe");

	const state: Partial<SvelteASTNodesModule> = {};
	const visitors: Visitors<SvelteNode, typeof state> = {
		ImportDeclaration(node, { state, visit }) {
			const { source, specifiers } = node;

			if (source.value === pkg.name) {
				for (const specifier of specifiers) {
					if (specifier.type !== "ImportSpecifier") {
						throw new Error(
							`Don't use the default/namespace import from "${pkg.name}" in the stories file: ${filename}`,
						);
					}

					visit(specifier, state);
				}
			}
		},

		ImportSpecifier(node, {}) {
			if (node.imported.name === AST_NODES_NAMES.defineMeta) {
				state.defineMetaImport = node;
			}
		},

		VariableDeclaration(node, { state }) {
			const { declarations } = node;
			const declaration = declarations[0];
			const { id, init } = declaration;

			if (
				id.type === "ObjectPattern" &&
				init?.type === "CallExpression" &&
				init.callee.type === "Identifier" &&
				init.callee.name === state.defineMetaImport?.local.name
			) {
				state.defineMetaVariableDeclaration = node;

				for (const property of id.properties) {
					if (
						property.type === "Property" &&
						property.key.type === "Identifier" &&
						property.key.name === AST_NODES_NAMES.Story &&
						property.value.type === "Identifier"
					) {
						state.storyIdentifier = property.value;
					}
				}
			}
		},
	};

	walk(module.content, state, visitors);

	const { defineMetaImport, defineMetaVariableDeclaration, storyIdentifier } =
		state;

	if (!defineMetaImport) {
		throw new Error(
			`Could not find '${AST_NODES_NAMES.defineMeta}' imported from the "${pkg.name}" in the stories file: ${filename}`,
		);
	}

	if (!defineMetaVariableDeclaration) {
		throw new Error(
			`Could not find '${defineMetaImport.local.name}({ ... })' call in the module tag ('<script context="module">') of the stories file: ${filename}`,
		);
	}

	if (!storyIdentifier) {
		throw new Error(
			`Component 'Story' was not destructured from the '${defineMetaImport.local.name}({ ... })' function call. Use 'const { Story } = defineMeta({ ... })' in the stories file: ${filename}`,
		);
	}

	return {
		defineMetaImport,
		defineMetaVariableDeclaration,
		storyIdentifier,
	};
}

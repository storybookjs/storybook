/**
 * @vitest-environment node
 */

import { parseAstAsync } from "rollup/parseAst";
import { describe, it } from "vitest";

import { compileFromString } from "../../../../test/compile.js";

import { extractCompiledASTNodes } from "./nodes.js";

describe(extractCompiledASTNodes.name, () => {
	it.fails("testing inline compile/parsing", async ({ expect }) => {
		const compiled = await compileFromString(`
<script>
import { defineMeta } from "@storybook/addon-svelte-csf";
export const { Story } = defineMeta();
</script>
    `);
		console.log({ compiled });
		const ast = await parseAstAsync(compiled);
		console.log({ ast });

		expect(() => extractCompiledASTNodes({ ast })).resolves.not.toThrow();
	});
});

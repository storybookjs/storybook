import { describe, expect, it } from "vitest";

import { getStoryIdentifiers, getStoriesIdentifiers } from "./identifiers";

import { getSvelteAST } from "#parser/ast";
import { extractSvelteASTNodes } from "#parser/extract/svelte/nodes";
import { extractStoryAttributesNodes } from "#parser/extract/svelte/story/attributes";

describe(getStoryIdentifiers.name, () => {
	it("extracts 'exportName' attribute when is a Text string", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story exportName="Text" />
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName, name } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName", "name"],
		});

		expect(
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: name,
				component,
			}),
		).toEqual({
			exportName: "Text",
			name: undefined,
		});
	});

	it("extracts 'exportName' attribute when is an expression with literal", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story exportName={"ExpressionWithLiteral"} />
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName, name } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName", "name"],
		});

		expect(
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: name,
				component,
			}),
		).toEqual({
			exportName: "ExpressionWithLiteral",
			name: undefined,
		});
	});

	it("throws when '<Story />' doesn't provide an 'exportName' or 'name' attribute prop", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story />
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName, name } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName", "name"],
		});

		expect(() =>
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: name,
				filename: "invalid.stories.svelte",
				component,
			}),
		).toThrowErrorMatchingInlineSnapshot(
			`
      [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0004 (NoStoryIdentifierError): Missing 'name' or 'exportName' attribute (prop) in a '<Story />' definition in the stories file:  'file://${process.cwd()}/invalid.stories.svelte'.
      All stories must either have a 'name' or an 'exportName' prop.]
    `,
		);
	});

	it("it ignores the 'exportName' attribute of '<Story>'s children component", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story exportName="Default">
          <Icon exportName="close" />
        </Story>
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName", "args"],
		});

		expect(
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: undefined,
				component,
			}),
		).toEqual({
			exportName: "Default",
			name: undefined,
		});
	});

	it("extracts both 'exportName' and 'name' attributes", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story exportName="SomeExportName" name="some name" />
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName, name } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName", "name"],
		});

		expect(
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: name,
				component,
			}),
		).toEqual({
			exportName: "SomeExportName",
			name: "some name",
		});
	});

	it("derives 'exportName' from 'name' attribute when 'exportName' attribute is missing", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story name="some name" />
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName, name } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName", "name"],
		});

		expect(
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: name,
				component,
			}),
		).toEqual({
			exportName: "SomeName",
			name: "some name",
		});
	});

	it("throws when 'exportName' is not a valid JavaScript variable name", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>
        <Story exportName="default" />
      `,
		});
		const nodes = await extractSvelteASTNodes({ ast });
		const { component } = nodes.storyComponents[0];
		const { exportName } = extractStoryAttributesNodes({
			component,
			attributes: ["exportName"],
		});

		expect(() =>
			getStoryIdentifiers({
				exportNameNode: exportName,
				nameNode: undefined,
				filename: "invalid.stories.svelte",
				component,
			}),
		).toThrowErrorMatchingInlineSnapshot(
			`
      [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0005 (InvalidStoryExportNameError): Invalid attribute 'exportName' value 'default' found in '<Story />' component inside stories file: file://${process.cwd()}/invalid.stories.svelte

        'exportName' alue must be a valid JavaScript variable name.
        It must start with a letter, $ or _, followed by letters, numbers, $ or _.
        Reserved words like 'default' are also not allowed (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words)]
    `,
		);
	});
});

describe(getStoriesIdentifiers.name, () => {
	it("extracts multiple <Story /> components identifiers", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>

        <Story name="Only name" />
        <Story exportName="OnlyExportName" />
        <Story exportName="BothExportNameAndName" name="Both export name and name" />
        <Story exportName="DifferentExportName" name="ExportName and name, but different" />`,
		});
		const nodes = await extractSvelteASTNodes({ ast });

		expect(getStoriesIdentifiers({ nodes })).toMatchInlineSnapshot(`
      [
        {
          "exportName": "OnlyName",
          "name": "Only name",
        },
        {
          "exportName": "OnlyExportName",
          "name": undefined,
        },
        {
          "exportName": "BothExportNameAndName",
          "name": "Both export name and name",
        },
        {
          "exportName": "DifferentExportName",
          "name": "ExportName and name, but different",
        },
      ]
    `);
	});

	it("throws on identical 'exportName' attributes", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>

        <Story exportName="SomeExportName" />
        <Story exportName="OtherExportName" />
        <Story exportName="SomeExportName" />`,
		});
		const nodes = await extractSvelteASTNodes({ ast });

		expect(() =>
			getStoriesIdentifiers({
				nodes,
				filename: "duplicate-identifiers.stories.svelte",
			}),
		).toThrowErrorMatchingInlineSnapshot(
			`
      [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0006 (DuplicateStoryIdentifiersError): Duplicate exportNames found between two '<Story />' definitions in stories file: file://${process.cwd()}/duplicate-identifiers.stories.svelte

      First instance: <Story name={undefined} exportName="SomeExportName" ... />
      Second instance: <Story name={undefined} exportName="SomeExportName" ... />

      This can happen when 'exportName' is implicitly derived by 'name'.
      Complex names will be simplified to a PascalCased, valid JavaScript variable name,
      eg. 'Some story name!!' will be converted to 'SomeStoryName'.
      You can fix this collision by providing a unique 'exportName' prop with <Story exportName="SomeUniqueExportName" ... />.]
    `,
		);
	});

	it("throws on identical 'exportName' attributes when deriving from 'name' attributes", async () => {
		const ast = getSvelteAST({
			code: `
        <script context="module">
          import { defineMeta } from "@storybook/addon-svelte-csf"
          const { Story } = defineMeta();
        </script>

        <Story exportName="SomeStoryName" />
        <Story name="some story name!!!" />`,
		});
		const nodes = await extractSvelteASTNodes({ ast });

		expect(() =>
			getStoriesIdentifiers({
				nodes,
				filename: "duplicate-identifiers.stories.svelte",
			}),
		).toThrowErrorMatchingInlineSnapshot(
			`
      [SB_SVELTE_CSF_PARSER_ANALYSE_STORY_0006 (DuplicateStoryIdentifiersError): Duplicate exportNames found between two '<Story />' definitions in stories file: file://${process.cwd()}/duplicate-identifiers.stories.svelte

      First instance: <Story name={undefined} exportName="SomeStoryName" ... />
      Second instance: <Story name="some story name!!!" exportName="SomeStoryName" ... />

      This can happen when 'exportName' is implicitly derived by 'name'.
      Complex names will be simplified to a PascalCased, valid JavaScript variable name,
      eg. 'Some story name!!' will be converted to 'SomeStoryName'.
      You can fix this collision by providing a unique 'exportName' prop with <Story exportName="SomeUniqueExportName" ... />.]
    `,
		);
	});
});

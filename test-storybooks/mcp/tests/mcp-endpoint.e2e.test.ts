import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { x } from 'tinyexec';
import {
	STORYBOOK_DIR,
	createMCPRequestBody,
	parseMCPResponse,
	waitForMcpEndpoint,
	killPort,
	stopStorybook,
} from './helpers';

const PORT = 6006;
const MCP_ENDPOINT = `http://localhost:${PORT}/mcp`;
const STARTUP_TIMEOUT = 30_000;

let storybookProcess: ReturnType<typeof x> | null = null;

async function mcpRequest(method: string, params: any = {}, id: number = 1) {
	const response = await fetch(MCP_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(createMCPRequestBody(method, params, id)),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	return parseMCPResponse(response);
}

describe('MCP Endpoint E2E Tests', () => {
	beforeAll(async () => {
		await killPort(PORT);
		storybookProcess = x('pnpm', ['storybook'], {
			nodeOptions: {
				cwd: STORYBOOK_DIR,
			},
		});

		await waitForMcpEndpoint(MCP_ENDPOINT);
	}, STARTUP_TIMEOUT);

	afterAll(async () => {
		await stopStorybook(storybookProcess);
		storybookProcess = null;
	});

	describe('Session Initialization', () => {
		it('should successfully initialize an MCP session', async () => {
			const response = await mcpRequest('initialize', {
				protocolVersion: '2025-06-18',
				capabilities: {},
				clientInfo: {
					name: 'e2e-test-client',
					version: '1.0.0',
				},
			});

			expect(response).toMatchObject({
				jsonrpc: '2.0',
				id: 1,
				result: {
					protocolVersion: '2025-06-18',
					capabilities: {
						tools: { listChanged: true },
					},
					serverInfo: {
						name: '@storybook/addon-mcp',
						description: expect.stringContaining('agents'),
					},
				},
			});

			expect(response.result.serverInfo.version).toBeDefined();
		});

		it('should return error for invalid protocol version', async () => {
			const response = await mcpRequest('initialize', {
				protocolVersion: '1.0.0', // Invalid version
				capabilities: {},
				clientInfo: {
					name: 'test',
					version: '1.0.0',
				},
			});

			expect(response.error).toMatchInlineSnapshot(`
				{
				  "code": 0,
				  "message": "MCP error -32602: Invalid protocol version format",
				}
			`);
		});
	});

	describe('Tools Discovery', () => {
		it('should list available tools', async () => {
			const response = await mcpRequest('tools/list');

			expect(response.result).toHaveProperty('tools');
			// Dev, docs, and test tools should be present
			expect(response.result.tools).toHaveLength(9);

			expect(response.result.tools).toMatchInlineSnapshot(`
				[
				  {
				    "_meta": {
				      "ui": {
				        "resourceUri": "ui://preview-stories/preview.html",
				      },
				    },
				    "description": "Use this tool to get Storybook preview URLs while iterating on a specific story, or when the user asks for a direct link to one.
				Do not end visual work or browse requests with these links — publish a curated review with display-review instead (passing changedFiles: [] when no code changed) and link that.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "stories": {
				          "description": "Stories to preview.
				Prefer { storyId } when you don't already have story file context, since this avoids filesystem discovery.
				Use { storyId } when IDs were discovered from documentation tools.
				Use { absoluteStoryPath + exportName } only when you're already working in a specific .stories.* file and already have that context.",
				          "items": {
				            "anyOf": [
				              {
				                "properties": {
				                  "absoluteStoryPath": {
				                    "description": "Absolute path to the story file. Use together with exportName only when story file context is already available.",
				                    "type": "string",
				                  },
				                  "explicitStoryName": {
				                    "description": "If the story has an explicit name set via the "name" property, that is different from the export name, provide it here.
				Otherwise don't set this.",
				                    "type": "string",
				                  },
				                  "exportName": {
				                    "description": "The export name of the story from the story file.
				Use this path-based shape only when you're already editing a .stories.* file and know the export names in that file.
				If you do not already have story file context, prefer the storyId shape instead of searching files.",
				                    "type": "string",
				                  },
				                  "globals": {
				                    "additionalProperties": {},
				                    "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                  "props": {
				                    "additionalProperties": {},
				                    "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                },
				                "required": [
				                  "exportName",
				                  "absoluteStoryPath",
				                ],
				                "type": "object",
				              },
				              {
				                "properties": {
				                  "globals": {
				                    "additionalProperties": {},
				                    "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                  "props": {
				                    "additionalProperties": {},
				                    "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                  "storyId": {
				                    "description": "The full Storybook story ID (for example "button--primary").
				Prefer this shape whenever you are not already working in a specific story file.
				Use IDs discovered from list-all-documentation (withStoryIds=true) or get-documentation.",
				                    "type": "string",
				                  },
				                },
				                "required": [
				                  "storyId",
				                ],
				                "type": "object",
				              },
				            ],
				          },
				          "type": "array",
				        },
				      },
				      "required": [
				        "stories",
				      ],
				      "type": "object",
				    },
				    "name": "preview-stories",
				    "outputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "stories": {
				          "items": {
				            "anyOf": [
				              {
				                "properties": {
				                  "name": {
				                    "type": "string",
				                  },
				                  "previewUrl": {
				                    "description": "Direct URL to open the story preview. Include this URL in the final user-facing response so users can open it directly — unless a curated review page is being published via display-review, in which case link the review page instead of listing individual URLs.",
				                    "type": "string",
				                  },
				                  "title": {
				                    "type": "string",
				                  },
				                },
				                "required": [
				                  "title",
				                  "name",
				                  "previewUrl",
				                ],
				                "type": "object",
				              },
				              {
				                "properties": {
				                  "error": {
				                    "type": "string",
				                  },
				                  "input": {
				                    "anyOf": [
				                      {
				                        "properties": {
				                          "absoluteStoryPath": {
				                            "description": "Absolute path to the story file. Use together with exportName only when story file context is already available.",
				                            "type": "string",
				                          },
				                          "explicitStoryName": {
				                            "description": "If the story has an explicit name set via the "name" property, that is different from the export name, provide it here.
				Otherwise don't set this.",
				                            "type": "string",
				                          },
				                          "exportName": {
				                            "description": "The export name of the story from the story file.
				Use this path-based shape only when you're already editing a .stories.* file and know the export names in that file.
				If you do not already have story file context, prefer the storyId shape instead of searching files.",
				                            "type": "string",
				                          },
				                          "globals": {
				                            "additionalProperties": {},
				                            "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                            "propertyNames": {
				                              "type": "string",
				                            },
				                            "type": "object",
				                          },
				                          "props": {
				                            "additionalProperties": {},
				                            "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                            "propertyNames": {
				                              "type": "string",
				                            },
				                            "type": "object",
				                          },
				                        },
				                        "required": [
				                          "exportName",
				                          "absoluteStoryPath",
				                        ],
				                        "type": "object",
				                      },
				                      {
				                        "properties": {
				                          "globals": {
				                            "additionalProperties": {},
				                            "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                            "propertyNames": {
				                              "type": "string",
				                            },
				                            "type": "object",
				                          },
				                          "props": {
				                            "additionalProperties": {},
				                            "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                            "propertyNames": {
				                              "type": "string",
				                            },
				                            "type": "object",
				                          },
				                          "storyId": {
				                            "description": "The full Storybook story ID (for example "button--primary").
				Prefer this shape whenever you are not already working in a specific story file.
				Use IDs discovered from list-all-documentation (withStoryIds=true) or get-documentation.",
				                            "type": "string",
				                          },
				                        },
				                        "required": [
				                          "storyId",
				                        ],
				                        "type": "object",
				                      },
				                    ],
				                  },
				                },
				                "required": [
				                  "input",
				                  "error",
				                ],
				                "type": "object",
				              },
				            ],
				          },
				          "type": "array",
				        },
				      },
				      "required": [
				        "stories",
				      ],
				      "type": "object",
				    },
				    "title": "Get story preview URLs",
				  },
				  {
				    "description": "Get comprehensive instructions for writing, testing, and fixing Storybook stories (.stories.tsx, .stories.ts, .stories.jsx, .stories.js, .stories.svelte, .stories.vue files).

				CRITICAL: You MUST call this tool before:
				- Creating new Storybook stories or story files
				- Updating or modifying existing Storybook stories
				- Adding new story variants or exports to story files
				- Editing any file matching *.stories.* patterns
				- Writing components that will need stories
				- Editing anything that changes how the UI looks — components, styles, CSS, themes, colors, or design tokens; a shared file with no stories of its own still changes its consumers' stories
				- Running story tests or fixing test failures
				- Handling accessibility (a11y) violations in stories (fix semantic issues directly; ask before visual/design changes)

				This tool provides essential Storybook-specific guidance including:
				- How to structure stories correctly for Storybook 9
				- Required imports (Meta, StoryObj from framework package)
				- Test utility imports (from 'storybook/test')
				- Story naming conventions and best practices
				- Play function patterns for interactive testing
				- Mocking strategies for external dependencies
				- Story variants and coverage requirements
				- How to handle test failures and accessibility violations

				Even if you're familiar with Storybook, call this tool to ensure you're following the correct patterns, import paths, and conventions for this specific Storybook setup.",
				    "inputSchema": {
				      "properties": {},
				      "type": "object",
				    },
				    "name": "get-storybook-story-instructions",
				    "title": "Storybook Story Development Instructions",
				  },
				  {
				    "description": "Get Storybook stories marked as new, modified, or related. Returns story metadata only (no URLs).

				The result reflects the cumulative working-tree diff, not just your latest edit — after multiple edits in one session, a non-empty result may cover an earlier sub-change and miss your most recent one. Check that every file you touched is represented; for any that isn't, find its consumer components and pass their paths to get-stories-by-component instead. The response surfaces this gap with a "coverage sanity check" hint when it detects unreachable working-tree files.",
				    "inputSchema": {
				      "properties": {},
				      "type": "object",
				    },
				    "name": "get-changed-stories",
				    "title": "Get changed stories metadata",
				  },
				  {
				    "description": "Map component source files to the stories that render them, returning grounded \`storyId\` values from the live Storybook index — hand these to preview-stories or display-review instead of guessing.

				Reach for this whenever you need story IDs, whatever shape the input has: files you just edited, a feature/domain/topic the user named, a query like "all consumers of X", or an autonomous review after a UI change. First resolve the input to a list of absolute component file paths using filesystem search (grep / Glob / find) and code reading — that bridge is yours to build; this tool starts where it ends. One common trap: when the changed file is _shared_ infrastructure (theme token, design token, util, hook, CSS module) it isn't itself a component — grep for its consumers and pass _their_ paths, not the shared file's. If the symbol you grepped looks like one member of a related group (sibling tokens, neighboring exports), widen to the rest of the group too — a too-narrow grep silently drops stories. Try \`get-changed-stories\` first for "I just edited X" when it's available; if a file you touched is missing from its response, treat that file as the shared-infrastructure case and route its consumers through this tool.

				Results are sorted by \`distance\` (0 = the path you passed is itself a story file, 1 = direct importer, 2+ = transitive; lower = stronger). Shared primitives are usually consumed through wrapper components, so the distance-1 bucket is often empty — the default \`maxDistance: 3\` keeps that cascade visible while capping noise from wide decorators; raise it to widen recall, lower it to tighten precision. For display-review, the distance buckets map onto the visual cascade (the component itself → direct importers → page-level context) — one collection per layer; when several stories of a component share a distance, prefer the variant whose name signals it renders the changed surface.

				Never invent IDs from file names, feature names, or memory; title strings can be overridden by story authors, so only IDs returned by discovery tools resolve. If a component has no matches here, it has no stories yet (say so, don't fabricate).

				Backed by Storybook's live reverse dependency graph, available only when the dev server runs a builder that supports change detection (e.g. Vite) — otherwise returns a typed error.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "componentPaths": {
				          "description": "Absolute paths to component source files (e.g. "/repo/src/Button.tsx").
				Pass the components you actually want stories for — typically files you just read, edited, or that the user mentioned.
				Relative paths are also accepted and resolved against the Storybook working directory, but absolute paths are preferred for unambiguous results.
				Story files (\`*.stories.*\`) are accepted too: they appear at distance 0 as self-matches, plus any reverse-graph hits (other stories that import them).",
				          "items": {
				            "type": "string",
				          },
				          "minItems": 1,
				          "type": "array",
				        },
				        "maxDistance": {
				          "description": "Ceiling on the import depth to include in results. Must be a positive integer.
				- 1: only stories that directly import the component.
				- 2+: also include stories that reach the component through N hops.
				Defaults to 3; raise it to widen recall, lower it to tighten precision. Shared components (Button, Icon, …) accumulate noisy indirect matches at distance ≥ 3, so the default cap protects against runaway results.",
				          "minimum": 1,
				          "type": "integer",
				        },
				      },
				      "required": [
				        "componentPaths",
				      ],
				      "type": "object",
				    },
				    "name": "get-stories-by-component",
				    "outputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "results": {
				          "items": {
				            "properties": {
				              "clipped": {
				                "description": "Present only when \`maxDistance\` filtered out one or more matches. \`count\` is how many were dropped; \`distances\` lists the (sorted, distinct) distances those dropped matches sat at — widen \`maxDistance\` to include them.",
				                "properties": {
				                  "count": {
				                    "type": "number",
				                  },
				                  "distances": {
				                    "items": {
				                      "type": "number",
				                    },
				                    "type": "array",
				                  },
				                },
				                "required": [
				                  "count",
				                  "distances",
				                ],
				                "type": "object",
				              },
				              "componentPath": {
				                "type": "string",
				              },
				              "matches": {
				                "items": {
				                  "properties": {
				                    "distance": {
				                      "description": "Import-graph depth from the story file to the component (lower = stronger). 0: the path you passed is itself a story file (self-match). 1: story file directly imports the component. 2+: reached through N hops.",
				                      "type": "number",
				                    },
				                    "importPath": {
				                      "type": "string",
				                    },
				                    "name": {
				                      "type": "string",
				                    },
				                    "storyId": {
				                      "type": "string",
				                    },
				                    "title": {
				                      "type": "string",
				                    },
				                  },
				                  "required": [
				                    "storyId",
				                    "title",
				                    "name",
				                    "importPath",
				                    "distance",
				                  ],
				                  "type": "object",
				                },
				                "type": "array",
				              },
				              "pathNotFound": {
				                "description": "\`true\` when no file exists at the resolved absolute path. Distinguishes a typo from "this component has no stories yet". The agent should re-check the path it sent.",
				                "type": "boolean",
				              },
				            },
				            "required": [
				              "componentPath",
				              "matches",
				            ],
				            "type": "object",
				          },
				          "type": "array",
				        },
				      },
				      "required": [
				        "results",
				      ],
				      "type": "object",
				    },
				    "title": "Get stories for component files",
				  },
				  {
				    "description": "Publish a curated review to Storybook's review page for spot-checking **visual impact**. Each call replaces the single active review — call it again whenever the user iterates on the changes.

				## When to call
				- **Trigger 1 — visual change** (components, stories, CSS, themes, colors, design tokens, i18n — anything that changes how the UI looks): when the user should spot-check rendering. A shared file (token, style, util) has no stories of its own — review its consumers' stories. Skip non-visual refactors unless side-effects are plausible. Start from \`get-changed-stories\`; fall back to \`get-stories-by-component\` if change detection is unavailable. Include \`changedFiles\`.
				- **Trigger 2 — browse request** ("show me the Badge component"): resolve via \`get-stories-by-component\` / \`list-all-documentation\`; you may consult other sources to interpret the ask, but IDs must still come from those tools. Pass \`changedFiles: []\` — no code changed.

				## Hard rules
				1. Every \`storyId\` MUST come from those tools. Reject IDs derived from file paths, story names, or memory. Unknown IDs cause a runtime error; obtain real IDs via \`get-stories-by-component\` or \`list-all-documentation\`, then retry.
				2. Every story you CREATED in this change MUST appear in the review — including interaction/play-function stories. Showing the stories you modified is encouraged too. Curate by grouping, never by omission.
				3. Prefer 2-5 collections; avoid one-story collections unless truly isolated.
				4. Follow-up reviews: stabilize collection/story order to avoid disorientation from reshuffling.
				5. Apply the field formatting rules from each schema property. Do not use em-dashes in review payload field values (title, rationale, description, etc.).
				6. Do not instruct or tell the user what to do unless they explicitly ask for guidance.
				7. "Collection" and "trigger" are internal terms for this tool's mechanics and mean nothing to users. Never use them in user-facing text unless the user used them first; say "group of stories" or just describe the contents in plain language.

				## Curating (Trigger 1)
				Trace the **visual cascade** up the **import graph** to **page-level UI surfaces** — one collection per layer (\`distance 0\` → direct importers → page context). Include **control stories** where the change is **not supposed to be visible**. **Theme tokens**, **shared styles**, and **layout primitives** need page-level coverage even from a single-file edit. **Localized changes:** affected component → **usage locations** → outer surfaces. **Larger features:** central page/module → lower-level pieces → outer **usage locations**.

				## Curating (Trigger 2)
				Exactly what the user asked for — **no more, no less**. Group logically or follow **story index hierarchy**.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "changedFiles": {
				          "description": "Paths of the files you changed, most central first. Pass an empty array \`[]\` only when no code changed (browse requests, Trigger 2).",
				          "items": {
				            "type": "string",
				          },
				          "type": "array",
				        },
				        "collections": {
				          "description": "Groups of stories to show in the review, most relevant first. Prefer 2-5 groups. Each item is an object with three required fields: \`title\` (string, what the group is), \`rationale\` (string, why it is relevant), and \`storyIds\` (array of story ID strings the group renders). Note the field is \`storyIds\` (a plain array of ID strings), not \`stories\`.",
				          "items": {
				            "properties": {
				              "rationale": {
				                "description": "Rationale explaining **why** this collection is relevant to the user. Shown alongside the title. One or two sentences. Plain text, no markdown.",
				                "type": "string",
				              },
				              "storyIds": {
				                "description": "Story IDs that represent this collection (e.g. "button--primary"). The page renders exactly these.",
				                "items": {
				                  "type": "string",
				                },
				                "type": "array",
				              },
				              "title": {
				                "description": "Title describing **what** this collection consists of, phrased the way a person would say it. Avoid typographic marks and CamelCase. Plain text, no markdown.",
				                "type": "string",
				              },
				            },
				            "required": [
				              "title",
				              "rationale",
				              "storyIds",
				            ],
				            "type": "object",
				          },
				          "type": "array",
				        },
				        "description": {
				          "description": "Description of the review scope, including what's there, why it's relevant, and what to look for. Preferably one or two sentences. At most 2 paragraphs for reviews spanning multiple topics. Markdown formatting restricted to **bold**, _italic_, and \`code\` (backticks). Use emphasis for the key **what** and _why_, and backticks for literal source code references like component or token names.",
				          "type": "string",
				        },
				        "title": {
				          "description": "Terse, human-readable title for the overall review. What is this review about? Avoid typographic marks and CamelCase. Plain text, no markdown.",
				          "type": "string",
				        },
				      },
				      "required": [
				        "title",
				        "description",
				        "collections",
				        "changedFiles",
				      ],
				      "type": "object",
				    },
				    "name": "display-review",
				    "outputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "reviewUrl": {
				          "description": "URL of the Storybook review page. Always include this URL in your final user-facing response so the user can open it directly.",
				          "type": "string",
				        },
				      },
				      "required": [
				        "reviewUrl",
				      ],
				      "type": "object",
				    },
				    "title": "Display Storybook review",
				  },
				  {
				    "description": "Run story tests.
				Run them after editing anything that changes how the UI looks — components, stories, styles, CSS, themes, colors, or design tokens — shell-level substitutes like typecheck, lint, or package.json test scripts do not replace this.
				Provide stories for focused runs (faster while iterating),
				or omit stories to run all tests for full-project verification.
				Use this continuously to monitor test results as you work on your UI components and stories.
				Results will include passing/failing status, and accessibility violation reports.
				For visual/design accessibility violations (for example color contrast), ask the user before changing styles.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "a11y": {
				          "default": true,
				          "description": "Whether to run accessibility tests. Defaults to true. Disable if you only need component test results.",
				          "type": "boolean",
				        },
				        "stories": {
				          "description": "Stories to test for focused feedback. Omit this field to run tests for all available stories.
				Prefer running tests for specific stories while developing to get faster feedback,
				and only omit this when you explicitly need to run all tests for comprehensive verification.
				Prefer { storyId } when you don't already have story file context, since this avoids filesystem discovery.
				Use { storyId } when IDs were discovered from documentation tools.
				Use { absoluteStoryPath + exportName } only when you're currently working in a story file and already know those values.",
				          "items": {
				            "anyOf": [
				              {
				                "properties": {
				                  "absoluteStoryPath": {
				                    "description": "Absolute path to the story file. Use together with exportName only when story file context is already available.",
				                    "type": "string",
				                  },
				                  "explicitStoryName": {
				                    "description": "If the story has an explicit name set via the "name" property, that is different from the export name, provide it here.
				Otherwise don't set this.",
				                    "type": "string",
				                  },
				                  "exportName": {
				                    "description": "The export name of the story from the story file.
				Use this path-based shape only when you're already editing a .stories.* file and know the export names in that file.
				If you do not already have story file context, prefer the storyId shape instead of searching files.",
				                    "type": "string",
				                  },
				                  "globals": {
				                    "additionalProperties": {},
				                    "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                  "props": {
				                    "additionalProperties": {},
				                    "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                },
				                "required": [
				                  "exportName",
				                  "absoluteStoryPath",
				                ],
				                "type": "object",
				              },
				              {
				                "properties": {
				                  "globals": {
				                    "additionalProperties": {},
				                    "description": "Optional Storybook globals to set for the story preview. Globals are used for things like theme, locale, viewport, and other cross-cutting concerns.
				Common globals include 'theme' (e.g., 'dark', 'light'), 'locale' (e.g., 'en', 'fr'), and 'backgrounds' (e.g., { value: '#000' }).",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                  "props": {
				                    "additionalProperties": {},
				                    "description": "Optional custom props to pass to the story for rendering. Use this when you don't want to render the default story,
				but you want to customize some args or other props.
				You can look up the component's documentation using the get-storybook-story-instructions tool to see what props are available.",
				                    "propertyNames": {
				                      "type": "string",
				                    },
				                    "type": "object",
				                  },
				                  "storyId": {
				                    "description": "The full Storybook story ID (for example "button--primary").
				Prefer this shape whenever you are not already working in a specific story file.
				Use IDs discovered from list-all-documentation (withStoryIds=true) or get-documentation.",
				                    "type": "string",
				                  },
				                },
				                "required": [
				                  "storyId",
				                ],
				                "type": "object",
				              },
				            ],
				          },
				          "type": "array",
				        },
				      },
				      "required": [],
				      "type": "object",
				    },
				    "name": "run-story-tests",
				    "title": "Storybook Tests",
				  },
				  {
				    "description": "List all available UI components and documentation entries from the Storybook, returning the IDs the other documentation tools take as input. Call this first for any UI task — before writing a new component, check what the design system already provides and build on it instead of hand-rolling a duplicate; before answering any question about props, API, or usage, discover the relevant IDs here rather than reading component source. Then fetch the entries with get-documentation, referencing only IDs returned here — never guess IDs. When multiple Storybook sources are configured, entries from every source are included; scope follow-up calls to one source via their \`storybookId\` input. Pass \`withStoryIds: true\` when you need story IDs for other tools.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "withStoryIds": {
				          "default": false,
				          "description": "When true, includes story sub-bullets under each component with story name and story ID. Use this to discover IDs for downstream story-focused workflows without filesystem lookup.",
				          "type": "boolean",
				        },
				      },
				      "required": [],
				      "type": "object",
				    },
				    "name": "list-all-documentation",
				    "title": "List All Documentation",
				  },
				  {
				    "description": "Get documentation for a UI component or docs entry.

				Returns the first 3 stories (including story IDs) with code snippets showing how props are used, plus TypeScript prop definitions. Call this before using a component to avoid hallucinating prop names, types, or valid combinations, and to answer any question about a component's props, API, or usage — reading or grepping the component source is not a substitute. Stories reveal real prop usage patterns, interactions, and edge cases that type definitions alone don't show. If the example stories don't show the prop you need, use the get-documentation-for-story tool to fetch the story documentation for the specific story variant you need.

				Example: id="button" returns Primary, Secondary, Large stories with code like <Button variant="primary" size="large"> showing actual prop combinations.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "id": {
				          "description": "The component or docs entry ID (e.g., "button")",
				          "type": "string",
				        },
				      },
				      "required": [
				        "id",
				      ],
				      "type": "object",
				    },
				    "name": "get-documentation",
				    "title": "Get Documentation",
				  },
				  {
				    "description": "Get detailed documentation for a specific story variant of a UI component. Use this when you need to see more usage examples of a component, via the stories written for it.",
				    "inputSchema": {
				      "$schema": "http://json-schema.org/draft-07/schema#",
				      "properties": {
				        "componentId": {
				          "type": "string",
				        },
				        "storyName": {
				          "type": "string",
				        },
				      },
				      "required": [
				        "componentId",
				        "storyName",
				      ],
				      "type": "object",
				    },
				    "name": "get-documentation-for-story",
				    "title": "Get Documentation for Story",
				  },
				]
			`);
		});
	});

	describe('Tool: preview-stories', () => {
		it('should return story URLs for valid stories', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'preview-stories',
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: storyPath,
						},
					],
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "http://localhost:6006/?path=/story/example-button--primary",
				      "type": "text",
				    },
				    {
				      "text": "These preview links are for iterating or sharing a specific story — they are not how visual work or a browse request ends. The display-review tool is available in this session: if you are finishing visually observable work or showing a set of stories, publish the review with **display-review** and link that instead.",
				      "type": "text",
				    },
				  ],
				  "structuredContent": {
				    "stories": [
				      {
				        "name": "Primary",
				        "previewUrl": "http://localhost:6006/?path=/story/example-button--primary",
				        "title": "Example/Button",
				      },
				    ],
				  },
				}
			`);
		});

		it('should return error message for non-existent story', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'preview-stories',
				arguments: {
					stories: [
						{
							exportName: 'NonExistent',
							absoluteStoryPath: `${process.cwd()}/stories/components/NonExistent.stories.ts`,
						},
					],
				},
			});

			// The tool returns error messages as regular content, not isError
			expect(response.result).toHaveProperty('content');
			expect(response.result.content).toHaveLength(1);
			expect(response.result.content[0].text).toContain('No story found');
			expect(response.result.content[0].text).toContain('NonExistent');
		});
	});
	describe('Tool: get-storybook-story-instructions', () => {
		it('should return UI building instructions', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-storybook-story-instructions',
				arguments: {},
			});

			expect(response.result).toHaveProperty('content');
			expect(response.result.content[0]).toHaveProperty('type', 'text');

			const text = response.result.content[0].text;
			expect(text).toContain('stories');
			expect(text.length).toBeGreaterThan(100);
		});
	});

	describe('Tool: list-all-documentation', () => {
		it('should list all documentation from manifest', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "# Components

				- Button (example-button): A customizable button component for user interactions.
				- Header (header)
				- Page (page)
				- Card (other-ui-card): Card component with title, image, content, and action button

				# Docs

				- getting-started (getting-started--docs): # Getting Started This is the getting started documentation of this design system. ## Usag...",
				      "type": "text",
				    },
				  ],
				}
			`);
		});
	});

	describe('Tool: get-documentation', () => {
		it('should return documentation for a specific component', async () => {
			// First, get the list to find a valid component ID
			const listResponse = await mcpRequest('tools/call', {
				name: 'list-all-documentation',
				arguments: {},
			});

			const listText = listResponse.result.content[0].text;
			// Match markdown format: - ComponentName (component-id)
			const idMatch = listText.match(/- \w+ \(([^)]+)\)/);
			expect(idMatch).toBeTruthy();
			const componentId = idMatch![1];

			// Now get documentation for that component
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: componentId,
				},
			});

			expect(response.result).toHaveProperty('content');
			expect(response.result.content[0]).toHaveProperty('type', 'text');

			const text = response.result.content[0].text as string;
			expect(text).toContain('# Button');
			expect(text).toContain('## Stories');
			expect(text).toContain('### Primary');
			expect(text).toContain('### Secondary');
			expect(text).toContain('## Props');
			expect(text).toContain('export type Props =');
			expect(text).toContain('## Docs');
			expect(text).toContain('### Additional Information');
			expect(text).toContain(
				'that the string passed to the `label` prop uses the 🍌-emoji instead of spaces.',
			);
			expect(text).toContain('<Canvas of={ButtonStories.Primary} />');
		});

		it('should return error for non-existent component', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'get-documentation',
				arguments: {
					id: 'non-existent-component-id',
				},
			});

			expect(response.result).toMatchInlineSnapshot(`
				{
				  "content": [
				    {
				      "text": "Component or Docs Entry not found: "non-existent-component-id". Use the list-all-documentation tool to see available components and documentation entries.",
				      "type": "text",
				    },
				  ],
				  "isError": true,
				}
			`);
		});
	});

	describe('Tool: run-story-tests', () => {
		it('should run all tests when stories are omitted', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('## Passing Stories');
			expect(text).toContain('example-button--primary');
			expect(text).toContain('page--logged-out');
		});

		it('should run tests for a story and report accessibility violations', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [
						{
							exportName: 'WithA11yViolation',
							absoluteStoryPath: storyPath,
						},
					],
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('## Passing Stories');
			expect(text).toContain('example-button--with-a-11-y-violation');
			expect(text).toContain('## Accessibility Violations');
			expect(text).toContain('example-button--with-a-11-y-violation - color-contrast');
			expect(text).toContain('Expected contrast ratio of 4.5:1');
		});

		it('should run tests for multiple stories', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [
						{
							exportName: 'Primary',
							absoluteStoryPath: storyPath,
						},
						{
							exportName: 'Secondary',
							absoluteStoryPath: storyPath,
						},
					],
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('## Passing Stories');
			expect(text).toContain('example-button--primary');
			expect(text).toContain('example-button--secondary');
			expect(text).toContain('## Accessibility Violations');
			expect(text).toContain('example-button--primary - color-contrast');
		});

		it('should return error for non-existent story', async () => {
			const response = await mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [
						{
							exportName: 'NonExistent',
							absoluteStoryPath: `${process.cwd()}/stories/components/NonExistent.stories.ts`,
						},
					],
				},
			});

			const text = response.result.content[0].text;
			expect(text).toContain('No stories found matching the provided input.');
			expect(text).toContain('No story found for export name "NonExistent"');
		});

		it('should sequentialize 4 concurrent calls to run-story-tests', async () => {
			const cwd = process.cwd();
			const storyPath = cwd.endsWith('/apps/internal-storybook')
				? `${cwd}/stories/components/Button.stories.ts`
				: `${cwd}/apps/internal-storybook/stories/components/Button.stories.ts`;

			// Make 4 concurrent calls with different story exports
			const promise1 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Primary', absoluteStoryPath: storyPath }],
				},
			});

			const promise2 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Secondary', absoluteStoryPath: storyPath }],
				},
			});

			const promise3 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Large', absoluteStoryPath: storyPath }],
				},
			});

			const promise4 = mcpRequest('tools/call', {
				name: 'run-story-tests',
				arguments: {
					stories: [{ exportName: 'Small', absoluteStoryPath: storyPath }],
				},
			});

			// All calls should complete successfully
			const [result1, result2, result3, result4] = await Promise.all([
				promise1,
				promise2,
				promise3,
				promise4,
			]);

			// Verify call 1 completed with Primary story
			expect(result1.result).toBeDefined();
			expect(result1.result.content).toBeDefined();
			expect(result1.result.content.length).toBeGreaterThan(0);

			expect(result1.result.content[0].text).toContain('example-button--primary');
			expect(result1.result.content[0].text).toContain('Passing Stories');

			// Verify call 2 completed with Secondary story
			expect(result2.result).toBeDefined();
			expect(result2.result.content).toBeDefined();
			expect(result2.result.content.length).toBeGreaterThan(0);
			expect(result2.result.content[0].text).toContain('example-button--secondary');
			expect(result2.result.content[0].text).toContain('Passing Stories');

			// Verify call 3 completed with Large story
			expect(result3.result).toBeDefined();
			expect(result3.result.content).toBeDefined();
			expect(result3.result.content.length).toBeGreaterThan(0);
			expect(result3.result.content[0].text).toContain('example-button--large');
			expect(result3.result.content[0].text).toContain('Passing Stories');

			// Verify call 4 completed with Small story
			expect(result4.result).toBeDefined();
			expect(result4.result.content).toBeDefined();
			expect(result4.result.content.length).toBeGreaterThan(0);
			expect(result4.result.content[0].text).toContain('example-button--small');
			expect(result4.result.content[0].text).toContain('Passing Stories');
		});
	});

	describe('Toolset Filtering', () => {
		it('should respect X-MCP-Toolsets header for dev tools only', async () => {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-MCP-Toolsets': 'dev',
				},
				body: JSON.stringify(createMCPRequestBody('tools/list')),
			});

			const data = await parseMCPResponse(response);
			const toolNames = data.result.tools.map((tool: any) => tool.name);

			expect(toolNames).toMatchInlineSnapshot(`
				[
				  "preview-stories",
				  "get-storybook-story-instructions",
				  "get-changed-stories",
				  "get-stories-by-component",
				  "display-review",
				]
			`);
		});

		it('should respect X-MCP-Toolsets header for docs tools only', async () => {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-MCP-Toolsets': 'docs',
				},
				body: JSON.stringify(createMCPRequestBody('tools/list')),
			});

			const data = await parseMCPResponse(response);
			const toolNames = data.result.tools.map((tool: any) => tool.name);

			expect(toolNames).toMatchInlineSnapshot(`
				[
				  "list-all-documentation",
				  "get-documentation",
				  "get-documentation-for-story",
				]
			`);
		});
	});

	describe('HTTP Methods', () => {
		it('should return HTML when Accept header is text/html', async () => {
			const response = await fetch(MCP_ENDPOINT, {
				method: 'GET',
				headers: {
					Accept: 'text/html',
				},
			});

			expect(response.ok).toBe(true);
			expect(response.headers.get('content-type')).toContain('text/html');

			const html = await response.text();
			expect(html.toLowerCase()).toContain('<!doctype html>');
		});
	});
});

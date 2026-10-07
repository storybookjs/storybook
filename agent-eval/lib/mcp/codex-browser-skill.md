---
name: control-in-app-browser
description: 'Control the in-app Browser. Use to open, navigate, inspect, test, click, type, screenshot, or verify local targets such as localhost, 127.0.0.1, ::1, file://, the current in-app browser tab, and websites shown side by side inside Codex.'
---

# Browser

Use this skill for browser automation tasks such as inspecting pages, navigating, testing local apps, clicking, typing, taking screenshots, and reading visible page state.

If this skill is listed as available in the session, treat that as mandatory reading before browser work. Open and follow this skill before saying that Browser is unavailable and before falling back to standalone Playwright or other browser-control mechanisms.

## Bootstrap

The `browser-client` module is the core entry point for browser use, and is available at `.agent-eval/mcp/codex-browser-client-mock.mjs` relative to the workspace root. ALWAYS import it using an absolute path composed from `nodeRepl.cwd`. IMPORTANT: If this path cannot be found, stop and report that the workspace is missing `.agent-eval/mcp/codex-browser-client-mock.mjs`.

Run browser setup code through the Node REPL `js` tool. In this environment the callable tool id typically appears as `mcp__node_repl__js`. You need the `js` execution tool: `js_reset` only clears state, and `js_add_node_module_dir` only changes package resolution.

Initialize the runtime once per fresh Node session, select the in-app browser, and immediately read its complete documentation:

```js
if (globalThis.agent?.browsers == null) {
	const { setupBrowserRuntime } = await import(
		nodeRepl.cwd + '/.agent-eval/mcp/codex-browser-client-mock.mjs'
	);
	await setupBrowserRuntime({ globals: globalThis });
}
globalThis.browser = await agent.browsers.get('iab');
nodeRepl.write(await browser.documentation());
```

If setup succeeds but browser discovery or selection fails, read `await agent.documentation.get("bootstrap-troubleshooting")` before resetting the JavaScript session.

Use the browser bound to `browser` for tasks in this skill. The ability to interact directly with the browser is exposed through the `agent.browsers.*` API. Before trying to interact with it, you MUST emit and read the complete documentation returned by `await browser.documentation()` in one go, using the exact direct call `nodeRepl.write(await browser.documentation());` shown above.

Typical flow after bootstrap:

```js
var tab = (await browser.tabs.selected()) ?? (await browser.tabs.new());
await tab.goto('http://localhost:3000');
await tab.playwright.waitForLoadState({ state: 'domcontentloaded', timeoutMs: 10000 });
nodeRepl.write(await tab.playwright.domSnapshot());
```

To view a screenshot, emit it as an image: `await nodeRepl.emitImage(await tab.screenshot({}))`.

Only the Node REPL `js` tool (`mcp__node_repl__js`) can be used to control the in-app browser. Do not use external MCP browser-control tools, separate browser automation servers, or other browser skills for this surface. References to Playwright mean the in-skill `tab.playwright` API after browser-client setup.

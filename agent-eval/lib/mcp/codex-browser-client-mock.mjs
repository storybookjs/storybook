/**
 * Stand-in for the Codex app's in-app browser runtime (`browser-client.mjs`),
 * used in agent evals. The real runtime ships with the closed-source Codex
 * desktop app and drives the app's browser pane over a native pipe that only
 * exists inside the app's `node_repl`. This mock implements the same
 * `agent.browsers.*` API surface (per the app's packaged `api.json`, copied
 * next to this file as `codex-browser-api.json`) backed by a headless
 * Playwright Chromium resolved from the eval workspace.
 *
 * The Codex `control-in-app-browser` skill flow works unchanged:
 *
 *   const { setupBrowserRuntime } = await import(".../codex-browser-client-mock.mjs");
 *   await setupBrowserRuntime({ globals: globalThis });
 *   globalThis.browser = await agent.browsers.get("iab");
 *   const tab = (await browser.tabs.selected()) ?? (await browser.tabs.new());
 *   await tab.goto("http://localhost:3000");
 *   await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 10000 });
 *
 * Fidelity notes, captured from the real in-app browser:
 * - Default viewport is 1280x720; the `viewport` browser capability overrides it.
 * - `tab.screenshot()` returns JPEG bytes of the viewport unless `fullPage`.
 * - `tab.playwright.domSnapshot()` returns an ARIA-style snapshot string.
 * - Locator timeouts surface as "Playwright selector deadline exceeded".
 * - Console logs come from `tab.dev.logs()`; network inspection goes through
 *   the `cdp` tab capability, not a high-level API.
 */
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_ACTION_TIMEOUT_MS = 5_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const BROWSER_ID = 'iab';
const API_JSON_PATH = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'codex-browser-api.json',
);

let playwrightBrowserPromise;
let sharedContextPromise;
let tabSequence = 0;
const tabs = new Map();
let selectedTab;
let sessionName;
let browserVisible = false;
let viewportOverride;

async function getPlaywrightBrowser() {
	if (!playwrightBrowserPromise) {
		playwrightBrowserPromise = (async () => {
			// Resolved from the workspace install (eval templates depend on
			// playwright and install Chromium during postinstall).
			const { chromium } = await import('playwright');
			return chromium.launch({ headless: true });
		})().catch((error) => {
			playwrightBrowserPromise = undefined;
			throw new Error(`Failed to launch the browser runtime: ${error?.message ?? error}`);
		});
	}
	return playwrightBrowserPromise;
}

async function getContext() {
	if (!sharedContextPromise) {
		sharedContextPromise = (async () => {
			const browser = await getPlaywrightBrowser();
			return browser.newContext({ viewport: { ...(viewportOverride ?? DEFAULT_VIEWPORT) } });
		})().catch((error) => {
			sharedContextPromise = undefined;
			throw error;
		});
	}
	return sharedContextPromise;
}

function nowIso() {
	return new Date().toISOString();
}

/**
 * Rethrow Playwright timeout errors with the wording the real in-app browser
 * uses, e.g. "Playwright selector deadline exceeded\nwaiting on click for
 * selector internal:role=button[name="Save"i]".
 */
async function withDeadlineError(operation, describe, fn) {
	try {
		return await fn();
	} catch (error) {
		if (error?.name === 'TimeoutError') {
			const rewritten = new Error(
				`Playwright selector deadline exceeded\nwaiting on ${operation} for selector ${describe()}`,
			);
			rewritten.cause = error;
			throw rewritten;
		}
		throw error;
	}
}

function actionTimeout(options) {
	const timeoutMs = options?.timeoutMs;
	return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_ACTION_TIMEOUT_MS;
}

const RAW_LOCATOR = Symbol('rawLocator');

function unwrapLocator(value) {
	return value?.[RAW_LOCATOR] ?? value;
}

function locatorFilterOptions(options = {}) {
	const mapped = {};
	if (options.has !== undefined) mapped.has = unwrapLocator(options.has);
	if (options.hasNot !== undefined) mapped.hasNot = unwrapLocator(options.hasNot);
	if (options.hasText !== undefined) mapped.hasText = options.hasText;
	if (options.hasNotText !== undefined) mapped.hasNotText = options.hasNotText;
	if (options.visible !== undefined) mapped.visible = options.visible;
	return mapped;
}

/** Wrap a Playwright Locator behind the in-app browser's PlaywrightLocator surface. */
function wrapLocator(locator) {
	const describe = () => String(locator);
	const act = (operation, options, fn) =>
		withDeadlineError(operation, describe, () => fn(actionTimeout(options)));

	return {
		[RAW_LOCATOR]: locator,
		// Sub-queries
		locator: (selector, options = {}) =>
			wrapLocator(locator.locator(selector, locatorFilterOptions(options))),
		getByRole: (role, options = {}) => wrapLocator(locator.getByRole(role, options)),
		getByText: (text, options = {}) => wrapLocator(locator.getByText(text, options)),
		getByLabel: (text, options = {}) => wrapLocator(locator.getByLabel(text, options)),
		getByPlaceholder: (text, options = {}) => wrapLocator(locator.getByPlaceholder(text, options)),
		getByTestId: (testId) => wrapLocator(locator.getByTestId(testId)),
		filter: (options = {}) => wrapLocator(locator.filter(locatorFilterOptions(options))),
		and: (other) => wrapLocator(locator.and(unwrapLocator(other))),
		or: (other) => wrapLocator(locator.or(unwrapLocator(other))),
		first: () => wrapLocator(locator.first()),
		last: () => wrapLocator(locator.last()),
		nth: (index) => wrapLocator(locator.nth(index)),
		all: async () => (await locator.all()).map(wrapLocator),
		// Reads
		count: () => locator.count(),
		isVisible: () => locator.isVisible(),
		isEnabled: () => locator.isEnabled(),
		textContent: (options = {}) =>
			act('textContent', options, (timeout) => locator.textContent({ timeout })),
		innerText: (options = {}) =>
			act('innerText', options, (timeout) => locator.innerText({ timeout })),
		allTextContents: () => locator.allTextContents(),
		getAttribute: (name, options = {}) =>
			act('getAttribute', options, (timeout) => locator.getAttribute(name, { timeout })),
		// Actions
		click: (options = {}) =>
			act('click', options, (timeout) =>
				locator.click({
					timeout,
					button: options.button,
					modifiers: options.modifiers,
					force: options.force,
				}),
			),
		dblclick: (options = {}) =>
			act('dblclick', options, (timeout) =>
				locator.dblclick({
					timeout,
					button: options.button,
					modifiers: options.modifiers,
					force: options.force,
				}),
			),
		fill: (value, options = {}) =>
			act('fill', options, (timeout) => locator.fill(value, { timeout })),
		type: (value, options = {}) =>
			act('type', options, (timeout) => locator.pressSequentially(value, { timeout })),
		press: (value, options = {}) =>
			act('press', options, (timeout) => locator.press(value, { timeout })),
		check: (options = {}) =>
			act('check', options, (timeout) => locator.check({ timeout, force: options.force })),
		uncheck: (options = {}) =>
			act('uncheck', options, (timeout) => locator.uncheck({ timeout, force: options.force })),
		setChecked: (checked, options = {}) =>
			act('setChecked', options, (timeout) =>
				locator.setChecked(checked, { timeout, force: options.force }),
			),
		selectOption: (value, options = {}) =>
			act('selectOption', options, (timeout) => locator.selectOption(value, { timeout })),
		waitFor: (options = {}) =>
			act('waitFor', options, (timeout) => locator.waitFor({ state: options.state, timeout })),
		downloadMedia: () => {
			throw new Error('downloadMedia is not supported by the eval browser mock.');
		},
	};
}

function wrapFrameLocator(frameLocator) {
	return {
		frameLocator: (selector) => wrapFrameLocator(frameLocator.frameLocator(selector)),
		locator: (selector, options = {}) =>
			wrapLocator(frameLocator.locator(selector, locatorFilterOptions(options))),
		getByRole: (role, options = {}) => wrapLocator(frameLocator.getByRole(role, options)),
		getByText: (text, options = {}) => wrapLocator(frameLocator.getByText(text, options)),
		getByLabel: (text, options = {}) => wrapLocator(frameLocator.getByLabel(text, options)),
		getByPlaceholder: (text, options = {}) =>
			wrapLocator(frameLocator.getByPlaceholder(text, options)),
		getByTestId: (testId) => wrapLocator(frameLocator.getByTestId(testId)),
	};
}

// CUA button numbering: 1-left, 2-middle/wheel, 3-right (4/5 unsupported here).
const CUA_BUTTONS = { 1: 'left', 2: 'middle', 3: 'right' };

const MODIFIER_KEYS = {
	CTRL: 'Control',
	CONTROL: 'Control',
	ALT: 'Alt',
	OPTION: 'Alt',
	SHIFT: 'Shift',
	META: 'Meta',
	CMD: 'Meta',
	COMMAND: 'Meta',
	SUPER: 'Meta',
};

function normalizeKey(key) {
	const upper = String(key).toUpperCase();
	if (MODIFIER_KEYS[upper]) return MODIFIER_KEYS[upper];
	const named = {
		ENTER: 'Enter',
		RETURN: 'Enter',
		TAB: 'Tab',
		ESC: 'Escape',
		ESCAPE: 'Escape',
		SPACE: ' ',
		BACKSPACE: 'Backspace',
		DELETE: 'Delete',
		ARROWUP: 'ArrowUp',
		ARROWDOWN: 'ArrowDown',
		ARROWLEFT: 'ArrowLeft',
		ARROWRIGHT: 'ArrowRight',
		UP: 'ArrowUp',
		DOWN: 'ArrowDown',
		LEFT: 'ArrowLeft',
		RIGHT: 'ArrowRight',
		PAGEUP: 'PageUp',
		PAGEDOWN: 'PageDown',
		HOME: 'Home',
		END: 'End',
	};
	return named[upper] ?? key;
}

async function withHeldKeys(page, keys, fn) {
	const held = (keys ?? []).map(normalizeKey);
	for (const key of held) await page.keyboard.down(key);
	try {
		return await fn();
	} finally {
		for (const key of held.reverse()) await page.keyboard.up(key);
	}
}

async function pressCombination(page, keys) {
	const normalized = (keys ?? []).map(normalizeKey);
	if (normalized.length === 0) return;
	const modifiers = normalized.filter((key) => Object.values(MODIFIER_KEYS).includes(key));
	const rest = normalized.filter((key) => !modifiers.includes(key));
	if (rest.length === 0) {
		// A bare modifier combo: tap them in order.
		for (const key of normalized) await page.keyboard.press(key);
		return;
	}
	await page.keyboard.press([...modifiers, ...rest].join('+'));
}

const VISIBLE_DOM_SCRIPT = `(() => {
	const interactableSelector =
		'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], ' +
		'[role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], ' +
		'[role="switch"], [role="combobox"], [role="textbox"], [contenteditable="true"], [onclick], [tabindex]';
	const registry = {};
	let sequence = 0;
	const isVisible = (element) => {
		const rect = element.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return false;
		const style = getComputedStyle(element);
		return style.visibility !== 'hidden' && style.display !== 'none';
	};
	const describe = (element) => {
		const id = String(++sequence);
		registry[id] = element;
		const rect = element.getBoundingClientRect();
		const text = (element.innerText ?? element.value ?? '').trim().slice(0, 120);
		const entry = {
			node_id: id,
			tag: element.tagName.toLowerCase(),
			rect: {
				x: Math.round(rect.x),
				y: Math.round(rect.y),
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			},
		};
		const role = element.getAttribute('role');
		if (role) entry.role = role;
		if (element.id) entry.id = element.id;
		if (element.name) entry.name = element.name;
		if (element.type) entry.type = element.type;
		if (element.placeholder) entry.placeholder = element.placeholder;
		if (element.href) entry.href = element.getAttribute('href');
		if (text) entry.text = text;
		if (element.getAttribute('aria-label')) entry.ariaLabel = element.getAttribute('aria-label');
		return entry;
	};
	const nodes = [];
	for (const element of document.querySelectorAll(interactableSelector)) {
		if (!isVisible(element)) continue;
		nodes.push(describe(element));
	}
	window.__codexBrowserMockNodes = registry;
	return { url: location.href, title: document.title, nodes };
})()`;

async function domNodeHandle(page, nodeId) {
	const handle = await page.evaluateHandle(
		(id) => window.__codexBrowserMockNodes?.[id] ?? null,
		String(nodeId),
	);
	const element = handle.asElement();
	if (!element) {
		throw new Error(
			`Unknown node_id "${nodeId}". Call get_visible_dom() first and use a node id from its result.`,
		);
	}
	return element;
}

function createTab(page) {
	const id = String(++tabSequence);
	const consoleLogs = [];
	const cdpEvents = [];
	let cdpSessionPromise;
	let pendingDialog;
	let clipboardText = '';
	let clipboardItems = [];

	page.setDefaultTimeout(DEFAULT_ACTION_TIMEOUT_MS);
	page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
	page.on('console', (message) => {
		const type = message.type();
		consoleLogs.push({
			level: type === 'warning' ? 'warn' : type,
			message: message.text(),
			timestamp: nowIso(),
			url: message.location()?.url || undefined,
		});
	});
	page.on('pageerror', (error) => {
		consoleLogs.push({ level: 'error', message: String(error), timestamp: nowIso() });
	});
	page.on('dialog', (dialog) => {
		pendingDialog = dialog;
	});
	page.on('close', () => {
		tabs.delete(id);
		if (selectedTab?.id === id) selectedTab = [...tabs.values()].at(-1);
	});

	const getCdpSession = async () => {
		cdpSessionPromise ??= (async () => {
			const session = await page.context().newCDPSession(page);
			// Buffer every CDP event for readEvents() by intercepting emit.
			const originalEmit = session.emit.bind(session);
			let sequence = 0;
			session.emit = (event, params) => {
				if (typeof event === 'string' && event.includes('.')) {
					cdpEvents.push({ method: event, params, sequence: ++sequence, source: {} });
				}
				return originalEmit(event, params);
			};
			return session;
		})();
		return cdpSessionPromise;
	};

	const playwrightApi = {
		domSnapshot: async () => {
			const sections = [];
			const mainSnapshot = await page.locator('body').ariaSnapshot();
			sections.push(mainSnapshot);
			for (const frame of page.frames()) {
				if (frame === page.mainFrame()) continue;
				try {
					const frameSnapshot = await frame.locator('body').ariaSnapshot({ timeout: 1_000 });
					if (frameSnapshot.trim().length > 0) {
						sections.push(`- iframe (${frame.url()}):\n${indent(frameSnapshot, '  ')}`);
					}
				} catch {
					// Frame not ready or detached; skip like the real snapshot does.
				}
			}
			return sections.join('\n');
		},
		evaluate: (pageFunction, arg) => page.evaluate(pageFunction, arg),
		expectNavigation: async (action, options = {}) => {
			const timeout = options.timeoutMs ?? NAVIGATION_TIMEOUT_MS;
			const waitUntil = options.waitUntil ?? 'load';
			const navigated = page.waitForEvent('framenavigated', { timeout });
			const result = await action();
			await navigated;
			if (options.url !== undefined) {
				await page.waitForURL(options.url, { timeout, waitUntil });
			} else {
				await page.waitForLoadState(waitUntil, { timeout });
			}
			return result;
		},
		locator: (selector) => wrapLocator(page.locator(selector)),
		frameLocator: (frameSelector) => wrapFrameLocator(page.frameLocator(frameSelector)),
		getByRole: (role, options = {}) => wrapLocator(page.getByRole(role, options)),
		getByText: (text, options = {}) => wrapLocator(page.getByText(text, options)),
		getByLabel: (text, options = {}) => wrapLocator(page.getByLabel(text, options)),
		getByPlaceholder: (text, options = {}) => wrapLocator(page.getByPlaceholder(text, options)),
		getByTestId: (testId) => wrapLocator(page.getByTestId(testId)),
		waitForLoadState: (options = {}) =>
			page.waitForLoadState(options.state ?? 'load', {
				timeout: options.timeoutMs ?? NAVIGATION_TIMEOUT_MS,
			}),
		waitForURL: (url, options = {}) =>
			page.waitForURL(url, {
				timeout: options.timeoutMs ?? NAVIGATION_TIMEOUT_MS,
				waitUntil: options.waitUntil,
			}),
		waitForTimeout: (timeoutMs) => page.waitForTimeout(timeoutMs),
		waitForEvent: async (event, options = {}) => {
			const timeout = options.timeoutMs ?? NAVIGATION_TIMEOUT_MS;
			if (event === 'download') {
				const download = await page.waitForEvent('download', { timeout });
				return {
					path: async () => {
						try {
							return await download.path();
						} catch {
							return null;
						}
					},
				};
			}
			if (event === 'filechooser') {
				const chooser = await page.waitForEvent('filechooser', { timeout });
				return {
					isMultiple: () => chooser.isMultiple(),
					setFiles: (files, setOptions = {}) =>
						chooser.setFiles(files, { timeout: actionTimeout(setOptions) }),
				};
			}
			throw new Error(`Unsupported event "${event}". Supported: "download", "filechooser".`);
		},
		elementInfo: async (options) => {
			return page.evaluate(
				({ x, y, includeNonInteractable }) => {
					const elements = document.elementsFromPoint(x, y);
					const interactable = (element) =>
						element.matches(
							'a[href], button, input, select, textarea, [role], [onclick], [tabindex], [contenteditable="true"]',
						);
					const results = [];
					for (const element of elements) {
						if (!includeNonInteractable && !interactable(element)) continue;
						const rect = element.getBoundingClientRect();
						const cssParts = [element.tagName.toLowerCase()];
						if (element.id) cssParts.push(`#${element.id}`);
						results.push({
							tagName: element.tagName.toLowerCase(),
							role: element.getAttribute('role'),
							ariaName: element.getAttribute('aria-label'),
							testId: element.getAttribute('data-testid'),
							visibleText: (element.innerText ?? element.value ?? '').trim().slice(0, 120) || null,
							preview: element.outerHTML.slice(0, 160),
							selector: { css: cssParts.join('') },
							boundingBox: {
								x: Math.round(rect.x),
								y: Math.round(rect.y),
								width: Math.round(rect.width),
								height: Math.round(rect.height),
							},
						});
					}
					return results;
				},
				{
					x: options.x,
					y: options.y,
					includeNonInteractable: options.includeNonInteractable ?? false,
				},
			);
		},
		elementScreenshot: async (options) => {
			await page.evaluate(
				({ x, y }) => {
					const overlay = document.createElement('div');
					overlay.id = '__codex_browser_mock_probe__';
					overlay.style.cssText =
						'position:fixed;z-index:2147483647;pointer-events:none;' +
						`left:${x - 4}px;top:${y - 4}px;width:8px;height:8px;` +
						'background:red;border-radius:50%;';
					document.documentElement.append(overlay);
					for (const element of document.elementsFromPoint(x, y).slice(0, 3)) {
						const rect = element.getBoundingClientRect();
						const box = document.createElement('div');
						box.className = '__codex_browser_mock_probe__box';
						box.style.cssText =
							'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid red;' +
							`left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;`;
						document.documentElement.append(box);
					}
				},
				{ x: options.x, y: options.y },
			);
			try {
				const buffer = await page.screenshot({ type: 'jpeg', quality: 80 });
				return new Uint8Array(buffer);
			} finally {
				await page
					.evaluate(() => {
						document.getElementById('__codex_browser_mock_probe__')?.remove();
						for (const box of document.querySelectorAll('.__codex_browser_mock_probe__box')) {
							box.remove();
						}
					})
					.catch(() => {});
			}
		},
	};

	const tab = {
		id,
		get page() {
			return page;
		},
		goto: async (url) => {
			selectedTab = tab;
			await page.goto(url, { waitUntil: 'domcontentloaded' });
		},
		back: async () => {
			await page.goBack({ waitUntil: 'domcontentloaded' });
		},
		forward: async () => {
			await page.goForward({ waitUntil: 'domcontentloaded' });
		},
		reload: async () => {
			await page.reload({ waitUntil: 'domcontentloaded' });
		},
		close: () => page.close(),
		title: () => page.title(),
		url: async () => page.url(),
		screenshot: async (options = {}) => {
			const buffer = await page.screenshot({
				type: 'jpeg',
				quality: 80,
				fullPage: options.fullPage ?? false,
				clip: options.clip,
			});
			return new Uint8Array(buffer);
		},
		getJsDialog: async () => {
			const dialog = pendingDialog;
			if (!dialog) return undefined;
			const settle = () => {
				if (pendingDialog === dialog) pendingDialog = undefined;
			};
			return {
				type: dialog.type(),
				message: dialog.message(),
				accept: async (text) => {
					settle();
					await dialog.accept(text);
				},
				dismiss: async () => {
					settle();
					await dialog.dismiss();
				},
			};
		},
		markDeliverable: async () => {},
		markHandoff: async () => {},
		playwright: playwrightApi,
		cua: {
			click: async (options) =>
				withHeldKeys(page, options.keypress, () =>
					page.mouse.click(options.x, options.y, { button: CUA_BUTTONS[options.button ?? 1] }),
				),
			double_click: async (options) =>
				withHeldKeys(page, options.keypress, () =>
					page.mouse.dblclick(options.x, options.y, { button: 'left' }),
				),
			move: (options) => page.mouse.move(options.x, options.y),
			drag: async (options) => {
				const [start, ...rest] = options.path ?? [];
				if (!start) throw new Error('drag requires a non-empty path.');
				await withHeldKeys(page, options.keys, async () => {
					await page.mouse.move(start.x, start.y);
					await page.mouse.down();
					for (const point of rest) await page.mouse.move(point.x, point.y, { steps: 5 });
					await page.mouse.up();
				});
			},
			scroll: async (options) => {
				await page.mouse.move(options.x, options.y);
				await page.mouse.wheel(options.scrollX ?? 0, options.scrollY ?? 0);
			},
			keypress: (options) => pressCombination(page, options.keys),
			type: (options) => page.keyboard.type(options.text),
			downloadMedia: () => {
				throw new Error('downloadMedia is not supported by the eval browser mock.');
			},
		},
		dom_cua: {
			get_visible_dom: () => page.evaluate(VISIBLE_DOM_SCRIPT),
			click: async (options) => {
				const element = await domNodeHandle(page, options.node_id);
				await element.click();
			},
			double_click: async (options) => {
				const element = await domNodeHandle(page, options.node_id);
				await element.dblclick();
			},
			keypress: (options) => pressCombination(page, options.keys),
			type: (options) => page.keyboard.type(options.text),
			scroll: async (options) => {
				if (options.node_id !== undefined) {
					const element = await domNodeHandle(page, options.node_id);
					await element.evaluate((node, delta) => node.scrollBy(delta.x, delta.y), {
						x: options.x ?? 0,
						y: options.y ?? 0,
					});
					return;
				}
				await page.evaluate((delta) => window.scrollBy(delta.x, delta.y), {
					x: options.x ?? 0,
					y: options.y ?? 0,
				});
			},
			downloadMedia: () => {
				throw new Error('downloadMedia is not supported by the eval browser mock.');
			},
		},
		dev: {
			logs: async (options = {}) => {
				let entries = consoleLogs;
				if (options.levels !== undefined) {
					const levels = new Set(
						options.levels.map((level) => (level === 'warning' ? 'warn' : level)),
					);
					entries = entries.filter((entry) => levels.has(entry.level));
				}
				if (options.filter !== undefined) {
					entries = entries.filter((entry) => entry.message.includes(options.filter));
				}
				if (options.limit !== undefined) {
					entries = entries.slice(-options.limit);
				}
				return entries.map((entry) => ({ ...entry }));
			},
		},
		clipboard: {
			readText: async () => clipboardText,
			writeText: async (text) => {
				clipboardText = text;
				clipboardItems = [{ entries: [{ type: 'text/plain', text }] }];
			},
			read: async () => clipboardItems,
			write: async (items) => {
				clipboardItems = items;
				const textEntry = items
					.flatMap((item) => item.entries ?? [])
					.find((entry) => typeof entry.text === 'string');
				if (textEntry) clipboardText = textEntry.text;
			},
		},
		content: {
			export: async () => {
				const html = await page.content();
				const filePath = path.join(tmpdir(), `codex-browser-mock-tab-${id}-${Date.now()}.html`);
				await writeFile(filePath, html, 'utf8');
				return filePath;
			},
			exportGsuite: () => {
				throw new Error('exportGsuite is not supported by the eval browser mock.');
			},
		},
		capabilities: {
			list: async () => [
				{ id: 'cdp', description: 'Send permitted CDP commands and read buffered CDP events.' },
			],
			get: async (capabilityId) => {
				if (capabilityId !== 'cdp') {
					throw new Error(`Unknown tab capability "${capabilityId}".`);
				}
				return {
					documentation: async () =>
						'cdp.send(method, params?, options?) sends a CDP command to this tab. ' +
						'cdp.readEvents({ methods?, afterSequence?, limit? }) reads buffered CDP events; ' +
						'enable a domain first (e.g. send("Network.enable")) so its events get buffered.',
					send: async (method, params) => {
						const session = await getCdpSession();
						return session.send(method, params);
					},
					readEvents: async (options = {}) => {
						await getCdpSession();
						let events = cdpEvents;
						if (options.methods !== undefined) {
							const methods = new Set(options.methods);
							events = events.filter((event) => methods.has(event.method));
						}
						if (options.afterSequence !== undefined) {
							events = events.filter((event) => event.sequence > options.afterSequence);
						}
						const limit = Math.min(options.limit ?? 100, 1000);
						const page_ = events.slice(0, limit);
						return {
							events: page_,
							cursor: page_.at(-1)?.sequence ?? options.afterSequence ?? 0,
							hasMore: events.length > page_.length,
							truncated: false,
						};
					},
				};
			},
		},
	};

	tabs.set(id, tab);
	selectedTab = tab;
	return tab;
}

function indent(value, prefix) {
	return value
		.split('\n')
		.map((line) => (line.length > 0 ? prefix + line : line))
		.join('\n');
}

async function applyViewport(size) {
	viewportOverride = size ? { ...size } : undefined;
	const effective = viewportOverride ?? DEFAULT_VIEWPORT;
	for (const tab of tabs.values()) {
		await tab.page.setViewportSize({ ...effective });
	}
}

let apiDocCache;

function renderApiDocumentation() {
	if (apiDocCache) return apiDocCache;
	const api = JSON.parse(readFileSync(API_JSON_PATH, 'utf8'));
	const lines = [
		'# In-app browser API',
		'',
		'The browser is controlled through the installed `agent.browsers.*` surface.',
		'',
		'```ts',
		'// Installed by setupBrowserRuntime({ globals: globalThis }).',
		'// browser was selected during bootstrap.',
	];
	for (const [name, members] of Object.entries(api.interfaces ?? {})) {
		lines.push('', `interface ${name} {`);
		for (const member of Object.values(members)) {
			for (const declaration of member.declarations ?? []) {
				lines.push(indent(declaration.text, '  '));
			}
		}
		lines.push('}');
	}
	for (const type of Object.values(api.types ?? {})) {
		if (type.text) lines.push('', type.text);
	}
	lines.push('```');
	apiDocCache = lines.join('\n');
	return apiDocCache;
}

const GUIDANCE = [
	'This is an eval stand-in for the Codex in-app browser, backed by headless Chromium.',
	'Default viewport is 1280x720; override it with the `viewport` browser capability.',
	'`tab.screenshot()` returns JPEG bytes; pass them to `nodeRepl.emitImage(...)` to view them.',
	'Console output is available via `tab.dev.logs()`. Network inspection goes through the `cdp` tab capability.',
].join('\n');

const PACKAGED_DOCS = {
	'bootstrap-troubleshooting':
		'If browser discovery or selection fails, re-run setupBrowserRuntime({ globals: globalThis }) ' +
		'and select the browser again with `await agent.browsers.get("iab")`. If Chromium fails to ' +
		'launch, ensure the workspace installed playwright (the eval template does this during ' +
		'postinstall) and retry.',
	'browser-troubleshooting':
		'The eval browser mock runs headless Chromium in this sandbox. localhost, 127.0.0.1, and ' +
		'file:// URLs are reachable directly. If a page fails to load, verify the dev server is ' +
		'running and listening on the expected port.',
};

function getPackagedDoc(name) {
	return (
		PACKAGED_DOCS[name] ??
		`Documentation "${name}" is not packaged with the eval browser mock. Use ` +
			'`await browser.documentation()` for the API reference.'
	);
}

const BROWSER_CAPABILITY_DESCRIPTIONS = [
	{ id: 'visibility', description: 'Read or set whether the browser is visually presented.' },
	{ id: 'viewport', description: 'Apply or clear an explicit browser viewport override.' },
];

const browserFacade = {
	browserId: BROWSER_ID,
	documentation: async () => `${GUIDANCE}\n\n${renderApiDocumentation()}`,
	nameSession: async (name) => {
		sessionName = name;
	},
	get sessionName() {
		return sessionName;
	},
	capabilities: {
		list: async () => BROWSER_CAPABILITY_DESCRIPTIONS.map((entry) => ({ ...entry })),
		get: async (capabilityId) => {
			if (capabilityId === 'visibility') {
				return {
					documentation: async () =>
						'visibility.get() reads and visibility.set(visible) sets whether the browser pane ' +
						'is presented. The eval browser mock is headless, so this only tracks the flag.',
					get: async () => browserVisible,
					set: async (visible) => {
						browserVisible = Boolean(visible);
					},
				};
			}
			if (capabilityId === 'viewport') {
				return {
					documentation: async () =>
						'viewport.set({ width, height }) applies an explicit viewport override; ' +
						'viewport.reset() returns to the default 1280x720.',
					set: async (size) => applyViewport(size),
					reset: async () => applyViewport(undefined),
				};
			}
			throw new Error(`Unknown browser capability "${capabilityId}".`);
		},
	},
	user: {
		openTabs: async () => [],
		history: async () => [],
		claimTab: async () => {
			throw new Error('No user tabs are available in the eval environment.');
		},
	},
	tabs: {
		new: async () => {
			const context = await getContext();
			const page = await context.newPage();
			return createTab(page);
		},
		get: async (id) => {
			const tab = tabs.get(String(id));
			if (!tab) throw new Error(`Unknown tab id "${id}".`);
			return tab;
		},
		list: async () =>
			Promise.all(
				[...tabs.values()].map(async (tab) => ({
					id: tab.id,
					title: (await tab.title()) ?? undefined,
					url: (await tab.url()) ?? undefined,
				})),
			),
		selected: async () => selectedTab,
		content: async (options) => {
			const context = await getContext();
			const results = [];
			for (const url of options.urls ?? []) {
				const page = await context.newPage();
				try {
					await page.goto(url, {
						waitUntil: 'domcontentloaded',
						timeout: options.timeoutMs ?? NAVIGATION_TIMEOUT_MS,
					});
					const content =
						options.contentType === 'html'
							? await page.content()
							: await page.locator('body').innerText();
					results.push({ url: page.url(), title: await page.title(), content });
				} catch {
					results.push({ url, title: null, content: null });
				} finally {
					await page.close().catch(() => {});
				}
			}
			return results;
		},
		finalize: async (options = {}) => {
			const keep = new Set(
				(options.keep ?? []).map((entry) =>
					typeof entry === 'string' ? entry : (entry.tabId ?? entry.id),
				),
			);
			for (const tab of [...tabs.values()]) {
				if (!keep.has(tab.id)) {
					await tab.close().catch(() => {});
				}
			}
		},
	},
};

const BROWSER_LIST_ENTRY = {
	id: BROWSER_ID,
	name: 'Codex In-app Browser',
	type: 'iab',
	capabilities: {
		browser: BROWSER_CAPABILITY_DESCRIPTIONS,
		tab: [{ id: 'cdp', description: 'Send permitted CDP commands and read buffered CDP events.' }],
	},
};

export async function setupBrowserRuntime({ globals }) {
	if (!globals) {
		throw new Error('setupBrowserRuntime requires { globals } (pass globalThis).');
	}
	globals.agent = {
		browsers: {
			list: async () => [BROWSER_LIST_ENTRY],
			get: async (id) => {
				if (id !== BROWSER_ID && id !== 'iab-mock') {
					throw new Error(
						`Unknown browser "${id}". Only the in-app browser ("${BROWSER_ID}") is available in the eval environment.`,
					);
				}
				return browserFacade;
			},
			getDefault: async () => browserFacade,
			getForUrl: async () => browserFacade,
		},
		documentation: {
			get: async (name) => getPackagedDoc(name),
		},
	};
}

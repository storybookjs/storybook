/**
 * Storybook MCP App Script
 *
 * This script runs inside Storybook's iframe and communicates dimensions
 * to the parent preview.html frame via postMessage (cross-origin safe).
 *
 * Only activates when the iframe is loaded with `mcp-app=true` query parameter,
 * which is set by the MCP Apps preview.html wrapper.
 */

import { MCP_APP_PARAM, MCP_APP_SIZE_CHANGED_EVENT } from './constants';
// Only run if we're in the special MCP App iframe context
const isMcpApp = new URLSearchParams(window.location.search).has(MCP_APP_PARAM);

if (isMcpApp) {
	const SIZE_CHANGE_THRESHOLD = 2; // Only report changes > 2px to avoid oscillation

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let lastSentHeight = 0;
	const DEBOUNCE_MS = 100;

	function sendSizeToParent() {
		const height = document.body.scrollHeight;

		// Only send if the change exceeds the threshold
		if (Math.abs(height - lastSentHeight) <= SIZE_CHANGE_THRESHOLD) {
			return;
		}

		lastSentHeight = height;
		window.parent.postMessage(
			{
				type: MCP_APP_SIZE_CHANGED_EVENT,
				height,
			},
			'*',
		);
	}

	function debouncedSendSize() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(sendSizeToParent, DEBOUNCE_MS);
	}

	// Send initial size after DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', sendSizeToParent);
	} else {
		sendSizeToParent();
	}

	// Also send after full load (images, fonts, etc.)
	window.addEventListener('load', sendSizeToParent);

	// Observe body for size changes using ResizeObserver
	const resizeObserver = new ResizeObserver(debouncedSendSize);
	resizeObserver.observe(document.body);

	// Also observe for DOM mutations that might affect size
	const mutationObserver = new MutationObserver(debouncedSendSize);
	mutationObserver.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
	});
}

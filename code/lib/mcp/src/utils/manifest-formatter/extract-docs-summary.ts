import { MAX_SUMMARY_LENGTH } from './types.ts';

/**
 * Extracts a summary from MDX content.
 * The summary is created by:
 * 1. Removing import statements
 * 2. Removing JSX/MDX expressions
 * 3. Extracting only text content from JSX/HTML elements
 * 4. Truncating to MAX_SUMMARY_LENGTH characters if needed
 *
 * @param content - The MDX content string
 * @returns A summary string, or undefined if no meaningful text content is found
 */
export function extractDocsSummary(content: string): string | undefined {
	let result = content;

	// Step 1: Remove import statements (can be single or multi-line)
	// Matches: import ... from '...' or import '...'
	result = result.replace(
		/^\s*import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?\s*$/gm,
		'',
	);

	// Step 2: Remove JSX/MDX expressions like {expression} or {/* comments */}
	// Handle nested braces by iteratively removing innermost expressions
	let prevResult = '';
	while (prevResult !== result) {
		prevResult = result;
		result = result.replace(/\{[^{}]*\}/g, '');
	}

	// Step 3: Remove self-closing tags like <Component /> or <br />
	result = result.replace(/<[^>]+\/>/g, '');

	// Step 4: Extract text content from JSX/HTML elements
	// Iteratively remove tags from innermost to outermost
	prevResult = '';
	while (prevResult !== result) {
		prevResult = result;
		// Remove tags but keep content between them
		// Match opening and closing tags of the same type
		result = result.replace(/<(\w+)[^>]*>([\s\S]*?)<\/\1>/g, '$2');
	}

	// Step 5: Remove any remaining standalone opening or closing tags
	result = result.replace(/<[^>]+>/g, '');

	// Step 6: Clean up whitespace
	// Replace multiple whitespace characters (including newlines) with single space
	result = result.replace(/\s+/g, ' ').trim();

	if (!result) {
		return undefined;
	}

	if (result.length > MAX_SUMMARY_LENGTH) {
		return `${result.slice(0, MAX_SUMMARY_LENGTH)}...`;
	}

	return result;
}

/**
 * Checks if a character code is whitespace (space, tab, newline, carriage return)
 *
 * Checking char codes is slightly faster than using regex or string methods.
 */
function isWhitespace(code: number): boolean {
	return code === 32 || code === 9 || code === 10 || code === 13;
}

/**
 * Checks if a character code is alphanumeric or underscore
 * 0-9 (48-57), A-Z (65-90), a-z (97-122), underscore (95)
 *
 * Checking char codes is slightly faster than using regex or string methods.
 */
function isAlphanumeric(code: number): boolean {
	return (
		(code >= 48 && code <= 57) ||
		(code >= 65 && code <= 90) ||
		(code >= 97 && code <= 122) ||
		code === 95
	);
}

/**
 * Estimates token count from text using a fast approximation.
 * Counts:
 * - Continuous whitespace as a single token
 * - Continuous alphanumeric sequences as single tokens
 * - Each special character as an individual token
 *
 * This is a cheap approximation suitable for telemetry purposes.
 *
 * @param text - The text to estimate token count for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
	if (!text) return 0;

	let tokenCount = 0;
	let i = 0;
	const len = text.length;

	while (i < len) {
		const code = text.charCodeAt(i);

		if (isWhitespace(code)) {
			tokenCount++;
			i++;
			while (i < len && isWhitespace(text.charCodeAt(i))) {
				i++;
			}
		} else if (isAlphanumeric(code)) {
			tokenCount++;
			i++;
			while (i < len && isAlphanumeric(text.charCodeAt(i))) {
				i++;
			}
		} else {
			tokenCount++;
			i++;
		}
	}

	return tokenCount;
}

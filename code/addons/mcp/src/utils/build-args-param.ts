/*
This file is adapted from Storybook's own implementation:
https://github.com/storybookjs/storybook/blob/466824f7d57bfed34e0096671602333bf85c86bc/code/core/src/router/utils.test.ts
Just simplified a bit for our use case.
*/
import { stringify } from 'picoquery';

type Args = Record<string, unknown>;

const HEX_REGEXP = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i;
const COLOR_REGEXP =
	/^(rgba?|hsla?)\(([0-9]{1,3}),\s?([0-9]{1,3})%?,\s?([0-9]{1,3})%?,?\s?([0-9](\.[0-9]{1,2})?)?\)$/i;

/**
 * Encodes special values for Storybook's args URL format.
 * Handles undefined, null, booleans, dates, hex colors, and rgba/hsla colors.
 */
function encodeSpecialValues(value: unknown): unknown {
	if (value === undefined) {
		return '!undefined';
	}

	if (value === null) {
		return '!null';
	}

	if (typeof value === 'string') {
		if (HEX_REGEXP.test(value)) {
			return `!hex(${value.slice(1)})`;
		}

		if (COLOR_REGEXP.test(value)) {
			return `!${value.replace(/[\s%]/g, '')}`;
		}
		return value;
	}

	if (typeof value === 'boolean') {
		return `!${value}`;
	}

	if (value instanceof Date) {
		return `!date(${value.toISOString()})`;
	}

	if (Array.isArray(value)) {
		return value.map(encodeSpecialValues);
	}

	// is object
	if (typeof value === 'object' && value !== null) {
		return Object.entries(value as Record<string, unknown>).reduce(
			(acc, [key, val]) =>
				Object.assign(acc, { [key]: encodeSpecialValues(val) }),
			{},
		);
	}

	return value;
}

/**
 * Replaces some url-encoded characters with their decoded equivalents.
 * The URI RFC specifies these should be encoded, but all browsers will
 * tolerate them being decoded, so we opt to go with it for cleaner looking URIs.
 */
function decodeKnownQueryChar(chr: string): string {
	switch (chr) {
		case '%20':
			return '+';
		case '%5B':
			return '[';
		case '%5D':
			return ']';
		case '%2C':
			return ',';
		case '%3A':
			return ':';
	}
	return chr;
}

const KNOWN_QUERY_CHAR_REGEXP = /%[0-9A-F]{2}/g;

/**
 * Builds a Storybook args query parameter string from an object of props.
 *
 * The format uses semicolons as delimiters and colons for key:value pairs,
 * with special encoding for booleans, null, undefined, dates, and colors.
 *
 * Example output: "disabled:!true;label:Hello+World;count:42"
 */
export function buildArgsParam(args: Args): string {
	if (!args || Object.keys(args).length === 0) {
		return '';
	}

	return stringify(encodeSpecialValues(args), {
		delimiter: ';',
		nesting: true,
		nestingSyntax: 'js',
	})
		.replace(KNOWN_QUERY_CHAR_REGEXP, decodeKnownQueryChar)
		.split(';')
		.map((part: string) => part.replace('=', ':'))
		.join(';');
}

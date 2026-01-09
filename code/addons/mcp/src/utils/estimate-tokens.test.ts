import { describe, it, expect } from 'vitest';
import { estimateTokens } from './estimate-tokens.ts';

describe('estimateTokens', () => {
	it('should return 0 for empty string', () => {
		expect(estimateTokens('')).toBe(0);
	});

	it('should count single word', () => {
		expect(estimateTokens('hello')).toBe(1);
	});

	it('should count words separated by single space', () => {
		expect(estimateTokens('hello world')).toBe(3); // hello + space + world
	});

	it('should count multiple continuous spaces as single token', () => {
		expect(estimateTokens('hello   world')).toBe(3); // hello + multiple-spaces + world
	});

	it('should count tabs and newlines as single whitespace token', () => {
		expect(estimateTokens('hello\t\nworld')).toBe(3); // hello + tab-newline + world
	});

	it('should count hyphenated words separately', () => {
		expect(estimateTokens('hello-world')).toBe(3); // hello + hyphen + world
	});

	it('should count continuous special characters individually', () => {
		expect(estimateTokens('hello---world')).toBe(5); // hello + - + - + - + world
	});

	it('should count punctuation individually', () => {
		expect(estimateTokens('hello, world!')).toBe(5); // hello + comma + space + world + exclamation
	});

	it('should handle leading and trailing whitespace', () => {
		expect(estimateTokens('  hello world  ')).toBe(5); // leading-spaces + hello + space + world + trailing-spaces
	});

	it('should count complex text correctly', () => {
		const text = `# Getting Started

Welcome to the component library.`;
		// # + space + Getting + space + Started + double-newline + Welcome + space + to + space + the + space + component + space + library + .
		const result = estimateTokens(text);
		expect(result).toBe(16);
	});

	it('should handle code examples with punctuation and symbols', () => {
		const text = 'const x = 123;';
		// const + space + x + space + = + space + 123 + ;
		expect(estimateTokens(text)).toBe(8);
	});

	it('should count URLs correctly', () => {
		const text = 'https://example.com/path';
		// https + : + / + / + example + . + com + / + path
		expect(estimateTokens(text)).toBe(9);
	});
});

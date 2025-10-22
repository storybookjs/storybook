import { describe, it, expect } from 'vitest';
import { errorToMCPContent, ManifestFetchError } from './fetch-manifest.ts';

describe('errorToMCPContent', () => {
	it('should convert ManifestFetchError to MCP error content', () => {
		const error = new ManifestFetchError(
			'Failed to fetch',
			'https://example.com',
		);

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error fetching manifest: Failed to fetch',
				},
			],
			isError: true,
		});
	});

	it('should convert generic Error to MCP error content', () => {
		const error = new Error('Something went wrong');

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Unexpected error: Something went wrong',
				},
			],
			isError: true,
		});
	});

	it('should handle ManifestFetchError with cause', () => {
		const cause = new Error('Network error');
		const error = new ManifestFetchError(
			'Failed to fetch manifest',
			'https://example.com',
			cause,
		);

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error fetching manifest: Failed to fetch manifest\nCaused by: Network error',
				},
			],
			isError: true,
		});
	});

	it('should handle ManifestFetchError without URL', () => {
		const error = new ManifestFetchError('Failed to fetch');

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error fetching manifest: Failed to fetch',
				},
			],
			isError: true,
		});
	});
});

import { describe, it, expect } from 'vitest';
import { errorToMCPContent, ManifestGetError } from './get-manifest.ts';

describe('errorToMCPContent', () => {
	it('should convert ManifestGetError to MCP error content', () => {
		const error = new ManifestGetError('Failed to get', 'https://example.com');

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error getting manifest: Failed to get',
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

	it('should handle ManifestGetError with cause', () => {
		const cause = new Error('Network error');
		const error = new ManifestGetError(
			'Failed to get manifest',
			'https://example.com',
			cause,
		);

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error getting manifest: Failed to get manifest\nCaused by: Network error',
				},
			],
			isError: true,
		});
	});

	it('should handle ManifestGetError without URL', () => {
		const error = new ManifestGetError('Failed to get');

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error getting manifest: Failed to get',
				},
			],
			isError: true,
		});
	});
});

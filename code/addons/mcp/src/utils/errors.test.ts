import { describe, it, expect } from 'vitest';
import { errorToMCPContent } from './errors.ts';

describe('errorToMCPContent', () => {
	it('should convert Error to MCP error content', () => {
		const error = new Error('Something went wrong');

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error: Something went wrong',
				},
			],
			isError: true,
		});
	});

	it('should convert string to MCP error content', () => {
		const error = 'Simple error message';

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error: Simple error message',
				},
			],
			isError: true,
		});
	});

	it('should handle Error with empty message', () => {
		const error = new Error('');

		const result = errorToMCPContent(error);

		expect(result).toEqual({
			content: [
				{
					type: 'text',
					text: 'Error: ',
				},
			],
			isError: true,
		});
	});
});

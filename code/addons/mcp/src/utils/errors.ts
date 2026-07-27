/**
 * MCP tool result type for error responses
 */
type MCPErrorResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError: true;
};

/**
 * Converts an error to MCP-compatible content format
 *
 * @param error - The error to convert (can be any type)
 * @returns A tool result with error content and isError flag
 */
export const errorToMCPContent = (error: unknown): MCPErrorResult => {
	const errorMessage = error instanceof Error ? error.message : String(error);

	return {
		content: [
			{
				type: 'text',
				text: `Error: ${errorMessage}`,
			},
		],
		isError: true,
	};
};

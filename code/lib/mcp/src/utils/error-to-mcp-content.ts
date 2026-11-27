import {
  formatRequiresOwnMcpNotice,
  ManifestGetError,
  RequiresOwnMcpError,
} from 'storybook/internal/toolsets-docs';

type MCPTextResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
};

/**
 * Converts a thrown error into an MCP result.
 *
 * A source that requires its own endpoint is not a failure — it is an answer telling the agent
 * where to go — so it is returned without the error flag.
 */
export const errorToMCPContent = (error: unknown): MCPTextResult => {
  if (error instanceof RequiresOwnMcpError) {
    return {
      content: [{ type: 'text', text: formatRequiresOwnMcpNotice(error.source, error.endpoint) }],
    };
  }

  const errorPrefix =
    error instanceof ManifestGetError ? 'Error getting manifest' : 'Unexpected error';
  const errorMessage = error instanceof Error ? error.message : String(error);

  let fullMessage = `${errorPrefix}: ${errorMessage}`;
  if (error instanceof ManifestGetError && error.cause) {
    const causeMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
    fullMessage += `\nCaused by: ${causeMessage}`;
  }

  return {
    content: [{ type: 'text', text: fullMessage }],
    isError: true,
  };
};

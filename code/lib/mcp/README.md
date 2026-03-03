# `@storybook/mcp`

The hype is real.

## Server Instructions

When an MCP client connects to this server, it receives server-level instructions in the `initialize` response. These instructions guide agents on how to use the available tools effectively:

- **Tool workflow**: When to use `list-all-documentation`, `get-documentation`, and `get-documentation-for-story`
- **Anti-hallucination rules**: Never assume component props or API shape — always retrieve documentation first
- **Multi-source behavior**: How to scope requests when multiple Storybook sources are configured

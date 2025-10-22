# Copilot Instructions for @storybook/mcp

## Project Overview

This is a Model Context Protocol (MCP) server for Storybook that serves knowledge about components based on Storybook stories and documentation. The project is built with TypeScript and provides an HTTP transport endpoint for MCP communication.

## Architecture

### Key Components

- **MCP Server**: Built using the `tmcp` library with HTTP transport
- **Tools System**: Extensible tool registration system (currently includes `list_all_components`)
- **Schema Validation**: Uses Valibot for JSON schema validation via `@tmcp/adapter-valibot`
- **HTTP Transport**: Provides HTTP-based MCP communication via `@tmcp/transport-http`

### File Structure

```
src/
  index.ts          # Main entry point - exports createStorybookMcpHandler
  serve.ts          # Development server setup
  tools/
    list.ts         # Tool definitions (e.g., list_all_components)
```

### Key Design Patterns

1. **Factory Pattern**: `createStorybookMcpHandler()` creates configured handler instances
2. **Tool Registration**: Tools are added to the server using `server.tool()` method
3. **Async Handler**: Returns a Promise-based request handler compatible with standard HTTP servers

## Development Workflow

### Prerequisites

- Node.js 24+ (see `.nvmrc`)
- pnpm 10.18.3+ (specified in `packageManager` field)

### Setup

```bash
pnpm install
```

### Build

```bash
pnpm build
```

Builds the project using `tsdown` (rolldown-based bundler). Output goes to `dist/` directory.

### Development

```bash
pnpm dev
```

Runs the development server with hot reload using Node's `--watch` flag.

### Formatting

```bash
pnpm format
```

Formats code using Prettier.

### Testing

```bash
pnpm test run
```

Or with coverage enabled:

```bash
pnpm test run --coverage
```

### Inspector Tool

```bash
pnpm inspect
```

Launches the MCP inspector for debugging the MCP server using the configuration in `.mcp.json`.

## Code Style and Conventions

### TypeScript Configuration

- Uses `@tsconfig/node24` and `@tsconfig/node-ts` as base configs
- Module system: ESM with `"type": "module"` in package.json
- Module resolution: `bundler` mode
- Module format: `preserve`

### Code Style

- Use Prettier for formatting (config: `.prettierignore`)
- Prefer async/await over callbacks
- Export types and interfaces explicitly
- Use descriptive variable and function names
- **Always include file extensions in imports** (e.g., `import { foo } from './bar.ts'`, not `./bar`), except when importing packages.

### Naming Conventions

- Constants: SCREAMING_SNAKE_CASE (e.g., `LIST_TOOL_NAME`)
- Functions: camelCase (e.g., `createStorybookMcpHandler`, `addListTool`)
- Types/Interfaces: PascalCase (e.g., `StorybookMcpHandlerOptions`, `Handler`)

## Important Files

### Configuration Files

- `package.json` - Project metadata and scripts
- `tsconfig.json` - TypeScript configuration
- `tsdown.config.ts` - Build tool configuration
- `.mcp.json` - MCP inspector configuration
- `.nvmrc` - Node version specification

### Source Files

- `src/index.ts` - Main library entry point (exported API)
- `src/tools/list.ts` - Tool definitions
- `serve.ts` - Development server (not included in distribution)

### Build Artifacts

- `dist/` - Build output (gitignored, included in npm package)
- `pnpm-lock.yaml` - Dependency lock file

## Adding New Tools

To add a new MCP tool:

1. Create a new file in `src/tools/` (e.g., `src/tools/my-tool.ts`)
2. Export a constant for the tool name
3. Export an async function that adds the tool to the server:
   ```typescript
   export async function addMyTool(server: McpServer) {
   	server.tool(
   		{
   			name: 'my_tool_name',
   			description: 'Tool description',
   		},
   		() => ({
   			content: [{ type: 'text', text: 'result' }],
   		}),
   	);
   }
   ```
4. Import and call the function in `src/index.ts` after `addListTool(server)`

## MCP Protocol

This server implements the Model Context Protocol (MCP) specification:

- **Transport**: HTTP-based transport
- **Capabilities**: Supports dynamic tool listing (`tools: { listChanged: true }`)
- **Schema Validation**: Uses Valibot for request/response validation

## Dependencies

### Runtime (Production)

None - this is a library with peer/dev dependencies only.

### Development

- `tmcp` - MCP server implementation
- `@tmcp/adapter-valibot` - Valibot schema adapter for MCP
- `@tmcp/transport-http` - HTTP transport for MCP
- `valibot` - Schema validation
- `srvx` - HTTP server for development
- `tsdown` - Build tool
- `typescript` - TypeScript compiler

## Release Process

The project uses Changesets for version management:

```bash
pnpm changeset        # Create a changeset
pnpm release          # Build and publish to npm
```

Releases are automated via GitHub Actions (see `.github/workflows/release.yml`).

## Documentation resources

When working with the MCP server/tools related stuff, refer to the following resources:

- https://github.com/paoloricciuti/tmcp/tree/main/packages/tmcp
- https://github.com/paoloricciuti/tmcp/tree/main/packages/transport-http
- https://github.com/paoloricciuti/tmcp

When working on data validation, refer to the following resources:

- https://valibot.dev/
- https://github.com/paoloricciuti/tmcp/tree/main/packages/adapter-valibot

## Notes for AI Assistants

- Prefer test-driven development when possible, and continously use test coverage to verify test quality
- When adding features, prefer minimal changes to existing code
- Follow the established patterns for tool registration
- Use TypeScript types from the `tmcp` package
- Ensure all exports are properly typed
- Update this file when making significant architectural changes
- The project uses ESM modules exclusively
- Build artifacts in `dist/` should not be committed to git
- When modifying package.json scripts, ensure they work with pnpm

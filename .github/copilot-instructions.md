# GitHub Copilot Instructions for Storybook

This document provides comprehensive instructions for GitHub Copilot when working on the Storybook repository.

## Repository Overview

Storybook is a large monorepo built with TypeScript, React, and various other frameworks. The monorepo root is at the git root (not `code/`), with the main codebase in `code/` and build tooling in `scripts/`.

## System Requirements

- **Node.js**: 22.21.1 (see `.nvmrc`)
- **Package Manager**: pnpm 10.28.1 (via corepack)
- **Operating System**: Linux/macOS (CI environment)

## Repository Structure

```
storybook/                        # pnpm monorepo root
├── .github/                      # GitHub configurations and workflows
├── .nx/                          # NX workflows and configuration
├── code/                         # Main codebase
│   ├── .storybook/               # Configuration for internal UI Storybook
│   ├── core/                     # Core Storybook package
│   ├── lib/                      # Core supporting libraries
│   ├── addons/                   # Core Storybook addons
│   ├── builders/                 # Builder integrations
│   ├── renderers/                # Renderer integrations
│   ├── frameworks/               # Framework integrations
│   ├── presets/                  # Preset packages for Webpack-based integrations
│   └── sandbox/                  # Internal build artifacts (ignore)
├── scripts/                      # Build and development scripts
├── docs/                         # Documentation
├── test-storybooks/              # Test repos
└── ../storybook-sandboxes/       # Generated sandbox environments (outside repo)
```

## Essential Commands and Build Times

All commands run from the **repository root** unless otherwise specified.

### Installation & Setup

```bash
pnpm install                      # Install all dependencies (~2.5 min)
```

### Compilation (Two Approaches)

**Using pnpm task (custom task runner):**

```bash
pnpm task compile                 # Compile all packages (~3 min)
```

**Using NX (recommended for better caching):**

```bash
pnpm nx run-many -t compile -c production    # Compile all packages
pnpm nx compile <package-name> -c production # Compile specific package
```

### Linting

```bash
pnpm lint                         # Run all linting checks (~4 min)
```

### Type Checking

```bash
pnpm task check                   # TypeScript type checking
# OR with NX:
pnpm nx run-many -t check -c production
```

### Development Server

```bash
# Start Storybook UI development server
cd code && pnpm storybook:ui      # Serves on http://localhost:6006/
# Requires compilation first!

# Build Storybook UI for production
cd code && pnpm storybook:ui:build  # Output: code/storybook-static/
```

### Testing

```bash
cd code && pnpm test              # Run all tests
cd code && pnpm test:watch        # Watch mode
cd code && pnpm storybook:vitest  # Storybook UI specific tests

# Task-based testing (with template sandboxes)
pnpm task e2e-tests-dev --template react-vite/default-ts --start-from auto
pnpm task e2e-tests-build --template react-vite/default-ts --start-from auto
pnpm task test-runner-dev --template react-vite/default-ts --start-from auto
pnpm task test-runner-build --template react-vite/default-ts --start-from auto
```

## NX Task Runner (Recommended)

The repository uses NX for task orchestration with better caching and dependency management. NX correctly invalidates compile/check steps when `scripts/` changes.

### pnpm task vs NX equivalents

```bash
# Compilation
pnpm task compile --no-link
pnpm nx run-many -t compile -c production

# E2E tests on specific template
pnpm task e2e-tests-dev --template react-vite/default-ts --start-from auto --no-link
pnpm nx e2e-tests-dev react-vite/default-ts -c production

# Skip task dependencies (start from a specific step)
pnpm task e2e-tests-dev --start-from e2e-tests --template react-vite/default-ts --no-link
pnpm nx e2e-tests-dev -c production --exclude-task-dependencies
```

### Key NX Concepts

- `-c production` flag is **required** for sandbox-related commands
- `react-vite/default-ts` is the default project (can omit in NX commands)
- NX automatically handles task dependencies via `nx.json` configuration
- Uses NX Cloud for distributed caching in CI

## Important Warnings and Limitations

### Commands to Avoid

- **DO NOT RUN**: `pnpm task dev` - This starts a permanent development server that runs indefinitely
- **DO NOT RUN**: `pnpm start` - Also starts a long-running development server

### Sandbox Location Change

Sandboxes are now generated **outside** the repository at `../storybook-sandboxes/` by default.

- Set `STORYBOOK_SANDBOX_ROOT=./sandbox` for local sandbox directory (not recommended)
- The `./sandbox` directory exists only for NX outputs (not for CI tests)

### Available Task Commands

The repository includes task scripts in `scripts/tasks/`:

- `compile` - TypeScript compilation
- `check` - Package validation
- `build` - Package building
- `sandbox` - Sandbox creation
- `dev` - Development server (AVOID - runs indefinitely)
- `e2e-tests-build` / `e2e-tests-dev` - E2E tests
- `test-runner-build` / `test-runner-dev` - Test runner scenarios
- `chromatic` - Visual testing with Chromatic
- `publish` - Package publishing
- `run-registry` - Local npm registry (verdaccio)
- `smoke-test` - Basic functionality tests
- `vitest-test` - Vitest integration tests

## Recommended Development Workflow

### For Code Changes

1. Install dependencies: `pnpm install` (if needed)
2. Compile packages: `pnpm nx run-many -t compile -c production`
3. Make your changes
4. Recompile changed packages
5. Test changes with: `cd code && pnpm storybook:ui:build`
6. Run relevant tests: `cd code && pnpm test`

### For Testing UI Changes

1. Generate a sandbox: `pnpm task sandbox --template react-vite/default-ts --start-from auto`
   - Sandboxes are created at `../storybook-sandboxes/` by default
2. If sandbox generation fails, use Storybook UI: `cd code && pnpm storybook:ui`
3. Access at http://localhost:6006/

### For Addon/Framework/Renderers Development

1. Navigate to the relevant package in `code/addons/`, `code/frameworks/` or `code/renderers/`
2. Make changes to source files
3. Recompile: `pnpm nx compile <package-name> -c production`
4. Generate a sandbox matching the framework/renderer
5. Test with appropriate test tasks

## Bash Command Guidelines

### Timeout Settings

- **Short commands** (< 30s): Default timeout (120s) is sufficient
- **Dependency installation**: Use 300+ seconds timeout
- **Compilation**: Use 300+ seconds timeout
- **Linting**: Use 300+ seconds timeout
- **Development servers**: Use async mode or timeout commands

### Example Bash Commands

```bash
# Safe compilation with proper timeout
bash(command="cd /path/to/storybook && pnpm nx run-many -t compile -c production", timeout=300, async=false)

# Start development server with timeout to prevent hanging
bash(command="cd /path/to/storybook/code && timeout 30s pnpm storybook:ui", timeout=45, async=false)

# Use async for interactive or long-running commands
bash(command="cd /path/to/storybook/code && pnpm storybook:ui", async=true)
```

## Sandbox Environments

### Generating New Sandboxes

Sandboxes are test environments that allow you to test Storybook changes with different framework combinations. **Note**: Sandboxes are now generated outside the repo by default at `../storybook-sandboxes/`.

```bash
# Generate a new sandbox (run from repository root)
pnpm task sandbox --template react-vite/default-ts --start-from auto
# Creates: ../storybook-sandboxes/react-vite-default-ts/

# Using NX (with -c production flag required)
pnpm nx sandbox react-vite/default-ts -c production
```

### Available Framework/Builder Templates

Common templates include:

- `react-vite/default-ts` - React with Vite and TypeScript
- `react-webpack/default-ts` - React with Webpack and TypeScript
- `angular-cli/default-ts` - Angular CLI with TypeScript
- `svelte-vite/default-ts` - Svelte with Vite and TypeScript
- `vue3-vite/default-ts` - Vue 3 with Vite and TypeScript
- `nextjs/default-ts` - Next.js with TypeScript
- And many more...

### Working with Generated Sandboxes

Once a sandbox is successfully generated, you can work with it:

```bash
# Navigate to the generated sandbox (now outside the repo)
cd ../storybook-sandboxes/react-vite-default-ts

# Install dependencies if needed (sandboxes use yarn)
yarn install

# Start the sandbox Storybook
yarn storybook
```

### Current Limitations

- **Sandbox Location**: Sandboxes are generated at `../storybook-sandboxes/` by default, outside the repository
- **NX Outputs**: The `./sandbox` directory in the repo exists only for NX outputs, not for CI tests
- **Workaround**: For testing changes when sandbox generation fails, you can work directly with the Storybook UI instead

### Testing Changes Without Sandboxes

When sandbox generation is not available:

1. Make your changes to the relevant packages in `code/`
2. Compile: `pnpm nx run-many -t compile -c production`
3. Test with Storybook UI: `cd code && pnpm storybook:ui`
4. Access at http://localhost:6006/ to test your changes

## Package Management

### Adding Dependencies

```bash
# Add to specific workspace
cd code/frameworks/react-vite && pnpm add <package>

# Add to root workspace
pnpm add <package> -w
```

### Building Specific Packages

```bash
# Build specific package (run from code/ directory)
cd code && pnpm build <package-name>
```

## Testing Strategy

### Unit Tests

```bash
cd code && pnpm test
# Run specific test suites as needed
```

### Visual Testing

- Use Storybook UI for visual regression testing
- Chromatic integration available for visual reviews

### End-to-End Testing

- Playwright tests available (version 1.52.0 configured)
- E2E test tasks: `pnpm task e2e-tests-build --start-from auto` or `pnpm task e2e-tests-dev --start-from auto`
- Test runner scenarios: `pnpm task test-runner-build --start-from auto` or `pnpm task test-runner-dev --start-from auto`
- Smoke tests: `pnpm task smoke-test --start-from auto`

### Watch Mode Commands

```bash
# Watch mode for unit tests
cd code && pnpm test:watch

# Watch mode for affected tests only
pnpm affected:test

# Storybook UI vitest watch mode
cd code && pnpm storybook:vitest
```

## Troubleshooting

### Common Issues

1. **Build Failures**: Often resolved by running `pnpm install` followed by `pnpm nx run-many -t compile -c production`
2. **Port Conflicts**: Storybook UI uses port 6006 by default
3. **Memory Issues**: Large compilation tasks may require increased Node.js memory limits
4. **Sandbox Directory Confusion**: Sandboxes are at `../storybook-sandboxes/`, not `./sandbox` or `code/sandbox/`

### Debug Information

- Storybook logs available in generated sandbox directories
- Use `--debug` flag with CLI commands for verbose output
- Check `.cache/` directories for build artifacts

## Performance Tips

1. **Incremental Builds**: Use compilation cache when possible
2. **Selective Building**: Build only changed packages during development
3. **Memory Management**: Monitor memory usage during large operations
4. **Parallel Processing**: pnpm commands use parallel processing by default

## Contributing Guidelines

### Code Style

- ESLint and Prettier configurations are enforced
- TypeScript strict mode is enabled
- Follow existing patterns in the codebase

### Code Quality Checks

After making file changes, always run both formatting and linting checks:

1. **Prettier**: Format code with `pnpm prettier --write <file>`
2. **ESLint**: Check for linting issues with `pnpm lint:js:cmd <file>`
   - The full eslint command is: `cross-env NODE_ENV=production eslint --cache --cache-location=../.cache/eslint --ext .js,.jsx,.json,.html,.ts,.tsx,.mjs --report-unused-disable-directives`
   - Use the `lint:js:cmd` script for convenience
   - Fix any errors or warnings before committing

### Testing Guidelines

When writing unit tests:

1. **Export functions for testing**: If functions need to be tested, export them from the module
2. **Write meaningful tests**: Tests should actually import and call the functions being tested, not just verify syntax patterns
3. **Use coverage reports**: Run tests with coverage to identify untested code
   - Run coverage: `pnpm vitest run --coverage <test-file>`
   - Aim for high coverage of business logic (75%+ for statements/lines)
   - Use coverage reports to identify missing test cases
   - Focus on covering:
     - All branches and conditions
     - Edge cases and error paths
     - Different input variations
4. **Mock external dependencies**: Use `vi.mock()` to mock file system, loggers, and other external dependencies
5. **Run tests before committing**: Ensure all tests pass with `pnpm test` or `pnpm vitest run`

### Logging

When adding logging to code, always use the appropriate logger:

- **Server-side code** (Node.js): Use `logger` from `storybook/internal/node-logger`

  ```typescript
  import { logger } from 'storybook/internal/node-logger';
  
  logger.info('Server message');
  logger.warn('Warning message');
  logger.error('Error message');
  ```

- **Client-side code** (browser): Use `logger` from `storybook/internal/client-logger`

  ```typescript
  import { logger } from 'storybook/internal/client-logger';
  
  logger.info('Client message');
  logger.warn('Warning message');
  logger.error('Error message');
  ```

- **DO NOT** use `console.log`, `console.warn`, or `console.error` directly unless in isolated files where importing loggers would significantly increase bundle size

### Git Workflow

- Work on feature branches
- Ensure all builds and tests pass before submitting PRs
- Include relevant documentation updates

### Documentation

- Update relevant README files for significant changes
- Include code examples in addon/framework documentation
- Update migration guides for breaking changes

This document should be updated as the repository evolves and new build requirements or limitations are discovered.

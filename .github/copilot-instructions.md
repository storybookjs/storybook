# GitHub Copilot Instructions for Storybook

This document provides comprehensive instructions for GitHub Copilot when working on the Storybook repository.

## Repository Overview

Storybook is a large monorepo built with TypeScript, React, and various other frameworks. The main codebase is located in the `code/` directory, with additional tooling in `scripts/`.

## System Requirements

- **Node.js**: 22.16.0 (see `.nvmrc`)
- **Package Manager**: Yarn 4.9.1
- **Operating System**: Linux/macOS (CI environment)

## Repository Structure

```
storybook/
├── .github/           # GitHub configurations and workflows
├── code/              # Main monorepo codebase
│   ├── .storybook/    # Configuration for internal UI Storybook
│   ├── core/          # Core Storybook package
│   ├── lib/           # Core supporting libraries
│   ├── addons/        # Core Storybook addons
│   ├── builders/      # Builder integrations
│   ├── renderers/     # Renderer integrations
│   ├── frameworks/    # Framework integrations
│   ├── presets/       # Preset packages for Webpack-based integrations
│   └── sandbox/       # Internal build artifacts (not useful for anything, ignore)
├── sandbox/           # Generated sandbox environments (created by yarn task --task sandbox)
├── scripts/           # Build and development scripts
├── docs/              # Documentation
└── test-storybooks/   # Test configurations
```

## Essential Commands and Build Times

### Installation & Setup
```bash
# Install all dependencies (run from repository root)
yarn i
# Time: ~2.5 minutes
# Timeout: Use 300+ seconds for bash commands
```

### Compilation
```bash
# Compile all packages (run from repository root)
yarn task --task compile
# Time: ~3 minutes (tested: 3m0.729s)
# Timeout: Use 300+ seconds for bash commands
```

### Linting
```bash
# Run all linting checks (run from repository root)
yarn lint
# Time: ~4 minutes
# Timeout: Use 300+ seconds for bash commands
```

### Type Checking
```bash
# Run TypeScript type checking across all packages (run from repository root)
yarn task --task check
# Time: Variable, depends on codebase size
# Timeout: Use 300+ seconds for bash commands
```

### Development Server
```bash
# Start Storybook UI development server (run from code/ directory)
cd code && yarn storybook:ui
# Time: ~2.26 seconds startup time
# Serves on: http://localhost:6006/
# Note: This runs indefinitely - use timeout or async mode
# Note: This requires the repository to be compiled first, see Compilation above

# Build Storybook UI for production (run from code/ directory)
cd code && yarn storybook:ui:build
# Time: ~1m 46s
# Output: code/storybook-static/
# Note: This does NOT run indefinitely
# Note: This requires the repository to be compiled first, see Compilation above
```

### Testing
```bash
# Run all tests (run from code/ directory)
cd code && yarn test
# Time: Variable, depends on test scope
# Watch mode for continuous testing
cd code && yarn test:watch

# Storybook UI specific tests
cd code && yarn storybook:vitest

# Available task-based testing commands
yarn task --task e2e-tests-build    # E2E tests for built Storybook
yarn task --task e2e-tests-dev      # E2E tests for dev server
yarn task --task test-runner-build  # Test runner for built Storybook
yarn task --task test-runner-dev    # Test runner for dev server
yarn task --task smoke-test         # Basic smoke tests
yarn task --task vitest-test        # Vitest integration tests
```

## Important Warnings and Limitations

### Commands to Avoid
- **DO NOT RUN**: `yarn task --task dev` - This starts a permanent development server that runs indefinitely and will cause timeouts
- **DO NOT RUN**: `yarn start` - This also starts a long-running development server

### Available Task Commands
The repository includes 20 task scripts in `scripts/tasks/`:
- `bench` - Performance benchmarking
- `build` - Package building
- `check` - Package validation
- `chromatic` - Visual testing with Chromatic
- `compile` - TypeScript compilation
- `dev` - Development server (AVOID - runs indefinitely)
- `e2e-tests-build` - E2E tests for built Storybook
- `e2e-tests-dev` - E2E tests for dev server
- `generate` - Code generation
- `install` - Dependency installation
- `publish` - Package publishing
- `run-registry` - Local npm registry
- `sandbox` - Sandbox creation (may occasionally fail due to environment issues)
- `serve` - Static serving
- `smoke-test` - Basic functionality tests
- `sync-docs` - Documentation synchronization
- `test-runner-build` - Test runner for built Storybook
- `test-runner-dev` - Test runner for dev server
- `vitest-test` - Vitest integration tests

### Known Issues
1. **Sandbox Generation Dependencies**: Sandbox creation may occasionally fail due to environment-specific issues (like Yarn version conflicts), but the GitHub API rate limiting has been resolved
   ```bash
   # Sandbox generation now works in CI environments
   yarn task --task sandbox --template react-vite/default-ts
   ```

2. **Dependency Warnings**: The build process shows many peer dependency warnings, but these are expected and don't prevent successful builds

3. **Large Build Times**: Most build operations take several minutes - always use appropriate timeouts

4. **Sandbox Generation**: Generally reliable in CI environments, though may occasionally fail due to dependency or environment-specific issues

## Recommended Development Workflow

### For Code Changes
1. Install dependencies: `yarn i` (if needed)
2. Compile packages: `yarn task --task compile`
3. Make your changes
4. Compile packages with `cd code && yarn task --task compile`
5. Test changes with: `cd code && yarn storybook:ui:build`
6. Run relevant tests: `cd code && yarn test`

### For Testing UI Changes
1. Generate a sandbox with: `yarn task --task sandbox --template [framework-template]` (may occasionally fail due to environment issues)
2. If sandbox generation fails, use Storybook UI: `cd code && yarn storybook:ui`
3. Access at http://localhost:6006/

### For Addon/Framework/Renderers Development
1. Navigate to the relevant package in `code/addons/`, `code/frameworks/` or `code/renderers/`
2. Make changes to source files
3. Rebuild with compilation command
4. Generate a sandbox that matches the framework/renderer being worked on
5. Test with the appropriate test tasks

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
bash(command="cd /path/to/storybook && yarn task --task compile", timeout=300, async=false)

# Start development server with timeout to prevent hanging
bash(command="cd /path/to/storybook/code && timeout 30s yarn storybook:ui", timeout=45, async=false)

# Use async for interactive or long-running commands
bash(command="cd /path/to/storybook/code && yarn storybook:ui", async=true)
```

## Sandbox Environments

### Generating New Sandboxes
Sandboxes are test environments that allow you to test Storybook changes with different framework combinations. **Note**: Sandbox creation generally works in CI environments, though may occasionally fail due to dependency or environment-specific issues.

```bash
# Generate a new sandbox (run from repository root)
yarn task --task sandbox --template react-vite/default-ts
# Creates: sandbox/react-vite-default-ts/
# Note: May occasionally fail due to environment-specific issues (e.g., Yarn version conflicts)
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
# Navigate to the generated sandbox (in root sandbox/ directory)
cd sandbox/react-vite-default-ts

# Install dependencies if needed
yarn install

# Start the sandbox Storybook
yarn storybook
```

### Current Limitations
- **Environment-Specific Issues**: Sandbox creation may occasionally fail due to dependency conflicts (e.g., Yarn version management), but the GitHub API rate limiting has been resolved
- **Workaround**: For testing changes when sandbox generation fails, you can work directly with the Storybook UI instead
- The `code/sandbox/` directory contains internal build artifacts and should not be used for testing

### Testing Changes Without Sandboxes
When sandbox generation is not available:
1. Make your changes to the relevant packages in `code/`
2. Compile: `yarn task --task compile`
3. Test with Storybook UI: `cd code && yarn storybook:ui`
4. Access at http://localhost:6006/ to test your changes

## Package Management

### Adding Dependencies
```bash
# Add to specific workspace
cd code/frameworks/react-vite && yarn add <package>

# Add to root workspace
yarn add <package> -W
```

### Building Specific Packages
```bash
# Build specific package (run from code/ directory)
cd code && yarn build <package-name>
```

## Testing Strategy

### Unit Tests
```bash
cd code && yarn test
# Run specific test suites as needed
```

### Visual Testing
- Use Storybook UI for visual regression testing
- Chromatic integration available for visual reviews

### End-to-End Testing
- Playwright tests available (version 1.56.1 configured)
- E2E test tasks: `yarn task --task e2e-tests-build` or `yarn task --task e2e-tests-dev`
- Test runner scenarios: `yarn task --task test-runner-build` or `yarn task --task test-runner-dev`
- Smoke tests: `yarn task --task smoke-test`

### Watch Mode Commands
```bash
# Watch mode for unit tests
cd code && yarn test:watch

# Watch mode for affected tests only
yarn affected:test

# Storybook UI vitest watch mode
cd code && yarn storybook:vitest
```

## Troubleshooting

### Common Issues
1. **Build Failures**: Often resolved by running `yarn i` followed by `yarn task --task compile`
2. **Port Conflicts**: Storybook UI uses port 6006 by default
3. **Memory Issues**: Large compilation tasks may require increased Node.js memory limits
4. **Environment-Specific Issues**: Sandbox generation may occasionally fail due to dependency conflicts - use Storybook UI for testing as fallback
5. **Sandbox Directory Confusion**: Use root `sandbox/` directory for generated sandboxes, not `code/sandbox/`

### Debug Information
- Storybook logs available in generated sandbox directories
- Use `--debug` flag with CLI commands for verbose output
- Check `.cache/` directories for build artifacts

## Performance Tips

1. **Incremental Builds**: Use compilation cache when possible
2. **Selective Building**: Build only changed packages during development
3. **Memory Management**: Monitor memory usage during large operations
4. **Parallel Processing**: Yarn commands use parallel processing by default

## Contributing Guidelines

### Code Style
- ESLint and Prettier configurations are enforced
- TypeScript strict mode is enabled
- Follow existing patterns in the codebase

### Code Quality Checks
After making file changes, always run both formatting and linting checks:
1. **Prettier**: Format code with `yarn prettier --write <file>`
2. **ESLint**: Check for linting issues with `yarn lint:js:cmd <file>`
   - The full eslint command is: `cross-env NODE_ENV=production eslint --cache --cache-location=../.cache/eslint --ext .js,.jsx,.json,.html,.ts,.tsx,.mjs --report-unused-disable-directives`
   - Use the `lint:js:cmd` script for convenience
   - Fix any errors or warnings before committing

### Testing Guidelines
When writing unit tests:
1. **Export functions for testing**: If functions need to be tested, export them from the module
2. **Write meaningful tests**: Tests should actually import and call the functions being tested, not just verify syntax patterns
3. **Use coverage reports**: Run tests with coverage to identify untested code
   - Run coverage: `yarn vitest run --coverage <test-file>`
   - Aim for high coverage of business logic (75%+ for statements/lines)
   - Use coverage reports to identify missing test cases
   - Focus on covering:
     - All branches and conditions
     - Edge cases and error paths
     - Different input variations
4. **Mock external dependencies**: Use `vi.mock()` to mock file system, loggers, and other external dependencies
5. **Run tests before committing**: Ensure all tests pass with `yarn test` or `yarn vitest run`

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

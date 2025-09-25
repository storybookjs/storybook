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
- `sandbox` - Sandbox creation (fails due to API limits)
- `serve` - Static serving
- `smoke-test` - Basic functionality tests
- `sync-docs` - Documentation synchronization
- `test-runner-build` - Test runner for built Storybook
- `test-runner-dev` - Test runner for dev server
- `vitest-test` - Vitest integration tests

### Known Issues
1. **GitHub API Rate Limiting**: Sandbox creation fails with 403 Forbidden errors due to GitHub API limits in CI environments
   ```bash
   # This will fail in CI environments:
   yarn task --task sandbox --template react-vite/default-ts
   ```

2. **Dependency Warnings**: The build process shows many peer dependency warnings, but these are expected and don't prevent successful builds

3. **Large Build Times**: Most build operations take several minutes - always use appropriate timeouts

4. **Sandbox Generation**: Currently unreliable in CI environments - use Storybook UI for testing changes instead

## Recommended Development Workflow

### For Code Changes
1. Install dependencies: `yarn i` (if needed)
2. Compile packages: `yarn task --task compile`
3. Make your changes
4. Compile packages with `cd code && yarn task --task compile`
5. Test changes with: `cd code && yarn storybook:ui:build`
6. Run relevant tests: `cd code && yarn test`

### For Testing UI Changes
1. Generate a sandbox with: `yarn task --task sandbox --template [framework-template]` (may fail due to API limits)
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
Sandboxes are test environments that allow you to test Storybook changes with different framework combinations. **Note**: Sandbox creation currently fails in CI environments due to GitHub API rate limits.

```bash
# Generate a new sandbox (run from repository root)
yarn task --task sandbox --template react-vite/default-ts
# Creates: sandbox/react-vite-default-ts/
# Note: This will fail in CI with 403 Forbidden due to GitHub API limits
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
- **GitHub API Rate Limiting**: Sandbox creation fails with 403 Forbidden errors due to GitHub API limits in CI environments
- **Workaround**: For testing changes, you may need to work directly with the Storybook UI instead of generating new sandboxes
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
- Playwright tests available (version 1.52.0 configured)
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
4. **API Rate Limits**: Sandbox generation fails in CI - use Storybook UI for testing instead
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

### Git Workflow
- Work on feature branches
- Ensure all builds and tests pass before submitting PRs
- Include relevant documentation updates

### Documentation
- Update relevant README files for significant changes
- Include code examples in addon/framework documentation
- Update migration guides for breaking changes

This document should be updated as the repository evolves and new build requirements or limitations are discovered.
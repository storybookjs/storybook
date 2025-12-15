# Project Structure

## Repository Layout

This is a monorepo with the main codebase in the `code/` directory and supporting files at the root level.

```ascii
storybook/
├── code/                   # Main codebase (Nx workspace)
│   ├── addons/             # Storybook addons (a11y, docs, jest, etc.)
│   ├── builders/           # Build system integrations
│   ├── core/               # Core Storybook UI and API
│   ├── frameworks/         # Framework-specific implementations
│   ├── lib/                # CLI tools and utilities
│   ├── presets/            # Configuration presets
│   ├── renderers/          # Framework renderers
│   └── sandbox/            # Development sandboxes
├── docs/                   # Documentation source files
├── scripts/                # Build and automation scripts
├── test-storybooks/        # Integration test projects
└── sandbox/                # Generated sandbox environments
```

## Code Organization

### Core Packages (`code/`)

- **`core/`**: Main Storybook application (manager UI, preview, server)
- **`addons/`**: Official addons (a11y, docs, jest, links, etc.)
- **`frameworks/`**: Framework-specific integrations (angular, nextjs, sveltekit), usually a combination of a renderer and a builder
- **`renderers/`**: Pure framework renderers (react, vue3, svelte)
- **`builders/`**: Build tool integrations (vite, webpack5)
- **`lib/`**: Utilities and CLI tools (cli-sb, codemod, create-storybook)
- **`presets/`**: Webpack configuration presets for popular setups

### Package Naming Conventions

- Renderer packages: `@storybook/{renderer}` (e.g., `@storybook/react`)
- Framework + builder: `@storybook/{renderer}-{builder}` OR `@storybook/{framework}` (e.g., `@storybook/react-vite`, `@storybook/sveltekit`)
- Addons: `@storybook/addon-{name}` (e.g., `@storybook/addon-docs`)
- Builders: `@storybook/builder-{name}` (e.g., `@storybook/builder-vite`)
- Presets: `@storybook/preset-{name}` (e.g., `@storybook/preset-create-react-app`)

## File Conventions

### TypeScript Configuration

- Strict TypeScript with `noImplicitAny: true`
- Module resolution: `bundler` mode
- Target: `ES2020`
- JSX: `preserve` mode

### Code Style

- **Prettier**: 100 character line width, single quotes, trailing commas
- **Import Order**: Node modules → testing → React → Storybook internal → third-party → relative
- **File Extensions**: Prefer `.ts`/`.tsx` over `.js`/`.jsx`
- **Naming**: Use kebab-case for files, PascalCase for components

### Testing Structure

- **Unit Tests**: `*.test.ts` files alongside source code
- **E2E Tests**: `code/e2e-tests/` directory with Playwright
- **Stories**: `*.stories.ts` files for component examples
- **Mocks**: `__mocks__/` directories for test fixtures

### Documentation

- **API Docs**: JSDoc comments with TSDoc format
- **README**: Each package should have comprehensive README
- **Stories**: Use Component Story Format (CSF) 3.0
- **Migration Guides**: Document breaking changes

## Development Patterns

### Monorepo Workflow

1. All development happens in `code/` directory
2. Use `yarn build --watch` for active development
3. Nx handles dependency graph and caching
4. All packages are versioned and released together

### Package Dependencies

- **Internal**: Use `workspace:*` for internal package references
- **Peer Dependencies**: Framework packages are peer dependencies
- **Dev Dependencies**: Testing and build tools in root package.json

### Build Outputs

- **`dist/`**: Compiled JavaScript and type definitions
- **`template/`**: Framework-specific template files
- **`*.d.ts`**: TypeScript declaration files

### Sandbox Development

- Use `yarn start` for quick React TypeScript sandbox
- Use `yarn task` for custom framework/template selection
- Sandboxes are generated in `sandbox/` directory
- Link mode connects to local packages for development

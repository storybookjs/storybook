# Technology Stack

## Build System & Package Management

- **Monorepo**: Managed with Nx for build orchestration and caching
- **Package Manager**: Yarn 4 with workspaces
- **Node.js**: Version 22+ (specified in .nvmrc)
- **Build Tool**: Custom build scripts with esbuild and Vite integration

## Core Technologies

- **TypeScript**: Primary language with strict configuration
- **React**: Main UI framework for Storybook's own interface
- **Vite**: Build tool and dev server for modern frameworks
- **Webpack 5**: Alternative bundler support
- **ESBuild**: Fast JavaScript bundler and minifier

## Testing & Quality

- **Vitest**: Primary test runner with coverage via Istanbul
- **Playwright**: End-to-end testing framework
- **ESLint**: Code linting with extensive custom rules
- **Prettier**: Code formatting with custom plugins
- **Chromatic**: Visual testing and review

## Development Workflow

- **Hot Module Reloading**: Fast development feedback
- **Watch Mode**: Automatic rebuilds during development
- **Parallel Builds**: Nx orchestrates parallel package builds
- **Caching**: Aggressive build and test caching via Nx

## Common Commands

### Development

```bash
# Start development environment with React TypeScript sandbox
yarn start

# Start with custom template selection
yarn task

# Build specific packages in watch mode
cd code && yarn build --watch <package-names>

# Run Storybook UI development server
yarn storybook:ui

# Create a standalone sandbox to develop against a specific framework
yarn task --task sandbox
```

### Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run specific package tests
yarn nx test <package-name>

# Run E2E tests
yarn playwright test
```

### Building

```bash
# Build all packages
yarn build

# Build in production mode (required for Angular)
yarn build --prod

# Build with watch mode
yarn build --watch

# Build specific packages
yarn build <package-1> <package-2>
```

### Linting & Formatting

```bash
# Lint JavaScript/TypeScript
yarn lint:js

# Lint markdown and code samples
yarn lint:md

# Auto-fix linting issues
yarn lint:js --fix

# Format code with Prettier
yarn lint:prettier
```

## Framework Support

Storybook supports multiple frontend frameworks through dedicated packages:

- React (react, react-vite, react-webpack5)
- Angular (angular)
- Vue (vue3, vue3-vite)
- Svelte (svelte, svelte-vite, sveltekit)
- Web Components (web-components, web-components-vite)
- HTML (html, html-vite)
- Preact (preact, preact-vite)
- Next.js (nextjs, nextjs-vite)

# Suggested Commands

## Installation
```bash
yarn install          # Install all dependencies (from repo root)
```

## Building
```bash
# Compile a single package (always use --no-cloud to avoid NX Cloud issues)
yarn nx compile core --no-cloud
yarn nx compile @storybook/react --no-cloud

# Compile all packages
yarn nx run-many -t compile --no-cloud

# Production build of a package
cd code && yarn build
```

## Testing
```bash
# Run all unit tests (from repo root or code/)
cd code && yarn test
# or from root:
yarn test

# Run tests in watch mode
cd code && yarn test:watch

# Run specific test file
cd code && yarn test:watch -- --project <project> <test-pattern>

# E2E tests (Playwright)
cd code && npx playwright test
```

## Linting & Formatting
```bash
# Run all linting
cd code && yarn lint

# Lint JS/TS only
cd code && yarn lint:js

# Format with Prettier
cd code && yarn lint:prettier '**/*.{css,html,json,md,yml}'

# Run knip (unused code detection)
cd code && yarn knip
```

## Running the Internal Dev Storybook
```bash
# Must compile core first!
yarn nx compile core --no-cloud

# Then start the dev server (from code/ dir)
cd code && yarn storybook:ui

# Or with --ci flag (no interactive):
cd code && yarn storybook:ui --ci

# Build static storybook
cd code && yarn storybook:ui:build
```

## Sandbox / Task System
```bash
# Start a sandbox with a specific template
yarn start  # defaults to react-vite/default-ts

# Run a task with a specific template
yarn task --task dev --template react-vite/default-ts --start-from=install
```

## NX Commands
```bash
# Always use --no-cloud flag!
yarn nx compile <package> --no-cloud
yarn nx run-many -t compile --no-cloud
yarn nx show projects --affected
```

## Git
```bash
git status
git diff
git log --oneline -10
git checkout next   # main branch is "next"
```

## System Utilities (macOS/Darwin)
```bash
ls, cd, pwd, cat, head, tail
grep, find, xargs
curl, wget
python3, node
open <file>  # open in default app
pbcopy, pbpaste  # clipboard
```

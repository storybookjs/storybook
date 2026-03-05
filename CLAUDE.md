# GitHub Copilot Instructions for Storybook

## Repository Structure

```text
storybook/                        # Yarn monorepo root
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

## Essential Commands

### Compilation

```bash
yarn nx run-many -t compile
yarn nx compile <package-name>
```

### Type Checking

```bash
yarn nx run-many -t check -c production
```

### Development Server

```bash
cd code && yarn storybook:ui        # http://localhost:6006/
cd code && yarn storybook:ui:build  # Build for production
```

### Testing

```bash
cd code && yarn test
cd code && yarn test:watch
cd code && yarn storybook:vitest
```

## Commands to Avoid

- **DO NOT RUN**: `yarn task dev` or `yarn start` (runs indefinitely)

## Sandbox Location

Generated at `../storybook-sandboxes/` outside repo

## Sandbox Environments

```bash
yarn nx sandbox <template> -c production  # Creates ../storybook-sandboxes/<template>/
```

## Troubleshooting

- Storybook logs available in generated sandbox directories
- Use `--debug` flag with CLI commands for verbose output

## Code Quality & Testing

Format and lint before committing. Do not lint in-between, but only at the end:

```bash
yarn prettier --write <file>
yarn --cwd code lint:js:cmd <file> --fix
cd code && yarn test
```

**Testing:** Export tested functions, mock external dependencies, aim for 75%+ coverage, run `yarn vitest run --coverage <test-file>`

**Logging:** Use `logger` from `storybook/internal/node-logger` (Node.js) or `storybook/internal/client-logger` (browser). Never use `console.log` directly.

## Bug Verification Workflows

When fixing bugs in Storybook, follow the workflow defined in `.claude/skills/fix-bug/SKILL.md`. Read that file and follow every step in order. Each step will direct you to read additional skill files — always read them before executing their steps.

The skill files live in `.claude/skills/` and cover the full workflow:

| Skill file | Purpose |
|---|---|
| `.claude/skills/fix-bug/SKILL.md` | **Entry point** — orchestrates the full workflow |
| `.claude/skills/plan-bug-fix/SKILL.md` | Fetch issue, determine flow (0–4), create plan, create branch |
| `.claude/skills/implement-and-verify-fix/SKILL.md` | Implement fix, run tests, lint, commit, run verification |
| `.claude/skills/verification-checklist/SKILL.md` | Universal pre-PR checklist |
| `.claude/skills/renderer-bug-workflow/SKILL.md` | Flow 1: renderer visual verification |
| `.claude/skills/builder-bug-workflow/SKILL.md` | Flow 2 & 3: builder verification |
| `.claude/skills/manager-bug-workflow/SKILL.md` | Flow 4: Manager UI E2E verification |
| `.claude/skills/open-pull-request/SKILL.md` | Prepare and open the PR |

**When to use**:

- Fixing bugs from GitHub issues
- Need automated end-to-end bug fix workflow

**When NOT to use**:

- Feature requests or enhancements (not bugs)
- Documentation-only changes
- Exploratory investigation

## Custom GitHub Copilot Agent

For GitHub.com Copilot coding agent, a specialized custom agent is available at `.github/copilot/agents/storybook-bug-fixer.agent.md`. Assign issues to `@storybook-bug-fixer` and it will read and follow the `.claude/skills/` workflow files end-to-end.

---
name: storybook-troubleshooting
description: Use when encountering build failures, sandbox path issues, port conflicts, or other problems in the Storybook monorepo
---

# Storybook Troubleshooting

## Common Fixes

- Build failures are often fixed by rerunning `yarn` and `yarn nx run-many -t compile`
- Storybook UI uses port `6006` by default
- Large compiles may require more Node.js memory
- Sandbox paths are `../storybook-sandboxes/`, not `./sandbox` or `code/sandbox/`
- Use `--debug` for verbose CLI output
- Check generated sandbox directories and `.cache/` for build artifacts

## Environment Variables

| Variable                      | Purpose                     |
| ----------------------------- | --------------------------- |
| `IN_STORYBOOK_SANDBOX`        | Set during sandbox creation |
| `STORYBOOK_DISABLE_TELEMETRY` | Disable telemetry           |
| `STORYBOOK_TELEMETRY_DEBUG`   | Log telemetry events        |
| `DEBUG`                       | Enable debug logging        |

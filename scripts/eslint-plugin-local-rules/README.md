## ESLint plugin local rules

This package serves as a local ESLint plugin to be used in the monorepo and help maintainers keep certain code standards.

### Development

If you're fixing a rule or creating a new one, make sure to:

1. Make your code changes
2. No reinstall is needed: oxlint loads `index.js` by path through the `jsPlugins` entry in `code/.oxlintrc.json`
3. Enable a new rule in `code/.oxlintrc.json` (`local-rules/<name>`)
4. Restart the oxc language server in your IDE

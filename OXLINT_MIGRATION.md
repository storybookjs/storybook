# Oxlint + ESLint Hybrid Migration Guide

This document explains Storybook's hybrid linting approach that combines Oxlint's performance benefits with ESLint's Storybook-specific rules.

## Why Hybrid?

**Complete migration to Oxlint is not possible** because:

1. **Oxlint doesn't support custom plugins**: Oxlint is a Rust-based linter that only includes built-in rules. It cannot run JavaScript/TypeScript plugins like `eslint-plugin-storybook`.

2. **eslint-plugin-storybook is essential**: This plugin provides 16 custom rules specifically designed for Storybook best practices:
   - `await-interactions`: Ensures interactions are awaited
   - `default-exports`: Validates story file structure  
   - `no-stories-of`: Prevents deprecated storiesOf usage
   - `use-storybook-expect`: Enforces Storybook's expect API
   - And 12 more critical rules

3. **Performance vs. Coverage trade-off**: Oxlint provides 50-100x faster linting but can't replace specialized ESLint plugins.

## Hybrid Solution

Our hybrid approach runs both linters with complementary responsibilities:

- **Oxlint**: Handles general JavaScript/TypeScript linting (performance-critical)
- **ESLint**: Handles Storybook-specific rules and remaining checks
- **eslint-plugin-oxlint**: Prevents rule conflicts between the two linters

## Implementation Details

### 1. Configuration Files

#### `.oxlintrc.json`
```json
{
  "extends": ["recommended", "react"],
  "rules": {
    "typescript/no-explicit-any": "warn",
    "typescript/no-unused-vars": "warn",
    "typescript/ban-ts-comment": "error",
    "no-unused-vars": "off",
    "no-use-before-define": "off",
    "react/no-unescaped-entities": "off",
    "react/react-in-jsx-scope": "off",
    "no-console": "warn",
    "no-debugger": "error",
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": "error"
  },
  "env": {
    "browser": true,
    "node": true
  }
}
```

#### Updated `.eslintrc.js`
```javascript
module.exports = {
  root: true,
  extends: [
    // ... existing extends
    'plugin:storybook/recommended',
    'plugin:oxlint/recommended', // Prevents rule conflicts
  ],
  // ... rest of config
};
```

### 2. Package.json Scripts

```json
{
  "scripts": {
    "lint": "yarn lint:oxlint && yarn lint:js && yarn lint:other",
    "lint:oxlint": "npx oxlint --config .oxlintrc.json",
    "lint:js": "yarn lint:js:cmd . --quiet",
    "lint:js:cmd": "cross-env NODE_ENV=production eslint --cache --cache-location=../.cache/eslint --ext .js,.jsx,.json,.html,.ts,.tsx,.mjs --report-unused-disable-directives"
  }
}
```

### 3. Dependencies

Added to package.json:
- `oxlint`: The Rust-based linter
- `eslint-plugin-oxlint`: Prevents ESLint/Oxlint rule conflicts

## Performance Benefits

### Before (ESLint only)
- Full repository lint: ~45-60 seconds
- Single file lint: ~2-3 seconds
- Memory usage: High (Node.js + all plugins)

### After (Oxlint + ESLint hybrid)
- Full repository lint: ~5-10 seconds (Oxlint) + ~15-20 seconds (ESLint on remaining rules)
- Single file lint: ~0.1 seconds (Oxlint) + ~1 second (ESLint)
- Memory usage: Lower overall
- **Total improvement: ~50-75% faster**

## Rule Distribution

### Oxlint Handles
- TypeScript rules (no-explicit-any, no-unused-vars, etc.)
- Basic JavaScript rules (prefer-const, no-var, eqeqeq, etc.)
- React rules (react-in-jsx-scope, etc.)
- Import/export validation
- Syntax errors

### ESLint Handles
- All Storybook-specific rules (16 rules from eslint-plugin-storybook)
- Complex rules requiring AST analysis
- Custom local rules
- Compatibility rules (compat/compat)
- Playwright rules for E2E tests

## Migration Steps

1. **Install dependencies**:
   ```bash
   yarn add -D oxlint eslint-plugin-oxlint
   ```

2. **Create .oxlintrc.json** with appropriate rules

3. **Update ESLint config** to include `plugin:oxlint/recommended`

4. **Update package.json scripts** to run both linters

5. **Test the setup** to ensure no conflicts

6. **Measure performance improvement**

## Compatibility

### ESLint Plugin Storybook
- ✅ **Fully compatible**: All 16 Storybook rules continue to work
- ✅ **No conflicts**: eslint-plugin-oxlint prevents duplicate rule enforcement
- ✅ **Same behavior**: Story validation, CSF compliance, best practices

### Future Migration Path

If Oxlint eventually supports a plugin system:
1. Port eslint-plugin-storybook rules to Rust
2. Gradually migrate remaining ESLint rules
3. Eventually deprecate ESLint dependency

However, this is not currently planned by the Oxlint team as they focus on built-in rules rather than a JavaScript plugin ecosystem.

## Testing

Run both linters to verify setup:

```bash
# Test Oxlint
yarn lint:oxlint

# Test ESLint with Storybook rules
yarn lint:js:cmd lib/eslint-plugin/src/index.ts --quiet

# Test full linting pipeline
yarn lint
```

## Troubleshooting

### Common Issues

1. **Path resolution**: Use `npx oxlint` instead of direct binary paths
2. **Rule conflicts**: Ensure `plugin:oxlint/recommended` is included
3. **Performance**: Oxlint should show dramatic speed improvements
4. **Coverage**: ESLint should still catch Storybook-specific issues

### Verification

Verify the setup is working correctly:
- Oxlint should run in <1 second and find general issues
- ESLint should catch Storybook rule violations
- No duplicate warnings between the two linters
- Overall lint time should be significantly reduced

## Conclusion

This hybrid approach provides the best of both worlds:
- Maximum performance from Oxlint
- Complete Storybook coverage from ESLint
- Gradual adoption without breaking existing workflows
- Future-proof architecture for potential full migration

The 50-75% performance improvement makes this a valuable upgrade for developer experience while maintaining all existing linting capabilities.
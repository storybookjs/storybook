# Fix for PNPM Monorepo Detection Issue

## Problem
The Storybook codebase was not correctly identifying pnpm monorepos. The existing logic only checked for `package.json` files with a `"workspaces"` property, but pnpm uses a `pnpm-workspace.yaml` file instead to define workspaces.

## Solution
Added support for detecting `pnpm-workspace.yaml` files in two key locations:

### 1. JsPackageManager.isStorybookInMonorepo() method
**File**: `code/core/src/common/js-package-manager/JsPackageManager.ts`

**Changes**:
- Added `pnpm-workspace.yaml` detection using `findUpSync()` similar to other monorepo config files
- Added the check to the conditional logic that returns `true` when any monorepo indicator is found

```typescript
const pnpmWorkspaceYamlPath = findUpSync(`pnpm-workspace.yaml`, { stopAt: getProjectRoot() });

if (turboJsonPath || rushJsonPath || nxJsonPath || pnpmWorkspaceYamlPath) {
  return true;
}
```

### 2. Telemetry monorepo detection
**File**: `code/core/src/telemetry/get-monorepo-type.ts`

**Changes**:
- Added `Pnpm: 'pnpm-workspace.yaml'` to the `monorepoConfigs` object
- This ensures telemetry correctly identifies pnpm monorepos for analytics

```typescript
export const monorepoConfigs = {
  Nx: 'nx.json',
  Turborepo: 'turbo.json',
  Lerna: 'lerna.json',
  Rush: 'rush.json',
  Lage: 'lage.config.json',
  Pnpm: 'pnpm-workspace.yaml',
} as const;
```

## Testing
- All existing tests continue to pass
- The telemetry tests now include a test for pnpm-workspace.yaml detection
- The changes maintain backward compatibility

## Impact
- Storybook now correctly identifies pnpm monorepos
- Consistent behavior across different monorepo configurations
- Improved telemetry data collection for pnpm workspaces
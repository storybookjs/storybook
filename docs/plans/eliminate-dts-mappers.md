# Plan: Eliminate DTS Mapper Files Using TypeScript Configuration

## Current Situation

The codebase uses a custom DTS mapper file mechanism to enable parallel compilation of type definitions across multiple entrypoints and packages. The mapper files are generated in `dist/` directories and re-export types from source files in `src/` directories.

### Current Flow
1. **Type Mapper Generation** (`generate-type-mappers.ts`): Creates `.d.ts` files in `dist/` that re-export from source files
2. **Parallel DTS Compilation** (`generate-types.ts`): Uses these mapper files to compile type definitions in parallel
3. **DTS Processing** (`dts-process.ts`): Uses `rollup-plugin-dts` to generate final `.d.ts` files

### Problem
- Custom mapper infrastructure adds complexity
- Mapper files need to be generated before type compilation
- Maintenance overhead for mapper generation logic

## Research Findings

Based on TypeScript's native capabilities, there are several approaches to eliminate mapper files:

### Option 0: Use `customConditions` in tsconfig.json (Perfect Solution!) ⭐⭐⭐

**How it works:**
- Add a custom condition (e.g., `"source"` or `"development"`) to your `package.json` exports pointing to source files
- Configure TypeScript's `customConditions` compiler option to recognize this condition
- TypeScript will prefer the custom condition over `"types"` when resolving imports
- When publishing, only `dist/` is published, so consumers fall back to `"types"` or `"default"` conditions

**Example package.json:**
```json
{
  "exports": {
    "./actions": {
      "source": "./src/actions/index.ts",        // Custom condition for development
      "types": "./dist/actions/index.d.ts",     // For consumers
      "default": "./dist/actions/index.js"       // Runtime for consumers
    }
  }
}
```

**Example tsconfig.json:**
```json
{
  "compilerOptions": {
    "customConditions": ["source"]
  }
}
```

**How it solves the problem:**
- **During development**: TypeScript resolves using `"source"` condition → `./src/actions/index.ts` (source files)
- **When published**: Only `dist/` is published, consumers use `"types"` → `./dist/actions/index.d.ts`
- **No mapper files needed**: TypeScript directly reads source files during compilation
- **Parallel compilation works**: Each entrypoint can compile independently using source files
- **Declarative**: The condition is part of the package.json exports structure

**Pros:**
- ✅ **Exactly what you suggested!** - Custom condition in package.json exports
- ✅ No custom mapper files needed
- ✅ No file generation step required
- ✅ Declarative in package.json (standard exports structure)
- ✅ TypeScript natively supports this via `customConditions` ([docs](https://www.typescriptlang.org/tsconfig/#customConditions))
- ✅ Clean separation: dev uses source via custom condition, published uses dist via standard conditions
- ✅ Maintains parallel compilation capability
- ✅ No path configuration needed - works with existing package.json exports

**Cons:**
- Requires updating package.json generation to include the custom condition
- Need to ensure the custom condition name is consistent across packages

**This is the perfect solution - exactly what you had in mind!**

### Option 1: Use `paths` in tsconfig.json (Alternative, but less elegant)

**How it works:**
- Configure `paths` in `tsconfig.json` to map package imports to source files
- TypeScript's `paths` configuration takes **precedence** over `package.json` exports during development
- `package.json` exports still point to `dist/` for publishing (consumers don't have your tsconfig.json)

**Pros:**
- Works without modifying package.json exports
- TypeScript natively supports this

**Cons:**
- Less declarative (paths in tsconfig vs conditions in package.json)
- Requires configuring paths for all packages/entrypoints
- Paths need to match import patterns exactly

**Note**: `customConditions` (Option 0) is preferred as it's more declarative and aligns with package.json exports structure.

### Option 2: Use `declarationMap` (Complementary Enhancement)
**How it works:**
- TypeScript can generate `.d.ts.map` files that map declaration files back to source files
- IDEs and TypeScript can use these maps to resolve types directly from source
- Works with `rollup-plugin-dts` when properly configured

**Pros:**
- Native TypeScript feature
- No custom mapper files needed
- Better IDE experience (Go to Definition goes to source)
- Maintains parallel compilation capability

**Cons:**
- Requires `rollup-plugin-dts` to support/support declarationMap properly
- May need to verify compatibility with current rollup setup

### Option 3: Use `customConditions` + `declarationMap` (Best of Both Worlds)
**How it works:**
- Use `customConditions` for development-time type resolution (as in Option 0)
- Enable `declarationMap` for better IDE experience and source mapping
- Combines the benefits of both approaches

**Pros:**
- All benefits of Option 0 (customConditions)
- Plus: Better IDE "Go to Definition" experience
- Plus: Declaration maps point back to source files

**Cons:**
- Requires both configurations
- Need to verify rollup-plugin-dts supports declarationMap

### Option 4: Use `rootDirs` for Virtual Directory Merging
**How it works:**
- Configure `rootDirs` to treat `src/` and `dist/` as virtual siblings
- TypeScript resolves imports as if they're in the same location
- Allows relative imports to work across virtual directories

**Pros:**
- Native TypeScript feature
- Handles complex directory structures
- Good for monorepos

**Cons:**
- May be complex to configure correctly
- Less commonly used, so less documentation/examples

### Option 4: Hybrid Approach - `declarationMap` + `paths`
**How it works:**
- Enable `declarationMap` for source mapping
- Use `paths` for module resolution during compilation
- Best of both worlds

**Pros:**
- Most robust solution
- Handles both compilation and IDE experience
- Future-proof

**Cons:**
- More configuration needed
- Need to verify rollup-plugin-dts compatibility

## Recommended Implementation Plan

### Phase 0: Use `customConditions` for Source Resolution (Perfect Solution!) ⭐⭐⭐

This is exactly what you suggested - using a custom condition in package.json exports:

1. **Choose a condition name**:
   - Suggested: `"source"` or `"development"` or `"types-source"`
   - This will be the custom condition name used across all packages

2. **Update `generate-package-json.ts`**:
   - Modify the export generation to include the custom condition pointing to source files
   - Add the custom condition before `"types"` so TypeScript prefers it
   ```typescript
   pkgJson.exports[exportEntry] = {
     source: entryPoint,  // Custom condition → source file
     types: dtsPath,      // Standard condition → dist d.ts
     default: jsPath,     // Runtime → dist js
   };
   ```

3. **Update root `code/tsconfig.json`**:
   ```json
   {
     "compilerOptions": {
       "customConditions": ["source"]
     }
   }
   ```

4. **Test with one package**:
   - Pick a simple package
   - Generate package.json with custom condition
   - Verify TypeScript resolves to source files using the condition
   - Check that type checking works correctly

5. **Expand to all packages**:
   - Update package.json generation for all packages
   - Test parallel compilation still works
   - Verify no type errors introduced

6. **Verify publishing still works**:
   - Ensure only `dist/` is published (not `src/`)
   - Test that consumers (without `customConditions` config) resolve correctly
   - Consumers will use `"types"` condition (standard fallback)

**Key Insight**: TypeScript's `customConditions` tells it to prefer your custom condition:
- **Dev**: Uses `"source"` condition → resolves to `src/`
- **Published**: Consumers use `"types"` condition → resolves to `dist/`

This eliminates the need for mapper files entirely and is exactly what you had in mind!

### Phase 1: Enable `declarationMap` (Complementary Enhancement)

1. **Update `dts-process.ts`**:
   - Change `declarationMap: false` to `declarationMap: true`
   - Verify `rollup-plugin-dts` generates `.d.ts.map` files

2. **Test with one package**:
   - Pick a simple package/entrypoint
   - Generate types with declarationMap enabled
   - Verify `.d.ts.map` files are created
   - Test IDE "Go to Definition" behavior

3. **Verify parallel compilation still works**:
   - Run full build
   - Ensure no regressions in build time or correctness

### Phase 2: Remove Mapper Generation (After Phase 0 is Verified)

### Phase 3: Optimization and Cleanup

1. **Verify build performance**:
   - Compare build times before/after
   - Ensure parallel compilation still works efficiently

2. **Update documentation**:
   - Document new TypeScript configuration approach
   - Update contributor guides

3. **Clean up**:
   - Remove unused mapper-related code
   - Simplify build scripts

## Implementation Details

### Changes Required

#### 1. `scripts/build/utils/dts-process.ts`
```typescript
// Change line 43:
declarationMap: true,  // Instead of false
```

#### 2. `scripts/utils/tools.ts`
```typescript
// Change line 56:
declarationMap: true,  // Instead of false
```

#### 3. Update `scripts/build/utils/generate-package-json.ts` (Primary Change)
```typescript
// Add custom condition to exports
if (entry.dts === undefined) {
  pkgJson.exports[exportEntry] = {
    source: entryPoint,  // Custom condition → source file (for development)
    types: dtsPath,      // Standard condition → dist d.ts (for consumers)
    default: jsPath,     // Runtime → dist js
  };
}
```

#### 4. Root `code/tsconfig.json` (Primary Change)
```json
{
  "compilerOptions": {
    // ... existing options ...
    "customConditions": ["source"],  // Tell TypeScript to use our custom condition
    "declarationMap": true  // Optional: for better IDE experience
  }
}
```

**Key Point**: The `customConditions` configuration tells TypeScript to prefer the `"source"` condition in package.json exports during development. When packages are published, consumers (without this config) will use the standard `"types"` condition, so publishing still works correctly.

#### 4. Package-level `tsconfig.json` files
- Add `declarationMap: true` if not already present
- Configure `paths` for package-specific imports

#### 5. `scripts/build/build-package.ts`
- Make mapper generation conditional (feature flag)
- Eventually remove mapper generation entirely

## Testing Strategy

1. **Unit Tests**:
   - Test type generation for each entrypoint
   - Verify `.d.ts.map` files are created correctly

2. **Integration Tests**:
   - Build all packages
   - Verify no type errors
   - Check that generated types are correct

3. **IDE Testing**:
   - Test "Go to Definition" in VS Code/other IDEs
   - Verify it navigates to source files, not dist files
   - Test IntelliSense/autocomplete

4. **Performance Testing**:
   - Measure build times
   - Compare before/after
   - Ensure parallel compilation still works

## Risks and Mitigations

### Risk 1: `rollup-plugin-dts` doesn't support `declarationMap` properly
**Mitigation**: Test early, check plugin documentation, consider alternatives if needed

### Risk 2: Path configuration breaks existing imports
**Mitigation**: Start with minimal paths, test incrementally, keep mapper generation as fallback

### Risk 3: Parallel compilation breaks
**Mitigation**: Keep mapper generation code until fully verified, use feature flags

### Risk 4: Build performance degrades
**Mitigation**: Benchmark before/after, optimize paths configuration if needed

## Success Criteria

1. ✅ No mapper files generated in `dist/` directories
2. ✅ Type definitions still generated correctly
3. ✅ Parallel compilation still works
4. ✅ IDE "Go to Definition" navigates to source files
5. ✅ Build performance maintained or improved
6. ✅ No breaking changes for consumers

## Timeline Estimate

- **Phase 0** (customConditions): 1-2 days ⭐⭐⭐ Primary solution (exactly what you suggested!)
- **Phase 1** (declarationMap): 1 day (optional enhancement)
- **Phase 2** (remove mappers): 1 day
- **Phase 3** (optimization): 1 day

**Total**: ~3-5 days with testing and iteration

**Note**: Phase 0 is the primary solution that eliminates mapper files using `customConditions` - exactly what you had in mind!

## References

- [TypeScript: customConditions](https://www.typescriptlang.org/tsconfig/#customConditions) ⭐ **Primary solution**
- [TypeScript: declarationMap](https://www.typescriptlang.org/tsconfig/declarationMap.html)
- [TypeScript: paths](https://www.typescriptlang.org/tsconfig/paths.html)
- [TypeScript: rootDirs](https://www.typescriptlang.org/tsconfig/rootDirs.html)
- [rollup-plugin-dts documentation](https://github.com/Swatinem/rollup-plugin-dts)

## Next Steps

1. Review and approve this plan
2. **Start with Phase 0** (`customConditions`) - this is exactly what you suggested!
3. Update `generate-package-json.ts` to add the custom condition to exports
4. Add `customConditions: ["source"]` to root `tsconfig.json`
5. Test thoroughly - verify TypeScript resolves to source files using the custom condition
6. Verify publishing still works - ensure consumers resolve to dist correctly (they'll use `"types"` condition)
7. Remove mapper generation code once verified
8. Optionally add Phase 1 (declarationMap) for enhanced IDE experience

## Why This Approach Works

**This is exactly what you suggested!** TypeScript's `customConditions` compiler option ([docs](https://www.typescriptlang.org/tsconfig/#customConditions)) allows you to:

- **Add a custom condition** (e.g., `"source"`) to your `package.json` exports pointing to source files
- **Configure TypeScript** to recognize and prefer this condition via `customConditions: ["source"]`
- **During development**: TypeScript uses `"source"` condition → resolves to `src/`
- **When published**: Consumers don't have `customConditions` config → use standard `"types"` condition → resolves to `dist/`

This gives you the exact "conditional" behavior you wanted, implemented via TypeScript's native `customConditions` feature. No mapper files needed!

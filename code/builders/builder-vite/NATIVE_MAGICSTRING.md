# Native MagicString Support in Storybook Vite Builder

## Overview

This document describes the native MagicString optimization implemented in the Storybook Vite builder plugins. This optimization allows plugins to leverage Rolldown's native Rust-based MagicString implementation when available, providing significant performance improvements for code transformations.

## What is Native MagicString?

Native MagicString is a Rust implementation of the popular MagicString library that enables:
- **Faster string operations** through Rust's memory safety and zero-cost abstractions
- **Background thread processing** for source map generation
- **Better memory efficiency** for large codebases
- **Seamless integration** with Rolldown's Rust-based architecture

## Implementation

### Affected Plugins

The following Vite plugins in the Storybook builder have been updated to support native MagicString:

1. **external-globals-plugin.ts** - Transforms imports to global variables
2. **inject-export-order-plugin.ts** - Injects export order information into story files
3. **strip-story-hmr-boundaries.ts** - Removes HMR boundaries from story files

### How It Works

Each plugin's transform handler now:
1. Accepts an optional `meta` parameter containing the native MagicString instance
2. Uses the native MagicString if available, otherwise falls back to the JavaScript implementation
3. Returns the appropriate format based on which implementation was used

### Code Example

```typescript
transform: {
  filter: { /* filter configuration */ },
  async handler(code: string, id: string, meta?: any) {
    // Use native MagicString if available (Rolldown optimization)
    const magicString = meta?.magicString;
    const s = magicString || new MagicString(code);
    
    // Perform transformations
    s.append('/* transformed */');
    
    return {
      code: magicString ? s : s.toString(),
      map: magicString ? undefined : s.generateMap()
    };
  }
}
```

## Benefits

### Performance Improvements

Based on Rolldown benchmarks, native MagicString provides:
- **1.15x to 1.33x** faster build times
- **1.63x to 2.26x** faster plugin transform times
- Greater improvements with larger codebases

### Backward Compatibility

The implementation maintains full backward compatibility:
- Works with regular Vite (uses JavaScript MagicString)
- Works with older Vite versions (< 6.3.0)
- Works with Rolldown (uses native MagicString when available)
- No configuration changes required

## Testing

Tests have been added to verify:
1. Native MagicString is used when available
2. Fallback to JavaScript MagicString works correctly
3. Both implementations produce the same results

Run tests with:
```bash
npx vitest run builders/builder-vite/src/plugins/native-magicstring.test.ts
```

## Future Considerations

### When Rolldown Becomes Available

When Rolldown is integrated with Storybook:
1. Add `experimental.nativeMagicString: true` to Rolldown config
2. Monitor performance improvements
3. Report any issues with the native implementation

### Migration Path

No migration needed - the plugins automatically detect and use native MagicString when available.

## Related Work

This implementation complements other optimizations:
- **Plugin hook filters** - Reduce unnecessary plugin invocations
- **Removed mocking utilities** - Simplified build pipeline
- **Vue3 renderer fixes** - Improved URL args handling

## References

- [Rolldown Native MagicString Documentation](https://rolldown.rs/guide/advanced/native-magic-string)
- [MagicString GitHub Repository](https://github.com/rich-harris/magic-string)
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)

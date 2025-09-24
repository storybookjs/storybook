## 🐛 Problem
The `useArgs` hook lost generic typing between Storybook versions 7.4.6 and 7.6.2, causing TypeScript to lose type inference for story arguments. This broke type safety for developers using `useArgs<MyInterface>()` in decorators and addons.

**Issue**: https://github.com/storybookjs/storybook/issues/25070

## 🔍 Root Cause
Multiple `useArgs` functions with different signatures across packages caused naming conflicts and type resolution issues.

## ✅ Solution

### 1. Enhanced Preview API useArgs
```typescript
export function useArgs<TArgs extends Args = Args>(): readonly [
  TArgs,
  (newArgs: Partial<TArgs>) => void,
  (argNames?: (keyof TArgs)[]) => void,
] {
  // ... implementation
  return [args as TArgs, updateArgs, resetArgs] as const;
}
```

**Key improvements:**
- ✅ `readonly` tuple type for better type inference
- ✅ `as const` assertion for literal types  
- ✅ Proper generic constraints and return types

### 2. Resolved naming conflicts in docs package
- Added `useDocsArgs` as the preferred export for docs blocks
- Kept `useArgs` for backward compatibility with deprecation warning

## 📝 Usage Examples

### Before (broken):
```typescript
const [args, updateArgs] = useArgs<MyArgs>();
// ❌ TypeScript lost type inference
```

### After (fixed):
```typescript
interface MyStoryArgs {
  name: string;
  age: number;
}

const [args, updateArgs, resetArgs] = useArgs<MyStoryArgs>();
// ✅ Fully typed access
const name: string = args.name;
// ✅ Type-safe updates  
updateArgs({ name: 'John', age: 30 });
// ✅ Type-safe resets
resetArgs(['name', 'age']);
```

## 🔄 Backward Compatibility
- ✅ Existing code without generics continues to work
- ✅ No breaking changes to public APIs
- ✅ Docs blocks maintain compatibility

## 🎯 Resolves
Fixes #25070

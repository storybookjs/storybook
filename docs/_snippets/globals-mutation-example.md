```ts filename="example.ts" renderer="common" language="ts"
// ❌ Wrong - Direct mutation won't trigger re-renders
globals.theme = 'dark';

// ✅ Correct - Use updateGlobals function
updateGlobals({ theme: 'dark' });
```


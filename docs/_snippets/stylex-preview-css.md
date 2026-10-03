```css filename=".storybook/preview.css" renderer="common" language="css"
/* Your reset, in its own layer. StyleX's `useCSSLayers: { before: ['reset'] }` puts it first. */
@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
}

/* Next.js with @stylexjs/postcss-plugin only: the StyleX CSS is written here */
@stylex;
```

```ts filename=".storybook/preview.ts" renderer="common" language="ts"
// Import a CSS file, so static builds have a CSS asset for StyleX to write into
import './preview.css';

export default {};
```

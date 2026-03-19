```js filename="src/components/Button.js" renderer="react" language="js"
// This import will work in Storybook
import styles from './Button.module.css';
// Sass/Scss modules are also supported
// import styles from './Button.module.scss'
// import styles from './Button.module.sass'

export function Button() {
  return (
    <button type="button" className={styles.error}>
      Destroy
    </button>
  );
}
```

```ts filename="src/components/Button.ts" renderer="react" language="ts"
// This import will work in Storybook
import styles from './Button.module.css';
// Sass/Scss modules are also supported
// import styles from './Button.module.scss'
// import styles from './Button.module.sass'

export function Button() {
  return (
    <button type="button" className={styles.error}>
      Destroy
    </button>
  );
}
```

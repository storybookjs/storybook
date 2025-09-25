```jsx title="src/components/Button.jsx"
// This import will work in Storybook
import styles from './Button.module.css';
// Sass/Scss is also supported
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
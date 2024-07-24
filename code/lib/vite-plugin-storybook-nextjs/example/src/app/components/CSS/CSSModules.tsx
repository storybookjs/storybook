// This component should show the usage of CSS Modules in React
import styles from "./styles.module.css";

export default function CSSModules() {
  return <div className={styles.random}>Hello, CSS Modules!</div>;
}

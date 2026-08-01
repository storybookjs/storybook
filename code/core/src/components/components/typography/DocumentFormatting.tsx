export const nameSpaceClassNames = (
  { ...props },
  key: string
): {
  [x: string]: any;
} => {
  const classes = [props.class, props.className];

  delete props.class;

  props.className = ['sbdocs', `sbdocs-${key}`, ...classes].filter(Boolean).join(' ');

  return props;
};

import Button from './Button.svelte';

export default { title: 'Snippet Review/Fallback' };
export const Dynamic = {
  render: () => ({ Component: Button, props: { label: 'Fallback source' } }),
};

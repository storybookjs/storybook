<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Modal from './Modal.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Modal',
    component: Modal,
  });
</script>

<Story name="Default" args={{ id: 'modal-default', open: true, confirmType: 'secondary' }} />

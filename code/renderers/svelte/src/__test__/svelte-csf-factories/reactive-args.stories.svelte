<script module lang="ts">
  import { tick } from 'svelte';

  import preview from './preview.ts';
  import Text from '../../../template/stories/svelte-csf/text.svelte';

  const { Story } = preview.meta({ component: Text });

  let text = $state('initial');

  async function changeText() {
    text = 'changed';
    await tick();
    text = 'initial';
    await tick();
  }
</script>

<Story name="Reactive" args={{ text }} play={changeText} />

<Story extend="Reactive" name="Extended" play={changeText} />

<Story extend="Reactive" name="Overridden" args={{ text: 'own' }} play={changeText} />

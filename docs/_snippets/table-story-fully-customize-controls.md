```html renderer="svelte" language="ts" tabTitle="native-format"
{/*Table.stories.svelte */}

<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import Table from './Table.svelte';
</script>

<Meta title="Custom Table" component={Table} argTypes={{ size: { options: ['small', 'medium',
'large'], }, }} />

<template let:args>
  <table {...args}>
    <tbody>
      {#each args.data as row}
      <tr>
        {#each row as col}
        <td>{col}</td>
        {/each}
      </tr>
      {/each}
    </tbody>
  </table>
</template>

{/* 👇 The data arg is for the story component and the remaining args get passed to the Table component */}
<Story name="Numeric" args={{ data: [ [1, 2, 3], [4, 5, 6], ], size: 'large', }} />
```


<script>
  import { Meta, Story } from '../src/index';
  import { withKnobs, text, number } from '@storybook/addon-knobs';

  const backgroundColor = text('Background', 'green');
  const width = number('Width', 200, {
    range: true,
    min: 100,
    max: 1000,
    step: 100,
  });

  const height = number('Height', 200, {
    range: true,
    min: 100,
    max: 1000,
    step: 100,
  });
</script>

<Meta title="Addon/Knobs" decorators={[withKnobs]}/>

<Story name="Simple" source>
  <div style="width: {width}px; height: {height}px; background-color: {backgroundColor}">
    <p>I am interactive</p>
  </div>
</Story>
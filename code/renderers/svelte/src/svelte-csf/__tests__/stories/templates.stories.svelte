<script context="module">
  export const meta = {
    title: 'Templates',
  };
</script>

<script>
  import { Template, Story } from '../src/index';
</script>

<Template id="myTemplate" args={{ text: 'story1' }}>
  {#snippet children({ text })}
    <div>Template 1 {text}</div>
  {/snippet}
</Template>

<Template id="anotherTemplate">
  {#snippet children({ text })}
    <div>Template 2 {text}</div>
  {/snippet}
</Template>

<Story id="s1" template="myTemplate" name="Story with myTemplate" args={{ text: 'story1' }} />
<Story
  id="s2"
  template="anotherTemplate"
  name="Story with anotherTemplate"
  args={{ text: 'story2' }}
/>

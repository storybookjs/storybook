<script>
    import { Meta, Story, Template } from '../src/index.js';
</script>

<Meta title="Templates"/>

<Template id="myTemplate" let:text>
    <div>Template 1 {text}</div>
</Template>

<Template id="anotherTemplate" let:text>
    <div>Template 2 {text}</div>
</Template>

<Story id="s1" template="myTemplate" name="Story with myTemplate" args={{text:'story1'}}/>
<Story id="s2" template="anotherTemplate" name="Story with anotherTemplate" args={{text:'story2'}}/>

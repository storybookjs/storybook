<script>
    import Meta from '../Meta.svelte';
    import Story from '../Story.svelte';
    import Template from '../Template.svelte';
</script>

<Meta title="Test"/>

<Template id="tpl1">
    <div>tpl1</div>
</Template>

<Template id="tpl2">
    <div>tpl2</div>
</Template>

<Story name="Story1" template="tpl1" args={{ tpl1:true }}/>
<Story name="Story2" template="tpl2" source args={{ tpl1:true }}/>
<Story name="Story3" source="xyz">
    <div>story3</div>
</Story>

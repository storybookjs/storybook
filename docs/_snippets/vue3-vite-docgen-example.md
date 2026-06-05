```html filename="YourComponent.vue" language="ts" renderer="vue" tabTitle="Reactive Props Destructure"
<script setup lang="ts">
  interface MyComponentProps {
    /** The name of the user */
    name: string;
    /**
     * The category of the component
     *
     * @since 8.0.0
     */
    category?: string;
  }

  const { name, category = 'Uncategorized' } = defineProps<MyComponentProps>();
</script>
```

```html filename="YourComponent.vue" language="ts" renderer="vue" tabTitle="withDefaults"
<script setup lang="ts">
  interface MyComponentProps {
    /** The name of the user */
    name: string;
    /**
     * The category of the component
     *
     * @since 8.0.0
     */
    category?: string;
  }

  withDefaults(defineProps<MyComponentProps>(), {
    category: 'Uncategorized',
  });
</script>
```

```html filename="YourComponent.vue" language="js" renderer="vue" tabTitle="Runtime Prop Declaration"
<script setup>
  const props = defineProps({
    /** The name of the user */
    name: { type: String, required: true },
    /**
     * The category of the component
     *
     * @since 8.0.0
     */
    category: { type: String, default: 'Uncategorized' },
  });
</script>
```

```html filename=".storybook/preview-head.html" renderer="common" language="html"
<!-- Declare the layer order before any other CSS loads: the reset first, StyleX after it -->
<style>
  @layer reset, priority1, priority2, priority3, priority4;
</style>
```

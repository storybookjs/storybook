```html filename=".storybook/preview-head.html" renderer="common" language="ts" tabTitle="html"
<!-- 
 
 Pull in static files served from your Static directory or the internet 
 Example: `main.js|ts` is configured with staticDirs: ['../public'] and your font is located in the `fonts` directory inside your `public` directory
 
 -->

<link rel="preload" href="/fonts/my-font.woff2" />

<!-- Or you can load custom head-tag JavaScript: -->

<script src="https://use.typekit.net/xxxyyy.js"></script>
<script>
  try {
    Typekit.load();
  } catch (e) {}
</script>
```

```js filename="your-framework/src/client/preview/render.ts" renderer="common" language="js"
const rootElement = document.getElementById('root');

export default function renderMain({ storyFn }: RenderMainArgs) {
  const storyObj = storyFn();
  const html = fn(storyObj);
  rootElement.innerHTML = html;
}
```


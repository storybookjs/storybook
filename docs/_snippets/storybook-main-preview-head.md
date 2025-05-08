```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  previewHead: (head) => (`
    ${head}
    <style>
      #main {
        background-color: yellow;
      }
    </style>
  `);
};
```

import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Html,
  args: {
    content: '',
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};

export const Violations = {
  args: {
    content: `
      <div>
        <p>empty heading</p>
        <h1></h1>
      </div>
      <div>
        <p>empty button</p>
        <button></button>
      </div>
      <div>
        <p>missing label</p>
        <label><input /></label>
      </div>
      <div>
        <p>missing alt</p>
        <img src="https://storybook.js.org/images/placeholders/350x150.png" />
      </div>
      <div>
        <p>Checkbox with contrast toggle</p>
        <input type="checkbox" id="color-toggle" />
        <label for="color-toggle">Toggle violation:</label>
      </div>

      <style>
        input[type="checkbox"]:not(:checked) + label {
          background-color: red;
          color: white;
          cursor: pointer;
        }

        input[type="checkbox"]:checked + label {
          background-color: green;
          color: white;
          cursor: pointer;
        }
      </style>
    `,
  },
};

export const Passes = {
  args: {
    content: `
      <div>
        <p>heading</p>
        <h1>heading 1</h1>
      </div>
      <div>
        <p>button</p>
        <button>Click me!</button>
      </div>
      <div>
        <p>contrast</p>
        <button style="color: rgb(255, 255, 255); background-color: rgb(0, 0, 0);">Click me!</button>
      </div>
      <div>
        <p>label</p>
        <label><span>label</span><input /></label>
      </div>
      <div>
        <p>alt</p>
        <img src="https://storybook.js.org/images/placeholders/350x150.png" alt="placeholder" />
      </div>
    `,
  },
};

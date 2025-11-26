import { html } from 'lit';

export default {
  component: undefined,
};

export const InTemplate = () => html`
  <div>JS alert</div>
  <script>
    alert('hello');
  </script>
`;

export const InString = () => '<div>JS alert</div><script>alert("hello")</script>';

export const TypeModule = () =>
  '<div>JS alert from module</div><script type="module">alert("hello from module"); export const a = 1;</script>';

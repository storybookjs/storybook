/**
 * This component checks Next.js' global css and external stylesheet support
 * by importing Bootstrap's css globally in ./storybook/preview.js
 * https://nextjs.org/docs/app/building-your-application/styling/css-modules#external-stylesheets
 */
export function BootstrapButton() {
  return (
    <button type="button" className="btn btn-success">
      Success
    </button>
  );
}

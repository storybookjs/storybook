# Pattern-Copy Storybook Setup

Make Storybook match the real app.

- copy real patterns from the codebase
- keep the app code unchanged
- put the default setup in `.storybook/preview.tsx`
- keep stories thin: simple JSX copied from real usage

## 1. Read the real app first

Read enough of the app to understand the full runtime environment before writing any stories.

Do not stop at `main.tsx` or `App.tsx`.
Follow imports into providers, pages, hooks, and shared components until you know:
- which providers exist
- which CSS files are injected
- which queries fetch data
- which browser-state reads happen
- which side-effect actions happen
- which portals and portal roots exist
- which pages and components show the real usage patterns

Example of what to copy:

```tsx
// src/main.tsx
import './index.css';
import App from './App';
import { SessionProvider } from './contexts/SessionContext';

createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <App />
  </SessionProvider>
);
```

That means Storybook should copy:
- the `index.css` import
- the `SessionProvider`
- the same provider order

Example of tracing the app deeper:

```tsx
// src/App.tsx
function App() {
  const { products, loadMoreProducts } = useProducts();
  const { currentUser, signOut } = useSession();
  // ...
}
```

```ts
// src/hooks/useProducts.ts
const response = await fetch(apiBaseUrl + '/products?page=1');
```

```ts
// src/hooks/useTheme.ts
const savedTheme = localStorage.getItem('theme');
```

```tsx
// src/components/ProductCard.tsx
await navigator.share(...);
await navigator.clipboard.writeText(product.url);
```

That means the default Storybook setup should discover and prepare:
- provider state
- fetch mocks
- localStorage state
- share and clipboard spies
- any dates, observers, images, or browser APIs on those paths

## 2. Build one default app environment in preview

Set up Storybook once so most stories work without story-specific setup.

Example:

```tsx
// .storybook/preview.tsx
import type { Preview } from '@storybook/react-vite';
import MockDate from 'mockdate';
import '../src/index.css';
import { SessionProvider } from '../src/contexts/SessionContext';

const preview: Preview = {
  decorators: [
    (Story) => (
      <SessionProvider>
        <Story />
      </SessionProvider>
    ),
  ],
  async beforeEach() {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('sidebar:open', 'true');
    MockDate.set('2024-04-01T12:00:00Z');
  },
};

export default preview;
```

Use this same idea for:
- providers
- root CSS
- browser state
- dates

## 3. Support portals with preview-body.html

If the app uses portals, copy that setup into Storybook too.

Look for patterns like:
- `createPortal(...)`
- modal, dialog, drawer, popover, tooltip, toast, or dropdown portal components
- hard-coded roots such as `#portal-root`, `#modal-root`, `#drawer-root`, or `#toast-root`

Example of what to copy:

```tsx
// real component
return createPortal(
  <ModalContent />,
  document.getElementById('portal-root')!
);
```

That means Storybook should create the same portal root in `.storybook/preview-body.html`:

```html
<!-- .storybook/preview-body.html -->
<div id="portal-root"></div>
```

If the app uses multiple portal roots, create all of them there:

```html
<!-- .storybook/preview-body.html -->
<div id="modal-root"></div>
<div id="drawer-root"></div>
<div id="toast-root"></div>
```

If a library portals directly to `document.body`, do not add extra roots for it.
Make sure the copied page shell, CSS, and layout still allow overlays, fixed positioning, and z-index stacking to render correctly.

## 4. Mock side effects globally

All side effects should be handled by the default Storybook environment.

- side effect queries should return deterministic mock data
- side effect actions should be stubbed and spied on

Example of copying a real fetch pattern into shared handlers:

```ts
// real app hook
const response = await fetch(
  apiBaseUrl +
    '/products?' +
    new URLSearchParams({
      page: '1',
      sort: 'featured',
    })
);
```

```ts
// .storybook/msw-handlers.ts
export const mswHandlers = {
  products: [
    http.get('https://api.example.com/products', () =>
      HttpResponse.json({
        items: [
          {
            id: 'product-1',
            name: 'Example product',
            description: 'Mock product description',
            imageUrl: 'https://images.example.com/product.jpg',
            price: 42,
          },
        ],
      })
    ),
  ],
};
```

```tsx
// .storybook/preview.tsx
import type { Preview } from '@storybook/react-vite';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { mswHandlers } from './msw-handlers';

initialize({
  onUnhandledRequest: 'bypass',
});

const preview: Preview = {
  loaders: [mswLoader],
  parameters: {
    msw: {
      handlers: mswHandlers,
    },
  },
};

export default preview;
```

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  staticDirs: ['../public'],
};

export default config;
```

Example action setup:

```tsx
import type { Preview } from '@storybook/react-vite';
import { fn } from 'storybook/test';

const shareSpy = fn();
const clipboardSpy = fn();
const reloadSpy = fn();

const preview: Preview = {
  async beforeEach() {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareSpy,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardSpy,
      },
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadSpy,
      },
    });
  },
};

export default preview;
```

Keep these mocks global.
Do not put fetch mocks in individual stories.
If the defaults are not enough, improve the shared default setup instead.

## 5. Write thin stories

Write colocated stories for top-level components, from low-level reusable components up to page components.
Write up to 10 story files, or fewer if the codebase has fewer meaningful targets.

The story files should be thin.
They should mostly just render JSX copied from real usage patterns in:
- pages
- app shells
- routes
- tests
- existing feature code

Example:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SomeComponent } from './SomeComponent';

const meta = {
  component: SomeComponent,
} satisfies Meta<typeof SomeComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <SomeComponent variant="primary" disabled={false} />,
};
```

If the codebase already contains real JSX, copy that shape almost directly:

```tsx
export const Default: Story = {
  render: () => (
    <Card>
      <Button disabled={false}>Save</Button>
    </Card>
  ),
};
```

Example of copying real page JSX:

```tsx
// real app
return (
  <div className="page-shell">
    <FiltersPanel />
    {products.map((product) => (
      <ProductCard key={product.id} product={product} />
    ))}
  </div>
);
```

```tsx
// story
export const Default: Story = {
  render: () => (
    <div className="page-shell">
      <FiltersPanel />
      <ProductCard product={mockProduct} />
    </div>
  ),
};
```

Keep the setup in preview, not in the stories.
Do not build story-specific harnesses.
Do not write story files for subcomponents, hooks, contexts, or helpers.
Do not create new application components.
Do not add a custom `title`.

## 6. Cover the patterns you found

Write stories for the real patterns in the codebase, for example:
- a low-level reusable component in real JSX usage
- a provider-backed component
- a browser-state-backed component
- a fetched-data component
- a real page component

Use `App.tsx` to inspect the real provider tree and usage patterns, but do not make a story for `App` when the codebase has actual page components.

Example page story:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductPage } from './ProductPage';

const meta = {
  component: ProductPage,
} satisfies Meta<typeof ProductPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ProductPage />,
};
```

## 7. Verify both rendering and types

As you work, verify screenshots:

```bash
STORYBOOK_FAIL_ON_EMPTY_RENDER=true STORYBOOK_TEST_SCREENSHOTS=true npx vitest --project storybook <path-to-story-file>
```

Also verify types so you catch missing required props, broken imports, and preview typing issues:

```bash
npx tsc --noEmit
```

Keep iterating until:
- every story you wrote passes
- the changed stories and preview setup typecheck cleanly
- the rendered output looks sensible
- the default global mocked environment is strong enough that stories do not need manual fetch overrides
- empty renders no longer fail because the shared preview setup and story JSX are fixed

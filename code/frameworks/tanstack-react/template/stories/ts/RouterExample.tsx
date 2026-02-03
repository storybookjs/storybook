import { Link, Outlet, useRouterState } from '@tanstack/react-router';

export const RouterLayout = () => {
  const state = useRouterState();

  return (
    <div>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <p style={{ color: '#666', fontSize: 12 }}>Current path: {state.location.pathname}</p>
      <Outlet />
    </div>
  );
};

export const RouterHome = () => (
  <section>
    <h3>Home</h3>
    <p>This route is rendered through TanStack Router.</p>
  </section>
);

export const RouterAbout = () => (
  <section>
    <h3>About</h3>
    <p>Navigate with the links above to see routes change.</p>
  </section>
);

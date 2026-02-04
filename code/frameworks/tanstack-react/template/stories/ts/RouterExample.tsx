import { Link, Outlet, useMatch, useRouterState } from "@tanstack/react-router";

export const RouterLayout = () => {
  const state = useRouterState();

  return (
    <div>
      <nav style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
        <Link to="/posts/42">Post 42</Link>
        <Link to="/app/settings">App settings</Link>
      </nav>
      <p style={{ color: "#666", fontSize: 12 }}>
        Current path: {state.location.pathname}
      </p>
      <Outlet />
    </div>
  );
};

export const RouterHome = () => (
  <section>
    <h3>Home</h3>
    <p>This route is the home route.</p>
  </section>
);

export const RouterAbout = () => (
  <section>
    <h3>About</h3>
    <p>Navigate with the links above to see routes change.</p>
  </section>
);

export const RouterPost = () => {
  const match = useMatch({ from: "/posts/$postId" });
  const postId = match?.params.postId ?? "unknown";

  return (
    <section>
      <h3>Post detail</h3>
      <p>Post ID from params: {postId}</p>
    </section>
  );
};

export const RouterAppLayout = () => (
  <section>
    <h3>App layout</h3>
    <p>This route demonstrates nested layouts.</p>
    <Outlet />
  </section>
);

export const RouterAppSettings = () => (
  <section>
    <p>Nested settings route rendered under the app layout.</p>
  </section>
);

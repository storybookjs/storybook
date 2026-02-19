import { Link, Outlet, useRouterState } from '@tanstack/react-router';

export const DashboardLayout = (): JSX.Element => {
  const routerState = useRouterState();

  return (
    <div>
      <nav style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Link to="/dashboard" activeProps={{ style: { fontWeight: 'bold' } }}>
          Dashboard
        </Link>
        <Link to="/profile" activeProps={{ style: { fontWeight: 'bold' } }}>
          Profile
        </Link>
      </nav>
      <p style={{ fontSize: '0.875rem', color: '#666' }}>Current path: {routerState.location.pathname}</p>
      <Outlet />
    </div>
  );
};

export const DashboardPage = (): JSX.Element => (
  <section>
    <h3>Dashboard</h3>
    <p>Welcome to the dashboard.</p>
  </section>
);

export const ProfilePage = (): JSX.Element => (
  <section>
    <h3>Profile</h3>
    <p>Manage your profile settings.</p>
  </section>
);

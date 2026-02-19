import { useLoaderData } from '@tanstack/react-router';

export interface Post {
  id: string;
  title: string;
  body: string;
}

export const PostDetail = (): JSX.Element => {
  const post = useLoaderData({ from: '/posts/$postId' }) as Post;

  return (
    <article style={{ padding: '1rem' }}>
      <h3>{post.title}</h3>
      <p>{post.body}</p>
      <small style={{ color: '#666' }}>ID: {post.id}</small>
    </article>
  );
};

export const PostLoadingSpinner = (): JSX.Element => (
  <div
    role="status"
    aria-label="Loading"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
    }}
  >
    <div
      style={{
        width: '40px',
        height: '40px',
        border: '4px solid #e5e7eb',
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}
    />
    <p style={{ marginTop: '1rem', color: '#666' }}>Loading post…</p>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export const PostErrorBanner = ({ error }: { error: Error }): JSX.Element => (
  <div role="alert" style={{ padding: '1rem', color: '#991b1b' }}>
    <p>Error: {error.message}</p>
  </div>
);
